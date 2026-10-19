// 后台 service worker：替内容脚本调 Jev（页面里直接请求会被跨域拦下），结果存本地缓存（IndexedDB，见 cache.js），记统计和反馈，
// 记下最近折叠的回复（弹窗里"判对了吗"用），出问题（key 无效、余额不足）时留个标记让弹窗提示。
import { scoreReplies, JevError, validScores, cacheRequests, cleanExtra, askOf, askPost, postFingerprint, validPostScores, markedRequests, askMarked, MARKED_MAX, MARKED_BATCH } from "./jev.js";
import "./i18n_all.js";
import "./i18n.js";
import "./settings.js";
import * as cache from "./cache.js";
import * as feedback from "./feedback.js";
import * as translator from "./translator.js";
import { imageAsset, allowedImage } from "./images.js";
import * as keyStore from "./keys.js";

const { DEFAULTS, forSite, siteOf, SITES, IMAGE_ORIGINS } = globalThis.FFSettings;
// 只管翻译的设置：改了不打断评论区（不取消评论区的 Jev 请求）
const TRANSLATE_KEYS = ["translate", "translateFill", "translateThreshold", "translateMargin", "translateModel", "translateFallback"];
// 评论区进行中的 Jev 请求：只有改了会让请求本身不该发、或者发的内容不一样的设置才打断（关掉清理、不用 Jev、看不看图）。
// 0.28.7 以前阈值、M1 长度、缓存上限这些改了也打断——Jev 那边已经判完、收过费了，页面再重发一次（review）
const COMMENT_KEYS = ["enabled", "useJev", "images"];
// 设置改了：哪个网站上（或者默认的那一份）这几项实际变了没有（0.20 起每个网站可以单独改，要一个个网站比）
const SITE_IDS = [null, ...SITES.map((x) => x.id)];
const changedFor = (oldRaw, newRaw, keys) => SITE_IDS.some((id) => {
  const a = forSite(oldRaw, id), b = forSite(newRaw, id);
  return keys.some((k) => a[k] !== b[k]);
});
const LOG_MAX = 3000;
const PRICE_PER_TOKEN = 0.042 / 1e6;

// 0.1 版把缓存整个存在 chrome.storage.local 的 ff_cache 里，每次都整块读写；换成 IndexedDB 后删掉
chrome.storage.local.remove("ff_cache").catch(() => {});
// 0.11 去掉了首页 Feed 记录（用户不用）：删掉它留在本机的数据库（ff-feed）和存储里的 ff_feed_* 键
export async function dropFeedData() {
  try { indexedDB.deleteDatabase("ff-feed"); } catch { /* 没有就算了 */ }
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("ff_feed_"));
  if (keys.length) await chrome.storage.local.remove(keys);
}
// 0.24 去掉了"记录 Reddit 评论（评估用）"和 Reddit 的结构探针（开发时用的，用户：不留）：删掉它们留在本机的东西。
// 0.28.5 不再存"最近清理的 50 条"（review：自 0.20.1 起没有界面展示，却一直存着别人的原文、昵称和你在 X 上的搜索词、看过的主页；
// 用户 10-19 定少存）：已存的也删掉
export async function dropDevData() {
  await chrome.storage.local.remove(["ff_eval_reddit", "ff_eval_reddit_n", "ff_dev_reddit", "ff_recent_folds"]);
}
// 两份缓存过期的真删掉（0.28.5，见 cache.js / translator.js 的 purgeExpired）：service worker 每次起来看一眼，距上次超过一天才跑
const PURGE_EVERY = 864e5;
export async function purgeCaches(now = Date.now()) {
  const { ff_purged_at = 0 } = await chrome.storage.local.get("ff_purged_at");
  if (now - ff_purged_at < PURGE_EVERY && ff_purged_at <= now) return null;
  const [jev, tx] = await Promise.all([cache.purgeExpired(now).catch(() => 0), translator.idbCache.purgeExpired(now).catch(() => 0)]);
  await chrome.storage.local.set({ ff_purged_at: now });
  return { jev, tx };
}
setTimeout(() => { purgeCaches().catch(() => {}); }, 5000);
dropDevData().catch(() => {});
// 首次安装（0.23）：打开首次设置那一页（选网站和功能、填两个 key）；升级、重新加载不弹
chrome.runtime.onInstalled?.addListener((details) => {
  dropFeedData().catch(() => {});
  dropDevData().catch(() => {});
  if (details && details.reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("options.html#welcome") }).catch(() => {});
});

// 0.4.1 把垃圾回复的阈值默认值从 0.5 提到 0.6：rev 2 以前存下的 0.5 就是旧默认值，换成新的；别的值是自己调过的，不动。
// 0.15.3（rev 3）M1 的长度改按汉字当量算，默认值 15 → 10：存着的 15 就是旧默认值
export async function migrateSettings() {
  const { ff_settings } = await chrome.storage.local.get("ff_settings");
  if (!ff_settings || (ff_settings.rev || 1) >= DEFAULTS.rev) return;
  if ((ff_settings.rev || 1) < 2 && ff_settings.threshold === 0.5) ff_settings.threshold = DEFAULTS.threshold;
  if ((ff_settings.rev || 1) < 3 && ff_settings.m1MaxLen === 15) ff_settings.m1MaxLen = DEFAULTS.m1MaxLen;
  // 0.20（rev 4）总开关（暂停、翻译增强）换成每个网站的开关：关着的折进每个网站，总开关打开（界面上没有了）。
  // 以前暂停时 X 照样改进翻译、别的网站不翻（tx_engine 要求两个都开），照这个折
  if ((ff_settings.rev || 1) < 4) {
    const sites = { ...(ff_settings.sites || {}) };
    for (const x of SITES) {
      const o = { ...(sites[x.id] || {}) };
      if (ff_settings.enabled === false) { o.fold = false; if (x.id !== "x") o.translate = false; }
      if (ff_settings.translate === false) o.translate = false;
      if (Object.keys(o).length) sites[x.id] = o;
    }
    Object.assign(ff_settings, { sites, enabled: true, translate: true });
  }
  // 0.28.3（rev 5）替换要求的分差默认 0.1 → 0.05：存着的 0.1 就是旧默认值（设置页保存时整份写进去的），换掉；自己调过的不动
  if ((ff_settings.rev || 1) < 5 && ff_settings.translateMargin === 0.1) ff_settings.translateMargin = DEFAULTS.translateMargin;
  ff_settings.rev = DEFAULTS.rev;
  await chrome.storage.local.set({ ff_settings });
}
const migrated = migrateSettings().catch(() => {});

