// Jev 结果的本地缓存（IndexedDB，跑在后台 service worker 里）。
// 每条回复一条记录 {id, post, fingerprint, scores, scoredAt, ts, size}；上下文不符或过期即不命中，
// 总量（估算字节数）超过上限时，按最后访问时间从旧到新删到上限的 90%。
const DB = "ff-cache";
const STORE = "jev";
const META = "meta";
export const CACHE_TTL_MS = 7 * 86400e3; // latest 模型的结果最多复用七天，访问不续期
const TOUCH_EVERY = 3600e3; // 访问时间最多每小时刷新一次，读多写少

let dbp = null;
function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        const s = db.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("ts", "ts");
        s.createIndex("post", "post");
        db.createObjectStore(META);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbp = null; reject(req.error); };
    });
  }
  return dbp;
}
const reqp = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error); });
const sizeOf = (rec) => JSON.stringify(rec).length + 64; // 估算：JSON 长度 + 每条固定开销
// 存的键：这一页的键 + 回复 id（0.28.8，review：以前只按回复 id 存，同一条帖子在用户主页、搜索结果、帖子页来回看——指纹里的这一页不同——
// 互相覆盖，每换一处重判一次、付一次费）。没给 post 的照旧只按 id；0.28.7 以前按 id 存的记录照样认（指纹里有这一页，对得上就是同一处）
const slot = (id, post) => (post ? `${post}\n${id}` : id);

// [{id, post, fingerprint}] → {id: scores}；旧版没有指纹和评分时间，安全地当作未命中。
export async function getMany(queries) {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  const st = tx.objectStore(STORE);
  const now = Date.now();
  const out = {};
  await Promise.all(queries.map(async (query) => {
    if (!query?.id || !query.fingerprint) return;
    let rec = await reqp(st.get(slot(query.id, query.post)));
    if (!rec && query.post) rec = await reqp(st.get(query.id)); // 0.28.7 以前的记录
    if (!rec || rec.fingerprint !== query.fingerprint || !Number.isFinite(rec.scoredAt) ||
        now - rec.scoredAt >= CACHE_TTL_MS || rec.scoredAt > now) return;
    out[query.id] = rec.scores;
    if (now - rec.ts > TOUCH_EVERY) { rec.ts = now; st.put(rec); }
  }));
  await done(tx);
  return out;
}

// recs: [{id, post, fingerprint, scores}]；返回 {bytes, count, evicted}
export async function putMany(recs, capBytes) {
  const db = await open();
  const tx = db.transaction([STORE, META], "readwrite");
  const st = tx.objectStore(STORE);
  const meta = tx.objectStore(META);
  let bytes = (await reqp(meta.get("bytes"))) || 0;
  let count = (await reqp(meta.get("count"))) || 0;
  let evicted = 0;
  const now = Date.now();
  for (const r of recs) {
    const sid = slot(r.id, r.post);
    const old = await reqp(st.get(sid));
    if (old) { bytes -= old.size || 0; count--; }
    const rec = { id: sid, post: r.post || "", fingerprint: r.fingerprint, scores: r.scores, scoredAt: now, ts: now };
    rec.size = sizeOf(rec);
    st.put(rec);
    bytes += rec.size;
    count++;
  }
  if (bytes > capBytes) {
    await new Promise((res, rej) => {
      const cur = st.index("ts").openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c || bytes <= capBytes * 0.9) return res();
        bytes -= c.value.size || 0;
        count--;
        evicted++;
        c.delete();
        c.continue();
      };
      cur.onerror = () => rej(cur.error);
    });
  }
  meta.put(Math.max(bytes, 0), "bytes");
  meta.put(Math.max(count, 0), "count");
  await done(tx);
  return { bytes, count, evicted };
}

// 过期的真删掉（0.28.5，隐私政策写的"最多 7 天"；以前过期的只是读的时候不用，要等缓存满了才按访问时间删）。
// 后台每天跑一次（background.js 的 purgeCaches）；返回删了几条
export async function purgeExpired(now = Date.now()) {
  const db = await open();
  const tx = db.transaction([STORE, META], "readwrite");
  const st = tx.objectStore(STORE), meta = tx.objectStore(META);
  let bytes = (await reqp(meta.get("bytes"))) || 0, count = (await reqp(meta.get("count"))) || 0, removed = 0;
  await new Promise((res, rej) => {
    const cur = st.openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) return res();
      const r = c.value;
      if (!Number.isFinite(r.scoredAt) || now - r.scoredAt >= CACHE_TTL_MS || r.scoredAt > now) { bytes -= r.size || 0; count--; removed++; c.delete(); }
      c.continue();
    };
    cur.onerror = () => rej(cur.error);
  });
  meta.put(Math.max(bytes, 0), "bytes");
  meta.put(Math.max(count, 0), "count");
  await done(tx);
  return removed;
}

export async function stats() {
  const db = await open();
  const tx = db.transaction(META, "readonly");
  const meta = tx.objectStore(META);
  const [bytes, count] = await Promise.all([reqp(meta.get("bytes")), reqp(meta.get("count"))]);
  return { bytes: bytes || 0, count: count || 0 };
}

export async function clear() {
  const db = await open();
  const tx = db.transaction([STORE, META], "readwrite");
  tx.objectStore(STORE).clear();
  tx.objectStore(META).clear();
  await done(tx);
}
