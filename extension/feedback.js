// 用户决定独立于诊断日志：日志有条数上限，不能承担永久纠错。
import "./rules.js";
const R = globalThis.FFRules;
const PREFIX = "ff_reply_override:";
const SLOGANS = "ff_confirmed_slogans";
const LABELS = new Set(["fp", "missed", "missed_abuse", "missed_sexual"]);
const validId = (id) => typeof id === "string" && /^[\w.-]{1,110}$/.test(id); // YouTube 回复的评论 id 里有点
let chain = Promise.resolve();
function write(fn) {
  const result = chain.then(fn);
  chain = result.catch(() => {});
  return result;
}
function decision(entry) {
  if (LABELS.has(entry.label)) return entry.label;
  if (entry.label === "confirm") {
    if (["abuse", "user_abuse"].includes(entry.kind)) return "missed_abuse";
    if (["sexual", "user_sexual"].includes(entry.kind)) return "missed_sexual";
    return "missed";
  }
  throw new Error("不支持的回复标注");
}

let migration;
function initialize() {
  if (!migration) migration = write(async () => {
    const { ff_feedback_rev, ff_log = [] } = await chrome.storage.local.get(["ff_feedback_rev", "ff_log"]);
    if (ff_feedback_rev === 1) return;
    const old = {};
    for (const entry of ff_log) {
      if (!validId(entry.id)) continue;
      try { old[PREFIX + entry.id] = { label: decision(entry), updatedAt: Date.parse(entry.ts) || 0, postId: entry.postId }; }
      catch { /* 诊断事件不是用户决定 */ }
    }
    const current = await chrome.storage.local.get(Object.keys(old));
    for (const key of Object.keys(current)) delete old[key];
    // 旧 ff_slogans 混有自动学习结果，保留原数据但不能把它迁移成用户确认。
    await chrome.storage.local.set({ ...old, ff_feedback_rev: 1 });
  }).catch((error) => { migration = null; throw error; });
  return migration;
}

// 每条纠正一个键：超过 OVERRIDE_MAX 条删最早的（0.28.5，review：以前一直攒、界面上删不掉；隐私政策写的是"最近 3000 条"）
async function capOverrides() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(PREFIX));
  if (keys.length <= OVERRIDE_MAX) return;
  keys.sort((a, b) => (all[a]?.updatedAt || 0) - (all[b]?.updatedAt || 0));
  await chrome.storage.local.remove(keys.slice(0, keys.length - OVERRIDE_MAX));
}
// 设置里"清空统计和记录"：纠正一起清掉（0.28.5，用户 10-19 定）；旧日志也一起清了，不再从它迁移
export function clearOverrides() {
  return write(async () => {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith(PREFIX));
    if (keys.length) await chrome.storage.local.remove(keys);
    await chrome.storage.local.set({ ff_feedback_rev: 1 });
  });
}

export async function getOverrides(ids) {
  await initialize();
  const keys = [...new Set(ids.filter(validId))].map((id) => PREFIX + id);
  const data = await chrome.storage.local.get(keys);
  return Object.fromEntries(Object.entries(data).filter(([, value]) => LABELS.has(value?.label))
    .map(([key, value]) => [key.slice(PREFIX.length), value.label]));
}