// site：消息是哪个网站的页面发来的（siteOf(sender.url)）：返回那个网站上实际用的设置；不是网站发来的（弹窗、设置页）给默认的那一份
async function settings(site = null) {
  await migrated;
  const { ff_settings } = await chrome.storage.local.get("ff_settings");
  return forSite(ff_settings, site);
}
// ---- 两个 key（0.28.12 起在 keys.js 的 IndexedDB 里，见那边的说明）----
// storage.local 里还有 ff_key / ff_or_key 的（0.28.11 以前的版本存的、升级前开着的旧设置页刚写的）：挪进去、从 storage.local 删掉。
// 每次取 key 前都看一眼（storage.local 读一下很便宜；没有就什么都不做）
const LEGACY = [["ff_key", "jev"], ["ff_or_key", "or"]];
const keyCache = new Map(); // 名字 → key（读过一次就记着，存 key 时一起改）
let keyChain = Promise.resolve();
function moveKeys() {
  const task = keyChain.then(async () => {
    const got = await chrome.storage.local.get(LEGACY.map(([old]) => old));
    const old = LEGACY.filter(([k]) => k in got);
    if (!old.length) return;
    for (const [k, name] of old) await storeKey(name, typeof got[k] === "string" ? got[k] : "");
    await chrome.storage.local.remove(old.map(([k]) => k));
  });
  keyChain = task.catch(() => {});
  return task;
}
async function readKey(name) {
  await moveKeys().catch(() => {});
  if (!keyCache.has(name)) keyCache.set(name, await keyStore.getKey(name).catch(() => ""));
  return keyCache.get(name);
}
const apiKey = () => readKey("jev");
const orKey = () => readKey("or");
// 存一个 key（空的就是删掉）：写进库；变了的话更新 ff_keys（{jev, or} 填没填、at 换 key 的时间——内容脚本靠它知道换了 key），
// 按换 key 处理（作废进行中的请求、清掉旧的"key 无效"）
async function storeKey(name, value) {
  const v = String(value || "").trim(), before = keyCache.has(name) ? keyCache.get(name) : await keyStore.getKey(name).catch(() => "");
  await keyStore.setKey(name, v);
  keyCache.set(name, v);
  if (v === before) return;
  const { ff_keys } = await chrome.storage.local.get("ff_keys");
  await chrome.storage.local.set({ ff_keys: { jev: !!(ff_keys && ff_keys.jev), or: !!(ff_keys && ff_keys.or), [name]: !!v, at: Date.now() } });
  // 原来没有（第一次填、升级时从 storage.local 挪过来）：没有用旧 key 在做的事，不用作废什么
  if (before) keysChanged(name);
}
// ff_keys 和库里对不上（第一次装、库被清过）：照库里的重写一遍
async function syncKeyFlags() {
  await moveKeys().catch(() => {});
  const flags = { jev: !!(await readKey("jev")), or: !!(await readKey("or")) };
  const { ff_keys } = await chrome.storage.local.get("ff_keys");
  if (!ff_keys || ff_keys.jev !== flags.jev || ff_keys.or !== flags.or) await chrome.storage.local.set({ ff_keys: { ...flags, at: Date.now() } });
}
syncKeyFlags().catch(() => {});
const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD

// ---- 统计：按天累加，串行写避免并发覆盖 ----
let statChain = Promise.resolve();
function bump(delta) {
  const task = statChain.then(async () => {
    const { ff_stats = {} } = await chrome.storage.local.get("ff_stats");
    const d = (ff_stats[today()] ||= {});
    for (const [k, v] of Object.entries(delta)) d[k] = (d[k] || 0) + v;
    await chrome.storage.local.set({ ff_stats });
  });
  statChain = task.catch(() => {});
  return task;
}
// 一条（回复、评论、帖子）的 id：X 是数字，Reddit 是 t1_… / t3_…，别的站点是"两个字母_id"（Hacker News：hn_123；YouTube：yt_<评论 id>，
// 回复的评论 id 里有点，视频是 yt_v_<视频 id>）
const SITE_ID = /^(\d{1,25}|t[13]_[a-z0-9]{1,13}|[a-z]{2}_[\w.-]{1,100})$/;
// "最近清理的 50 条"（rememberFold）0.28.5 起不存了（见 dropDevData）；页面那头也不再发 folded
let themeNow = null; // 工具栏图标现在是哪一套："icon"（浅色）/ "dark"；service worker 重启后不知道，下次页面报了再设
// ---- 出问题时给弹窗留个标记：Jev key 无效、OpenRouter key 无效或余额不足。下次成功、换了 key 就清掉 ----
let healthChain = Promise.resolve();
function health(service, code) {
  const task = healthChain.then(async () => {
    const { ff_health = {} } = await chrome.storage.local.get("ff_health");
    const cur = ff_health[service];
    if (code ? cur && cur.code === code : !cur) return;
    if (code) ff_health[service] = { code, at: Date.now() }; else delete ff_health[service];
    await chrome.storage.local.set({ ff_health });
  });
  healthChain = task.catch(() => {});
  return task;
}
const OR_CODES = new Set(["or_badkey", "or_credit"]);
function noteFailure(f) {
  if (f.code === "badkey" || f.code === "credit") health("jev", f.code).catch(() => {}); // TypeSafe 余额不足（402）也记下，弹窗提醒（0.28.8）
  if (OR_CODES.has(f.code)) health("or", f.code).catch(() => {});
  return f;
}
let logChain = Promise.resolve();
function log(entry) {
  const task = logChain.then(async () => {
    const { ff_log = [] } = await chrome.storage.local.get("ff_log");
    ff_log.push({ ts: new Date().toISOString(), ...entry });
    if (ff_log.length > LOG_MAX) ff_log.splice(0, ff_log.length - LOG_MAX);
    await chrome.storage.local.set({ ff_log });
  });
  logChain = task.catch(() => {});
  return task;
}

