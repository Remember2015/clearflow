// 两个 API key（Jev / TypeSafe 的 jev、OpenRouter 的 or）存在插件自己的 IndexedDB 里（0.28.12，review：以前在 chrome.storage.local——
// X、Reddit 这些网站页面里的内容脚本也读得到，key 一改还把新旧明文推给每个标签页的 storage.onChanged。IndexedDB 按来源分开，
// 内容脚本跑在网站那边的来源里，打不开插件的库）。只有后台读写它；设置页、弹窗经后台的消息存 key，"填没填"看 storage.local 的
// ff_keys（{jev, or} 两个是否填了，没有 key 本身），内容脚本也只看它。
const DB = "ff-keys", STORE = "keys";
let dbp = null;
function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbp = null; reject(req.error); };
    });
  }
  return dbp;
}
const reqp = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
export async function getKey(name) {
  const db = await open();
  const v = await reqp(db.transaction(STORE).objectStore(STORE).get(name));
  return typeof v === "string" ? v : "";
}
// 空的就是删掉
export async function setKey(name, value) {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite"), st = tx.objectStore(STORE);
  const v = typeof value === "string" ? value.trim() : "";
  if (v) st.put(v, name); else st.delete(name);
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error); });
}
