// 清流会员模式（0.30.0）：判断和翻译交给清流的服务器（server/src/features.js），函数和 jev.js / translator.js 里后台用到的那几个同名、
// 同参数、同返回，后台按"走哪条路"挑一个（CLOUD 就是这里）。服务器上有跨用户缓存、按次扣额度；本地缓存照旧先查、翻好的照同一把键存回去，
// 再看同一页不再扣额度。花费在服务器那边记（额度），这里返回的 cost、tokens 都是 0（本地的"本月约 $…"只算自带密钥的）。
import { post, stream, CloudError } from "./account.js";
import * as translator from "./translator.js";

export const CLOUD = Object.freeze({ via: "cf" });
// 服务器用的翻译设置（server/src/features.js 的 TX）：本地缓存键按它算，和自带密钥用默认模型时的键一样，两边翻过的都能用上
export const CLOUD_TX = Object.freeze({ translateModel: "openai/gpt-6-luna", translateFallback: "deepseek/deepseek-v4.1-flash", translateThreshold: 0.7 });
export const settingsFor = (st) => ({ ...st, ...CLOUD_TX });

// 服务器说暂时别再发（没有套餐、额度用完、退出了）：这段时间里不发请求，直接按同样的错处理（每个新页面都去撞一次 402 没意义）。
// 登录、付完款、刷新到能用的状态时清掉（clearBlock）
let block = null;
const BLOCK_MS = { subscription_required: 10 * 60e3, quota_daily: 30 * 60e3, quota_monthly: 6 * 3600e3, signed_out: 24 * 3600e3, trial_paused: 30 * 60e3, paused: 10 * 60e3 };
export const clearBlock = () => { block = null; };
export const blocked = () => (block && Date.now() < block.until ? block.code : null);
async function call(fn) {
  const b = blocked();
  if (b) throw new CloudError(b === "signed_out" ? 401 : 402, b);
  try { return await fn(); } catch (e) {
    if (e instanceof CloudError && BLOCK_MS[e.code]) block = { code: e.code, until: Date.now() + BLOCK_MS[e.code] };
    throw e;
  }
}
const priority = (flex) => (flex ? { priority: "prefetch" } : {});
const putLocal = async (key, result, settings) => { try { await translator.idbCache.put(await key, result, translator.capOf(settings)); } catch { /* 写不进也照样用 */ } };

// ---------- 判断（jev.js 的 scoreReplies / askPost / askMarked） ----------
// route 用不上（就是 CLOUD）；opts.postId 是服务器缓存指纹要的（本地调 jev.js 时不用）
const repliesOut = (rs) => rs.map((r) => ({ id: r.id, name: r.name || "", handle: r.handle || "", text: r.text || "", ...(r.ask?.length ? { ask: r.ask } : {}) }));
export async function scoreReplies(route, post_, replies, { author = null, extra = [], keys, examples = null, signal, postId = "" } = {}) {
  const r = await call(() => post("/v1/judge/replies", {
    post_id: postId || "", post: post_ || "", author, replies: repliesOut(replies), extra, ...(keys ? { keys } : {}), ...(examples?.length ? { examples } : {}),
  }, { signal }));
  return { scores: r.scores || {}, invalid: r.invalid || [], marked: r.marked || {}, tokens: 0 };
}
export async function askPost(route, post_, author, { signal, postId = "" } = {}) {
  const r = await call(() => post("/v1/judge/post", { post_id: postId || "", post: post_, author }, { signal }));
  return { scores: r.scores, tokens: 0 };
}
export async function askMarked(route, post_, replies, { author = null, examples, signal } = {}) {
  const r = await call(() => post("/v1/judge/marked", { post: post_ || "", author, replies: repliesOut(replies), examples }, { signal }));
  return { scores: r.scores || {}, tokens: 0 };
}

// ---------- 翻译（translator.js 的 improve / fillIn / fillInBatch / judgeCaptions / translateCaptions） ----------
const local = async (key) => { try { return await translator.idbCache.get(await key); } catch { return null; } };