// ---- 并发和取消：设置或 key 改变后，旧批次不能继续上传 ----
let inflight = 0, configRevision = 0;
const waiters = [];
const controllers = new Set();
const cancelled = () => new DOMException("设置已改变，请重试", "AbortError");
// 换了 key（storeKey 调）：旧的"key 无效"不算了；进行中的翻译作废；换的是 Jev 的，评论区进行中的请求也作废（旧 key 的结果不能用）
function keysChanged(name) {
  health(name === "jev" ? "jev" : "or", null).catch(() => {});
  for (const controller of txControllers) controller.abort(cancelled());
  if (name !== "jev") return;
  configRevision++;
  for (const controller of controllers) controller.abort(cancelled());
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (LEGACY.some(([k]) => changes[k] && changes[k].newValue !== undefined)) moveKeys().catch(() => {}); // 旧页面写进 storage.local 的 key：挪走
  if (!changes.ff_settings) return;
  // 翻译：开关、模型、阈值变了，进行中的翻译作废（旧设置下的结果不能用）
  if (changedFor(changes.ff_settings.oldValue, changes.ff_settings.newValue, TRANSLATE_KEYS)) for (const controller of txControllers) controller.abort(cancelled());
  // 只动了不影响请求本身的设置（阈值这些）或值实际没变：不打断评论区进行中的请求
  if (!changedFor(changes.ff_settings.oldValue, changes.ff_settings.newValue, COMMENT_KEYS)) return;
  configRevision++;
  for (const controller of controllers) controller.abort(cancelled());
});
async function slot(signal) {
  signal.throwIfAborted();
  if (inflight < 2) { inflight++; return; }
  await new Promise((resolve, reject) => {
    const waiter = { resolve, signal, abort: () => {
      const i = waiters.indexOf(waiter);
      if (i >= 0) waiters.splice(i, 1);
      reject(signal.reason);
    } };
    signal.addEventListener("abort", waiter.abort, { once: true });
    waiters.push(waiter);
  });
}
function release() {
  const waiter = waiters.shift();
  if (waiter) {
    waiter.signal.removeEventListener("abort", waiter.abort);
    waiter.resolve(); // 把当前槽直接交给等待者，避免新请求抢走它。
  } else inflight--;
}
function failure(e, scores = {}) {
  if (e?.name === "AbortError") return { error: "cancelled", code: "cancelled", retryable: true, scores };
  if (e instanceof JevError && e.status === 401) return { error: "badkey", code: "badkey", retryable: false, scores };
  if (e instanceof JevError && e.status === 402) return { error: "credit", code: "credit", retryable: false, scores };
  return { error: String(e?.message || e), code: e?.code || "network", retryable: e?.retryable !== false, scores };
}
async function permission(key, site = null) {
  const [st, currentKey] = await Promise.all([settings(site), apiKey()]);
  if (!st.enabled || !st.useJev) return { error: "disabled", code: "disabled", retryable: false };
  if (!currentKey) return { error: "nokey", code: "nokey", retryable: false };
  if (key !== undefined && key !== currentKey) return failure(cancelled());
  return { key: currentKey, settings: st };
}
const validBatch = (replies) => Array.isArray(replies) && replies.length > 0 && replies.length <= 10 &&
  replies.every((r) => r && typeof r.id === "string" && /^[a-zA-Z0-9_.-]{1,110}$/.test(r.id) && typeof r.text === "string") &&
  new Set(replies.map((r) => r.id)).size === replies.length;

// 看图片（0.18）：回复带来的图片网址只留 IMAGE_ORIGINS 里的、每条最多 2 张、一批最多 6 张（按回复的先后，超出的这一批不发）；
// 设置里关着、或者浏览器没给读图的权限就整个去掉（没带图的回复请求、缓存指纹和以前一模一样）。缓存查询和真去问用同一份，指纹才对得上。
// 0.28.7（review）：一批 6 张的上限以前在下载时才算，超出的那几条"有图没发"，结果永远不进缓存、每次打开都重新付费判；
// 现在在这里就去掉，指纹里只有真发了的图。权限被收回时以前还当开着，图张张下载失败、结果也都不进缓存
const IMG_PER_REPLY = 2, IMG_PER_BATCH = 6;
async function imagesOn(st) {
  if (!st.images) return false;
  try { return await chrome.permissions.contains({ origins: [...IMAGE_ORIGINS] }); } catch { return false; }
}
function withImages(replies, on) {
  let budget = IMG_PER_BATCH;
  return replies.map((r) => {
    const { images, ...rest } = r;
    const imgs = on && Array.isArray(images)
      ? [...new Set(images.filter((u) => typeof u === "string" && u.length < 2000 && allowedImage(u, IMAGE_ORIGINS)))].slice(0, Math.min(IMG_PER_REPLY, budget)) : [];
    budget -= imgs.length;
    return imgs.length ? { ...rest, images: imgs } : rest;
  });
}
// 把要问的回复的图下载、缩好，装进 assets（引用名 img_<回复 id>_<第几张>）。有图一时没读到的（网络出错、超时、对方 5xx）记进 noCache：
// 这次的结果不进缓存，下次再试；图本身没了、坏了的（4xx、解不开、太大，见 images.js）照样进缓存——下次也一样读不到，不必再付一次费。
// 没字、图也一张没读到的回复不问（问了也只是空白）
async function prepareImages(missing, signal) {
  const assets = {}, noCache = new Set();
  const ask = await Promise.all(missing.map(async (r) => {
    if (!r.images) return r;
    const got = await Promise.all(r.images.map((u) => imageAsset(u, { signal })));
    const refs = [];
    got.forEach((a, i) => { if (a) { const ref = `img_${r.id}_${i}`; assets[ref] = { type: "image", format: a.format, data_base64: a.data_base64 }; refs.push(ref); } });
    if (got.some((a) => a === null)) noCache.add(r.id);
    return refs.length ? { ...r, imageRefs: refs } : r;
  }));
  return { ask: ask.filter((r) => r.text.trim() || r.imageRefs), assets, noCache };
}