// site：哪个网站上标的（background 按发消息的页面认，见 siteOf）。手动清理掉一条没被清理的（label "missed"，0.26 起）同时记进"你标记的垃圾"；
// 点"判错了"（fp）的那条要是在里面，一起删掉。清理条上点"判对了"（label "confirm"）也存成 missed，但不算标记（0.28.5，review：
// 以前 decision() 换算以后的 missed 也进了标记，违背用户定的"只有手动清理和漏斗算标记"）
const OVERRIDE_MAX = 3000;
export async function saveDecision(entry, site = "") {
  if (!entry || !validId(entry.id)) throw new Error("回复编号无效");
  const label = decision(entry);
  await initialize();
  return write(async () => {
    const updates = { [PREFIX + entry.id]: { label, updatedAt: Date.now(), postId: entry.postId } };
    if (label === "fp") {
      const n = R.normSlogan(entry.text || "");
      updates[SLOGANS] = (await listSlogans()).filter((x) => !(x.text === n && R.sloganOk(n)) && x.source?.id !== entry.id);
    } else if (entry.label === "missed" && marked(entry, site)) updates[SLOGANS] = withMarked(await listSlogans(), marked(entry, site));
    await chrome.storage.local.set(updates);
    await capOverrides();
    return label;
  });
}
// 撤销手动清理（清理后那句提示上的"撤销"）：纠错记录和"你标记的垃圾"里这一条都删掉
export async function undoMark(id) {
  if (!validId(id)) throw new Error("回复编号无效");
  await initialize();
  return write(async () => {
    await chrome.storage.local.remove(PREFIX + id);
    await chrome.storage.local.set({ [SLOGANS]: (await listSlogans()).filter((x) => x.source?.id !== id) });
  });
}

// 你标记的垃圾（0.26 起；以前叫"你记住的句子"，键和格式沿用、旧的照样生效）。一条 {text, raw, site, source: {postId, id, handle}, createdAt}：
// text 去掉表情、标点、链接后的那句，够长的（sloganOk）在哪都一字不差地认；raw 原文（≤ 300 字），连同账号当样例发给 Jev，
// 问别的回复是不是同一类（见 jev.js 的 MARKED_QUESTION）。太短、一字不差认不了的（"@某某 看这个😍"）也留着当样例。旧的只有 text（没有 raw、site）
const MARK_MAX = 500;
const keyOf = (x) => (R.sloganOk(x.text) ? x.text : `id:${x.source?.id || ""}`);
function marked(entry, site) {
  const raw = String(entry?.text || "").replace(/\s+/g, " ").trim().slice(0, 300), text = R.normSlogan(raw);
  if (!validId(entry?.id) || !(R.sloganOk(text) || /\p{L}/u.test(raw))) return null;
  // links：全文里的链接（0.28.6：原文只存前 300 字，后面的联系方式靠它认，见 rules.js 的 markedPrep）
  const links = [...R.markLinks(String(entry?.text || ""))].slice(0, 10);
  return { text, raw, ...(links.length ? { links } : {}), site: typeof site === "string" ? site : "", source: { postId: entry.postId, id: entry.id, handle: entry.handle || "" }, createdAt: Date.now() };
}
const withMarked = (list, item) => [...list.filter((x) => keyOf(x) !== keyOf(item) && x.source?.id !== item.source.id), item].slice(-MARK_MAX);
export async function listSlogans() {
  const data = await chrome.storage.local.get(SLOGANS);
  return (Array.isArray(data[SLOGANS]) ? data[SLOGANS] : []).filter((x) => x && typeof x.text === "string" && (R.sloganOk(x.text) || (typeof x.raw === "string" && x.raw.trim())));
}
// 发给 Jev 的样例：这个网站上标的（旧的没记网站，哪儿都算），最近的 n 条
// 只用这个网站上标的（0.28.5：以前 0.26 以前没记网站的旧条目哪个网站都发，隐私政策写的是"那个网站上的"）
export async function examplesFor(site, n = 20) {
  return (await listSlogans()).filter((x) => x.site && x.site === site).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, n)
    .map((x) => ({ handle: x.source?.handle || "", text: x.raw || x.text }));
}
export function rememberSlogan(entry, site = "") {
  const item = marked(entry, site);
  if (!item) return Promise.reject(new Error("这条不能标记"));
  return write(async () => { await chrome.storage.local.set({ [SLOGANS]: withMarked(await listSlogans(), item) }); });
}
// 按那句话删（够长的才认得出是同一句），或者按标的是哪一条（id）删
export function removeSlogan(text, id = null) {
  return write(async () => {
    const slogans = (await listSlogans()).filter((x) => !((R.sloganOk(text || "") && x.text === text) || (id && x.source?.id === id)));
    await chrome.storage.local.set({ [SLOGANS]: slogans });
  });
}
export function clearSlogans() {
  return write(() => chrome.storage.local.set({ [SLOGANS]: [] }));
}