export async function improve({ settings, item, signal, flex = false }) {
  const key = translator.improveKey(item, settings);
  const hit = await local(key);
  if (hit) return { ...hit, cached: true };
  const r = await call(() => post("/v1/translate/improve", { id: item.id, source: item.source, x_text: item.xText, src_lang: item.srcLang || null, target: item.target || "zh", ...priority(flex) }, { signal }));
  const result = { action: r.action, ...(r.text ? { text: r.text } : {}), ...(r.model ? { model: r.model } : {}), ...(r.bad ? { bad: r.bad } : {}),
    tried: r.action === "replace" || !!r.bad, retried: !!r.retried, cost: 0, jevTokens: 0 };
  await putLocal(key, result, settings);
  return { ...result, cached: false };
}

const fillOut = (it) => ({ id: it.id, source: it.source, src_lang: it.srcLang || null, truncated: !!it.truncated, ...(it.markup ? { markup: true } : {}) });
export async function fillIn({ settings, item, signal, flex = false }) {
  const hit = await translator.fillCached({ settings, item });
  if (hit) return hit;
  const r = await call(() => post("/v1/translate/fill", { items: [fillOut(item)], target: item.target || "zh", ...priority(flex) }, { signal }));
  const got = r.results?.[0];
  if (!got) throw new CloudError(502, r.errors?.[0] || "upstream_error");
  const result = { action: "fill", text: got.text, model: got.model, cost: 0 };
  await putLocal(translator.fillKey(item, settings), result, settings);
  return { ...result, cached: false };
}
// 几条一起：服务器逐条推（SSE），推到一条就给 onItem、存进本地缓存；返回和 items 一一对应，没翻出来的是 null（页面那头单独再发）
export async function fillInBatch({ settings, items, signal, onItem, flex = false }) {
  const out = items.map(() => null);
  await call(() => stream("/v1/translate/fill", { items: items.map(fillOut), target: items[0]?.target || "zh", ...priority(flex) }, (ev, d) => {
    if (ev !== "item" || !Number.isInteger(d.k) || !items[d.k] || !d.text) return;
    const result = { action: "fill", text: d.text, model: d.model, cost: 0 };
    out[d.k] = { ...result, cached: !!d.cached };
    putLocal(translator.fillKey(items[d.k], settings), result, settings);
    if (onItem) { try { onItem(d.k, out[d.k]); } catch { /* 那头出错不影响 */ } }
  }, { signal }));
  return out;
}

export async function judgeCaptions({ settings, item, signal }) {
  const key = translator.captionJudgeKey(item);
  const hit = await local(key);
  if (hit && Number.isFinite(hit.min)) return { ...hit, tokens: 0, cached: true };
  const r = await call(() => post("/v1/captions/judge", { source: item.source, translation: item.translation, src_lang: item.srcLang || null, target: item.target || "zh" }, { signal }));
  const result = { min: r.min, scores: r.scores };
  await putLocal(key, result, settings);
  return { ...result, tokens: 0, cached: false };
}
export async function translateCaptions({ settings, lines, srcLang, target = "zh", signal, flex = false, onLine }) {
  const key = translator.captionKey({ settings, lines, srcLang, target });
  const hit = await local(key);
  if (hit && Array.isArray(hit.lines) && hit.lines.length === lines.length) return { ...hit, cached: true };
  let done = null;
  await call(() => stream("/v1/captions/translate", { lines, src_lang: srcLang || null, target, ...priority(flex) }, (ev, d) => {
    if (ev === "line" && onLine && Number.isInteger(d.k)) { try { onLine(d.k, d.text); } catch { /* 那头出错不影响 */ } }
    if (ev === "done") done = d;
  }, { signal }));
  if (!done || !Array.isArray(done.lines) || done.lines.length !== lines.length) throw new CloudError(502, "upstream_error");
  const result = { lines: done.lines, model: done.model, cost: 0 };
  await putLocal(key, result, settings);
  return { ...result, cached: false };
}