async function handleJev({ postId, post, author, replies: raw, extra: wanted }, site = null) {
  if (!validBatch(raw)) return { error: "无效的回复批次", code: "invalid_request", retryable: false };
  const extra = cleanExtra(wanted); // 站点要多问的（YouTube 的 setup）；不认识的丢掉
  const revision = configRevision;
  const access = await permission(undefined, site);
  if (access.error) return access;
  const replies = withImages(raw, await imagesOn(access.settings));
  // 每条要齐的问题：整批的 extra，加上这一条自己多问的（0.22 的 filler 只问短回复）
  const need = new Map(replies.map((r) => [r.id, [...extra, ...askOf(r, extra)]]));
  // 你在这个网站上标记过垃圾（0.26）：要问五问的那些顺带问"是不是同一类"（并进同一个请求、不多发）；缓存里已经有这一问的分就带上，
  // 五问命中缓存、这一问没有的不为它单独问（刚标了一条时内容脚本另发 markedCheck）
  const examples = site ? await feedback.examplesFor(site, MARKED_MAX).catch(() => []) : [];
  const mq = examples.length ? await markedRequests(postId, post, replies, author, examples) : [];
  const withMarked = async (scores) => {
    if (!mq.length) return scores;
    let hit = {};
    try { hit = await cache.getMany(mq); } catch { /* 当没命中 */ }
    for (const q of mq) if (scores[q.reply] && typeof hit[q.id]?.marked === "number" && typeof scores[q.reply].marked !== "number") scores[q.reply] = { ...scores[q.reply], marked: hit[q.id].marked };
    return scores;
  };
  const controller = new AbortController();
  controllers.add(controller);
  let acquired = false, out = {};
  try {
    if (revision !== configRevision) throw cancelled();
    const queries = await cacheRequests(postId, post, replies, author, extra);
    try {
      out = await cache.getMany(queries);
      for (const id of Object.keys(out)) if (!validScores(out[id], need.get(id))) delete out[id];
    } catch { /* 缓存坏了就当未命中 */ }
    controller.signal.throwIfAborted();
    if (Object.keys(out).length) bump({ cache_hits: Object.keys(out).length }).catch(() => {});
    const todo = replies.filter((r) => !out[r.id]);
    if (!todo.length) return { scores: await withMarked(out) };
    await slot(controller.signal);
    acquired = true;
    controller.signal.throwIfAborted();
    const current = await permission(access.key, site);
    if (current.error) return { ...current, scores: out };
    controller.signal.throwIfAborted();
    // 等待槽期间别的页面可能已填好缓存。
    try {
      const cached = await cache.getMany(queries);
      for (const [id, sc] of Object.entries(cached)) if (!out[id] && validScores(sc, need.get(id))) out[id] = sc;
    } catch { /* 仍可直接请求 */ }
    const missing = replies.filter((r) => !out[r.id]);
    if (!missing.length) return { scores: await withMarked(out) };
    controller.signal.throwIfAborted();
    const { ask, assets, noCache } = await prepareImages(missing, controller.signal);
    controller.signal.throwIfAborted();
    const nImages = Object.keys(assets).length;
    let res;
    try {
      res = ask.length ? await scoreReplies(access.key, post, ask, { author, extra, assets, examples: examples.length ? examples : null, signal: controller.signal }) : { scores: {}, invalid: [], tokens: 0 };
    } catch (e) {
      // 图有毛病（格式、尺寸、太大）整批被拒：去掉图再问一次，这次的结果不进缓存
      if (!nImages || !(e instanceof JevError) || (e.status !== 400 && e.status !== 413)) throw e;
      for (const r of ask) if (r.imageRefs) noCache.add(r.id);
      const plain = ask.filter((r) => r.text.trim()).map(({ imageRefs, ...r }) => r);
      res = plain.length ? await scoreReplies(access.key, post, plain, { author, extra, examples: examples.length ? examples : null, signal: controller.signal }) : { scores: {}, invalid: [], tokens: 0 };
    }
    const { scores, invalid = [], tokens, marked = {} } = res;
    controller.signal.throwIfAborted();
    const fingerprints = new Map(queries.map((q) => [q.id, q.fingerprint]));
    for (const r of missing) if (scores[r.id]) out[r.id] = scores[r.id];
    const fresh = missing.filter((r) => scores[r.id] && !noCache.has(r.id))
      .map((r) => ({ id: r.id, post: postId, fingerprint: fingerprints.get(r.id), scores: scores[r.id] }));
    // "是不是同一类"的分另存（指纹里带着样例，标了新的就不算）；五问的分里不带它
    for (const q of mq) if (typeof marked[q.reply] === "number") {
      fresh.push({ id: q.id, post: postId, fingerprint: q.fingerprint, scores: { marked: marked[q.reply] } });
      if (out[q.reply]) out[q.reply] = { ...out[q.reply], marked: marked[q.reply] };
    }
    await withMarked(out);
    if (ask.length) { // 一条都不用问（没字、图也没读到）时没发请求：不算一次调用、也不能当成 key 好用（0.28.8，review）
      bump({ jev_calls: 1, jev_replies: ask.length, tokens, ...(nImages ? { jev_images: nImages } : {}) }).catch(() => {});
      health("jev", null).catch(() => {});
    }
    try {
      const result = await cache.putMany(fresh, current.settings.cacheMB * 1024 * 1024);
      if (result.evicted) bump({ cache_evicted: result.evicted }).catch(() => {});
    } catch { /* 本次评分仍有效，缓存写失败不影响阅读 */ }
    // 部分回复的答案无效：有效的照常返回和缓存，无效的报可重试，内容脚本会单独重试这几条
    if (invalid.length) return { scores: out, error: `Jev 返回了不完整或无效的分数（${invalid.length} 条）`, code: "invalid_response", retryable: true };
    return { scores: out };
  } catch (e) {
    if (e?.tokens) bump({ tokens: e.tokens }).catch(() => {}); // 答案全坏也收了费
    return noteFailure(failure(e, out));
  } finally {
    controllers.delete(controller);
    if (acquired) release();
  }
}

// 刚标了一条垃圾（0.26）：这一页上没清理的回复问一遍"是不是和标记过的同一类"，一个请求最多 MARKED_BATCH 条。
// 只在标记那一下发（平时这一问并进五问的请求），缓存里有的不问
async function handleMarked({ postId, post, author, replies }, site = null) {
  if (!site || !Array.isArray(replies) || !replies.length || replies.length > 200 || !replies.every((r) => r && typeof r.id === "string" && typeof r.text === "string")) {
    return { error: "无效的回复批次", code: "invalid_request", retryable: false };
  }
  const examples = await feedback.examplesFor(site, MARKED_MAX);
  if (!examples.length) return { scores: {} };
  const access = await permission(undefined, site);
  if (access.error) return access;
  const list = replies.filter((r) => r.text.trim()).map((r) => ({ id: r.id, name: r.name || "", handle: r.handle || "", text: r.text }));
  const queries = await markedRequests(postId, post, list, author, examples);
  const out = {};
  try { const hit = await cache.getMany(queries); for (const q of queries) if (typeof hit[q.id]?.marked === "number") out[q.reply] = hit[q.id].marked; } catch { /* 当没命中 */ }
  const missing = list.filter((r) => out[r.id] == null);
  const qOf = new Map(queries.map((q) => [q.reply, q]));
  for (let i = 0; i < missing.length; i += MARKED_BATCH) {
    const part = missing.slice(i, i + MARKED_BATCH);
    const controller = new AbortController();
    controllers.add(controller);
    let acquired = false;
    try {
      await slot(controller.signal);
      acquired = true;
      const { scores, tokens } = await askMarked(access.key, post, part, { author, examples, signal: controller.signal });
      Object.assign(out, scores);
      bump({ jev_calls: 1, jev_replies: part.length, tokens }).catch(() => {});
      await cache.putMany(part.filter((r) => typeof scores[r.id] === "number").map((r) => ({ id: qOf.get(r.id).id, post: postId, fingerprint: qOf.get(r.id).fingerprint, scores: { marked: scores[r.id] } })),
        access.settings.cacheMB * 1024 * 1024).catch(() => {});
    } catch (e) {
      return { ...noteFailure(failure(e)), scores: out }; // key 无效、余额不足也记下（0.28.8 以前这里不记）
    } finally {
      controllers.delete(controller);
      if (acquired) release();
    }
  }
  return { scores: out };
}

// 帖子本身的几问（求推荐帖 rec，见 jev.js 的 POST_QUESTIONS）：一个帖子问一次，和回复的分存在同一个缓存里
// （键是 "post:" + 帖子的键，指纹里有问题、帖子原文和作者，换了就不命中）
async function handlePost({ postId, post, author }, site = null) {
  if (typeof postId !== "string" || !postId || postId.length > 200 || typeof post !== "string" || !post.trim()) {
    return { error: "无效的帖子", code: "invalid_request", retryable: false };
  }
  const revision = configRevision;
  const access = await permission(undefined, site);
  if (access.error) return access;
  const controller = new AbortController();
  controllers.add(controller);
  let acquired = false;
  try {
    if (revision !== configRevision) throw cancelled();
    const query = { id: `post:${postId}`, post: postId, fingerprint: await postFingerprint(postId, post, author) };
    try {
      const hit = (await cache.getMany([query]))[query.id];
      if (validPostScores(hit)) return { scores: hit };
    } catch { /* 缓存坏了就当未命中 */ }
    await slot(controller.signal);
    acquired = true;
    const current = await permission(access.key, site);
    if (current.error) return current;
    controller.signal.throwIfAborted();
    const { scores, tokens } = await askPost(access.key, post, author, { signal: controller.signal });
    controller.signal.throwIfAborted();
    bump({ jev_calls: 1, tokens }).catch(() => {});
    health("jev", null).catch(() => {});
    try {
      const result = await cache.putMany([{ id: query.id, post: postId, fingerprint: query.fingerprint, scores }], current.settings.cacheMB * 1024 * 1024);
      if (result.evicted) bump({ cache_evicted: result.evicted }).catch(() => {});
    } catch { /* 这次的结果照常用，缓存写失败不影响 */ }
    return { scores };
  } catch (e) {
    return noteFailure(failure(e));
  } finally {
    controllers.delete(controller);
    if (acquired) release();
  }
}

// ---- 翻译增强（translate.js 发来，translator.js 判断和重译 / 帖子页补翻）：最多 16 个请求同时做（所有标签页一起算）----
// 0.13.13 以前是 4：实测（GPT-6 Luna，24 个短标题，一条一个请求）4 条同时 8.9 秒、8 条 4.8 秒、16 条 4.4 秒，单条 1.5 秒左右。
// 0.19.4 起 16：短的几条拼一个请求以后（translateFillBatch），请求少了、每个长一点，同时 16 个比 8 个快得多（Hacker News 40 条评论
// 9.1 → 5.3 秒）。花费只看翻了多少，和同时几个无关
const TX_MAX = 16;
const txControllers = new Set();
let txInflight = 0;
const txWaiters = [];
async function txSlot(signal) {
  if (txInflight < TX_MAX) { txInflight++; return; }
  await new Promise((resolve, reject) => {
    const w = { resolve, abort: () => { const i = txWaiters.indexOf(w); if (i >= 0) txWaiters.splice(i, 1); reject(signal.reason); } };
    signal.addEventListener("abort", w.abort, { once: true });
    txWaiters.push(w);
  });
}
function txRelease() {
  const w = txWaiters.shift();
  if (w) w.resolve(); else txInflight--;
}
// 排到翻译位置以后再看一眼 key 换没换（0.28.8，review）：读 key 和登记可取消之间换了 key 的，换 key 时取消不到它，
// 用旧 key 发出去回 401，又把弹窗的"key 无效"记了回去（刚换上的好 key 被说成无效）
async function sameKeys(or, jev) {
  if ((await orKey()) !== or || (jev !== undefined && (await apiKey()) !== jev)) throw cancelled();
}
// target：X 把帖子翻成的语言（X 的界面语言），比如 zh、en、ja、zh-TW、pt-BR；没给就当简体中文（0.7 的页面脚本）
const validLang = (l) => l == null || (typeof l === "string" && /^[a-z]{2,3}(-[a-z0-9]{2,8}){0,2}$/i.test(l));
const validTx = (m) => typeof m.id === "string" && /^\d{1,25}$/.test(m.id) && typeof m.source === "string" && m.source.trim() &&
  m.source.length <= 5000 && typeof m.xText === "string" && m.xText.trim() && m.xText.length <= 5000 &&
  (m.srcLang == null || (typeof m.srcLang === "string" && /^[a-z-]{2,8}$/i.test(m.srcLang))) && validLang(m.target);
async function handleTranslate(msg, site = null) {
  if (!validTx(msg)) return { error: "无效的翻译请求", code: "invalid_request", retryable: false };
  const [st, jevKey, key] = await Promise.all([settings(site), apiKey(), orKey()]);
  if (!st.translate) return { error: "disabled", code: "disabled", retryable: false };
  if (!jevKey) return { error: "nokey", code: "nokey", retryable: false };
  if (!key) return { error: "noorkey", code: "noorkey", retryable: false };
  const controller = new AbortController();
  txControllers.add(controller);
  let acquired = false;
  try {
    await txSlot(controller.signal);
    acquired = true;
    await sameKeys(key, jevKey);
    const r = await translator.improve({ jevKey, orKey: key, settings: st, signal: controller.signal,
      item: { id: msg.id, source: msg.source, xText: msg.xText, srcLang: msg.srcLang, target: msg.target || "zh" } });
    if (r.cached) bump({ tx_cached: 1 }).catch(() => {});
    else {
      bump({ tx_judged: 1, tx_retranslated: r.tried ? 1 : 0, tx_retried: r.retried ? 1 : 0, tx_replaced: r.action === "replace" ? 1 : 0,
        tx_usd: r.cost || 0, tx_jev_tokens: r.jevTokens || 0 }).catch(() => {});
      health("jev", null).catch(() => {});
      if (r.tried) health("or", null).catch(() => {});
    }
    return r;
  } catch (e) {
    // 已经付了费的（重译翻好了、后面判分出错）照样记进花费（0.28.8 以前整个丢掉，费用少算）
    if (e?.spent) bump({ tx_usd: e.spent.cost || 0, tx_jev_tokens: e.spent.jevTokens || 0 }).catch(() => {});
    return noteFailure(failure(e));
  } finally {
    txControllers.delete(controller);
    if (acquired) txRelease();
  }
}
// 帖子页补翻（主帖被 X 翻译了、作者自己的回复没翻）：只要 OpenRouter key，不判分
// id：X 的帖子是数字，Reddit 的评论 / 帖子是 t1_… / t3_…
// part：Reddit 上很长的正文切成几块分开翻（rtranslate.js），这是第几块；只有第 0 块（或者没切的）算一条"补翻"，花费每块都记
// markup：原文带标记（链接、格式，见 richtext.js）；alt：上一次主模型把标记弄乱了，这次直接用后备模型翻
const validFill = (m) => typeof m.id === "string" && SITE_ID.test(m.id) && typeof m.source === "string" && m.source.trim() &&
  m.source.length <= 5000 && (m.srcLang == null || (typeof m.srcLang === "string" && /^[a-z-]{2,8}$/i.test(m.srcLang))) &&
  (m.truncated == null || typeof m.truncated === "boolean") && (m.part == null || (Number.isInteger(m.part) && m.part >= 0 && m.part < 200)) &&
  (m.markup == null || typeof m.markup === "boolean") && (m.alt == null || typeof m.alt === "boolean") && validLang(m.target);
// 这一条用哪套设置（alt：直接用后备模型，没有另外的后备模型就照主模型）、发给翻译的是什么
const fillSettings = (st, msg) => (msg.alt && st.translateFallback && st.translateFallback !== st.translateModel ? { ...st, translateModel: st.translateFallback, translateFallback: "" } : st);
const fillItem = (msg) => ({ id: msg.id, source: msg.source, srcLang: msg.srcLang, truncated: !!msg.truncated, markup: !!msg.markup, target: msg.target || "zh" });
// "补翻作者自己的回复"那个开关只管 X 的帖子页；Reddit、Hacker News 这些站点上的翻译（id 不是纯数字）只看翻译总开关
const fillOff = (st, msg) => !st.translate || (!st.translateFill && /^\d/.test(msg.id));
async function handleFill(msg, site = null) {
  if (!validFill(msg)) return { error: "无效的翻译请求", code: "invalid_request", retryable: false };
  const [st, key] = await Promise.all([settings(site), orKey()]);
  if (fillOff(st, msg)) return { error: "disabled", code: "disabled", retryable: false };
  if (!key) return { error: "noorkey", code: "noorkey", retryable: false };
  const one = !msg.part ? 1 : 0;
  // 先查缓存：命中的不用排队等那几个翻译位置（以前要排在正在翻的长帖后面）
  const hit = await translator.fillCached({ settings: fillSettings(st, msg), item: fillItem(msg) });
  if (hit) { bump({ tx_fill_cached: one }).catch(() => {}); return hit; }
  const controller = new AbortController();
  txControllers.add(controller);
  let acquired = false;
  try {
    await txSlot(controller.signal);
    acquired = true;
    await sameKeys(key);
    const r = await translator.fillIn({ orKey: key, settings: fillSettings(st, msg), signal: controller.signal, item: fillItem(msg), flex: msg.flex === true });
    bump(r.cached ? { tx_fill_cached: one } : { tx_fill: one, tx_usd: r.cost || 0 }).catch(() => {});
    if (!r.cached) health("or", null).catch(() => {});
    return r;
  } catch (e) {
    return noteFailure(failure(e));
  } finally {
    txControllers.delete(controller);
    if (acquired) txRelease();
  }
}

// 几条一起补翻（0.19.4，tx_engine.js 把短的拼起来发）：2–8 条、合计不超过 6000 字、同一个目标语言、都不是"换后备模型重翻"的。
// 先一条条查缓存，没命中的拼成一个请求（占一个翻译位置）；只剩一条没命中就照单条翻。返回 {results}，和 items 一一对应；
// 模型回来的少了某一条：那一条给 {code: "batch_miss"}，页面那头单独再发。
// rid：流式，哪条先译完就先推给发来的那个页面（chrome.tabs.sendMessage {type: "txPart", rid, k, result}，按 documentId 发，
// 页面换了就发不到），页面那头先换上；最后返回的 results 照样全有（推不到、没开流式的也不缺）
const validFillBatch = (m) => Array.isArray(m.items) && m.items.length >= 2 && m.items.length <= 8 && (m.rid == null || (typeof m.rid === "string" && /^[\w:.-]{1,64}$/.test(m.rid))) &&
  m.items.every((x) => x && typeof x === "object" && validFill(x) && !x.alt && (x.target || "zh") === (m.items[0].target || "zh")) &&
  m.items.reduce((n, x) => n + x.source.length, 0) <= 6000;
// 推给发来的那个页面（那个文档）；没有 tabs 接口、页面没了都不管
function partSender(msg, sender) {
  const tabId = sender?.tab?.id;
  if (!msg.rid || tabId == null || !globalThis.chrome?.tabs?.sendMessage) return null;
  const to = sender.documentId ? { documentId: sender.documentId } : { frameId: sender.frameId || 0 };
  return (k, result) => {
    try { Promise.resolve(chrome.tabs.sendMessage(tabId, { type: "txPart", rid: msg.rid, k, result }, to)).catch(() => {}); } catch { /* 页面没了 */ }
  };
}
async function handleFillBatch(msg, sender, site = null) {
  if (!validFillBatch(msg)) return { error: "无效的翻译请求", code: "invalid_request", retryable: false };
  const [st, key] = await Promise.all([settings(site), orKey()]);
  if (!key) return { error: "noorkey", code: "noorkey", retryable: false };
  const results = msg.items.map((m) => (fillOff(st, m) ? { error: "disabled", code: "disabled", retryable: false } : null));
  const want = [];
  await Promise.all(msg.items.map(async (m, k) => {
    if (results[k]) return;
    const hit = await translator.fillCached({ settings: st, item: fillItem(m) });
    if (hit) results[k] = hit; else want.push(k);
  }));
  const cachedOnes = msg.items.filter((m, k) => results[k]?.cached && !m.part).length;
  if (cachedOnes) bump({ tx_fill_cached: cachedOnes }).catch(() => {});
  if (!want.length) return { results };
  want.sort((a, b) => a - b);
  const controller = new AbortController();
  txControllers.add(controller);
  let acquired = false;
  try {
    await txSlot(controller.signal);
    acquired = true;
    await sameKeys(key);
    const items = want.map((k) => fillItem(msg.items[k]));
    const push = items.length > 1 ? partSender(msg, sender) : null;
    const flex = msg.flex === true; // 页面那头说这一批都不在屏幕上（预翻译）：走 flex
    const got = items.length === 1 ? [await translator.fillIn({ orKey: key, settings: st, signal: controller.signal, item: items[0], flex })]
      : await translator.fillInBatch({ orKey: key, settings: st, signal: controller.signal, items, flex, onItem: push && ((j, r) => push(want[j], r)) });
    let fills = 0, usd = 0;
    want.forEach((k, j) => {
      const r = got[j];
      results[k] = r || { error: "批量翻译里少了这一条", code: "batch_miss", retryable: true };
      if (r && !r.cached) { usd += r.cost || 0; if (!msg.items[k].part) fills++; }
    });
    if (fills || usd) bump({ tx_fill: fills, tx_usd: usd }).catch(() => {});
    health("or", null).catch(() => {});
    return { results };
  } catch (e) {
    return noteFailure(failure(e)); // 整批出错（超时、key 不对……）：页面那头每一条都按这个错处理
  } finally {
    txControllers.delete(controller);
    if (acquired) txRelease();
  }
}

// 插件自己的页面（设置页、引导页、弹窗）发来的：网址是 chrome-extension://本插件/…（网站页面里的内容脚本发来的，网址是那个网站的）
function fromExtension(sender) {
  try { return !!sender && typeof sender.url === "string" && sender.url.startsWith(chrome.runtime.getURL("")); } catch { return false; }
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 哪个网站的页面发来的（弹窗、设置页、测试页不是网站：用默认的那一份设置）
  const site = siteOf(sender && sender.url);
  (async () => {
    switch (msg.type) {
      case "settings":
        return { settings: await settings(), hasKey: !!(await apiKey()), hasOrKey: !!(await orKey()) };
      case "jev":
        return await handleJev(msg, site);
      case "jevPost":
        return await handlePost(msg, site);
      case "markedCheck":
        return await handleMarked(msg, site);
      case "cachedForPost": {
        // 旧内容脚本只有 postId，无法验证回复正文，不能返回旧分数。
        if (!validBatch(msg.replies)) return { scores: {} };
        const queries = await cacheRequests(msg.postId, msg.post, withImages(msg.replies, await imagesOn(await settings(site))), msg.author, msg.extra);
        const scores = await cache.getMany(queries);
        const ex = cleanExtra(msg.extra), need = new Map(msg.replies.map((r) => [r.id, [...ex, ...askOf(r, ex)]]));
        for (const id of Object.keys(scores)) if (!validScores(scores[id], need.get(id))) delete scores[id];
        // "是不是和标记过的同一类"缓存里有的也带上（只查缓存，不发请求）
        const examples = site ? await feedback.examplesFor(site, MARKED_MAX).catch(() => []) : [];
        if (examples.length && Object.keys(scores).length) {
          const mq = await markedRequests(msg.postId, msg.post, msg.replies, msg.author, examples);
          const hit = await cache.getMany(mq).catch(() => ({}));
          for (const q of mq) if (scores[q.reply] && typeof hit[q.id]?.marked === "number") scores[q.reply] = { ...scores[q.reply], marked: hit[q.id].marked };
        }
        return { scores };
      }
      case "cacheStats": // 过滤结果（Jev）和译文的缓存分开报
        return { ...(await cache.stats()), tx: await translator.idbCache.stats().catch(() => null) };
      case "cacheClear":
        await cache.clear();
        return { ok: true };
      case "stat": { // 只收计数（0.28.8，review：以前什么都收，字符串会和数字拼起来把统计永久弄坏）
        const d = msg.delta && typeof msg.delta === "object" ? Object.fromEntries(Object.entries(msg.delta)
          .filter(([k, v]) => /^[a-z][a-z0-9_]{0,40}$/.test(k) && Number.isFinite(v) && v >= 0 && v <= 1e6).slice(0, 20)) : {};
        if (Object.keys(d).length) await bump(d);
        return { ok: true };
      }
      case "folded": // 0.28.5 起不存了；升级时还没刷新的页面照样会发，回个 ok
        return { ok: true };
      case "theme": { // 工具栏图标跟浏览器的深浅色（页面报的，见 theme.js）
        const t = msg.dark ? "dark" : "icon";
        if (t !== themeNow && chrome.action && chrome.action.setIcon) {
          themeNow = t;
          await chrome.action.setIcon({ path: { 16: `icons/${t}-16.png`, 32: `icons/${t}-32.png` } }).catch(() => { themeNow = null; });
        }
        return { ok: true, theme: themeNow };
      }
      case "replyOverrides":
        return { overrides: await feedback.getOverrides(msg.ids || []) };
      case "feedback": {
        const label = await feedback.saveDecision(msg.entry, site || "");
        // 用户决定是主写入，诊断日志失败不能声称纠错也没保存。
        try {
          // 日志只记认得的几项（0.28.8 以前整个 entry 原样记）
          const e = msg.entry || {}, str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
          await log({ id: str(e.id, 120), postId: str(e.postId, 200), label: str(e.label, 30), kind: str(e.kind, 30), handle: str(e.handle, 60),
            text: str(e.text, 300), ...(Number.isFinite(e.score) ? { score: e.score } : {}) });
          if (/^[a-z_]{1,30}$/.test(e.label || "")) await bump({ [`fb_${e.label}`]: 1 });
          return { ok: true, label };
        } catch (e) { return { ok: true, label, warning: String(e) }; }
      }
      case "sloganList":
        return { slogans: await feedback.listSlogans() };
      case "sloganRemember":
        await feedback.rememberSlogan(msg.entry, site || "");
        bump({ slogan_learned: 1 }).catch(() => {});
        return { ok: true };
      case "sloganRemove":
        await feedback.removeSlogan(msg.text, msg.id || null);
        return { ok: true };
      case "markUndo":
        await feedback.undoMark(msg.id);
        return { ok: true };
      case "sloganClear":
        await feedback.clearSlogans();
        return { ok: true };
      case "setKey": { // 设置页、引导页存 key（0.28.12）：只收插件自己的页面发来的，网站页面里的内容脚本不行
        if (!fromExtension(sender)) return { error: "不是插件自己的页面", code: "invalid_request", retryable: false };
        if ((msg.which !== "jev" && msg.which !== "or") || typeof msg.value !== "string" || msg.value.length > 500) return { error: "无效的 key", code: "invalid_request", retryable: false };
        await storeKey(msg.which, msg.value);
        return { ok: true };
      }
      case "testKey": {
        const key = (typeof msg.key === "string" && msg.key.trim() ? msg.key : await apiKey()).trim(); // 没给（或空的）：测存着的那个
        if (!key) return { ok: false, error: "没有 key", code: "nokey" };
        const controller = new AbortController();
        controllers.add(controller);
        let acquired = false;
        try {
          await slot(controller.signal);
          acquired = true;
          // 示例用你界面语言的一句典型拉人回复（设置页传 lang 过来）
          const zh = /^zh/i.test(String(msg.lang || "zh"));
          const sample = zh ? "想赚钱的私信我，带你上车" : "DM me if you want to make money, I'll show you how";
          const { scores, tokens, model } = await scoreReplies(key, zh ? "测试" : "test", [{ id: "t1", text: sample }], { retries: 2, signal: controller.signal });
          if (key === await apiKey()) health("jev", null).catch(() => {});
          return { ok: true, model, tokens, score: scores.t1, sample };
        } catch (e) {
          const f = failure(e);
          if (key === await apiKey()) noteFailure(f);
          return { ok: false, ...f };
        } finally {
          controllers.delete(controller);
          if (acquired) release();
        }
      }
      case "translate":
        return await handleTranslate(msg, site);
      case "translateFill":
        return await handleFill(msg, site);
      case "translateFillBatch":
        return await handleFillBatch(msg, sender, site);
      // 一页上要翻的一次查完缓存（Reddit：再打开看过的帖子，译文一次全换上，不用一块块排队）；只查不翻，没命中的给 null
      case "fillCachedBatch": {
        if (!Array.isArray(msg.items) || msg.items.length > 100) return { error: "无效的翻译请求", code: "invalid_request" };
        const st = await settings(site);
        let hits = 0;
        const results = await Promise.all(msg.items.map(async (m) => {
          if (!m || typeof m !== "object" || !validFill(m) || fillOff(st, m)) return null;
          const r = await translator.fillCached({ settings: fillSettings(st, m), item: fillItem(m) });
          if (r && !m.part) hits++;
          return r;
        }));
        if (hits) bump({ tx_fill_cached: hits }).catch(() => {});
        return { results };
      }
      case "orTest": {
        const key = (typeof msg.key === "string" && msg.key.trim() ? msg.key : await orKey()).trim();
        if (!key) return { ok: false, error: "没有 OpenRouter key", code: "noorkey" };
        const st = await settings();
        try {
          // 测连接：把一句英文翻成你的语言（设置页传浏览器语言过来）；你的语言就是英文时改用一句西班牙语
          const target = validLang(msg.target) && msg.target ? msg.target : "zh";
          const sample = /^en\b/i.test(target) ? { source: "La verdad, esta actualización lo cambia todo.", srcLang: "es" }
            : { source: "Not gonna lie, this update is a game changer.", srcLang: "en" };
          const r = await translator.translate(key, st, { ...sample, target });
          if (key === await orKey()) health("or", null).catch(() => {});
          return { ok: true, model: r.model, secs: r.secs, text: r.text, reasoningTokens: r.reasoningTokens };
        } catch (e) {
          if (key === await orKey()) noteFailure({ code: e.code });
          return { ok: false, error: String(e.message || e), code: e.code };
        }
      }
      case "txCacheClear":
        await translator.idbCache.clear();
        return { ok: true };
      case "export": { // 0.28.5：也导出你标记的垃圾、每条纠正（以前漏了）；key 不导出
        const all = await chrome.storage.local.get(null);
        const data = Object.fromEntries(Object.entries(all).filter(([k]) => ["ff_stats", "ff_log", "ff_settings", "ff_confirmed_slogans"].includes(k) || k.startsWith("ff_reply_override:")));
        return { data, pricePerToken: PRICE_PER_TOKEN };
      }
      case "clearLog": { // 清空统计和记录：0.28.5 起连你的纠正（"不是垃圾""漏判了"）也清掉（用户 10-19 定；以前特意留着，界面上删不掉）。
        // 你标记的垃圾是另一份列表，在设置里单独删
        const clearing = Promise.all([statChain, logChain]).then(async () => {
          await feedback.clearOverrides();
          await chrome.storage.local.set({ ff_log: [], ff_stats: {} });
        });
        statChain = logChain = clearing.catch(() => {});
        await clearing;
        return { ok: true };
      }
      default:
        return { error: "unknown" };
    }
  })().then(sendResponse, (e) => sendResponse({ error: String(e) }));
  return true; // 异步 sendResponse
});
