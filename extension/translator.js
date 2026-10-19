// 翻译增强（后台）。两件事：
// ① 改进（improve）：X 自带（Grok）的译文先交给 Jev 判三问（忠实 / 完整 / 地道），三问最低分低于阈值才用
//    OpenRouter 重译；重译的再判一次，比 Grok 的至少高 margin 才换上。结果按"帖子 id + 原文 + Grok 译文 + 目标语言 + 模型"缓存 30 天。
// ② 补翻（fillIn）：X 翻译了主帖、却没翻作者自己的回复时，直接用 OpenRouter 翻（没有 Grok 译文可比，不判分）。
// 目标语言（target）就是 X 把帖子翻成的语言（X 的界面语言），页面那头传过来。简体中文用 translate_eval 里验证过的中文提示词
// 和问法；别的语言用同样规则的英文模板（问法里引用 `target_language`）。
// 模型调用一律不开思考（reasoning.enabled = false）：有的模型不设就默认思考（Haiku 5.5 默认中档），又慢又贵，
// 还有的思考关不掉（Gemini 3.8 Flash、Sonnet 5.5 会报 400），这种直接当失败、换后备模型。
// 问法、提示词、阈值的依据见 feed-filter/translate_eval（合成集三问最低分 AUC 1.000；真实 X 帖 64 条上 GPT-6 Luna
// 比 Grok 好 15 条、差 0 条）。
import { askJev } from "./jev.js";

export const OR_API = "https://openrouter.ai/api/v1/chat/completions";
export const TRANSLATOR_VERSION = "tx2", FILL_VERSION = "fill2"; // 2：缓存键里加了目标语言
// 语言名用 Intl.DisplayNames（service worker 和 Node 都有）；X 有几个老代码（in = 印尼语、iw = 希伯来语）
const LEGACY = { in: "id", iw: "he", ji: "yi" };
function langName(code, inLang) {
  const c = LEGACY[String(code || "").toLowerCase()] || code;
  try { return new Intl.DisplayNames([inLang], { type: "language" }).of(c) || code; } catch { return code || ""; }
}
const ZH_HANS = /^zh(-(cn|sg|my|hans)\b.*)?$/i, ZH_HANT = /^zh-(tw|hk|mo|hant)\b/i;
export const isZhHans = (target) => ZH_HANS.test(target || "");
// 目标语言的英文名（给模型和 Jev 看）
export function targetName(target) {
  if (isZhHans(target)) return "Simplified Chinese";
  if (ZH_HANT.test(target || "")) return "Traditional Chinese";
  return langName(target, "en") || "English";
}

// 和 translate_eval/jev_judge.py 一字不差（阈值是用它定的）
export const JUDGE_QUESTIONS = {
  faithful: "Does `translation` express the same meaning as `source` - the same facts, numbers, names, " +
    "negation and stance (including sarcasm and jokes) - without mistranslating, distorting or adding anything?",
  complete: "Does `translation` include everything in `source` - every sentence and clause, every number, " +
    "@mention, #hashtag, $cashtag, link and meaningful emoji - with nothing dropped and nothing left untranslated?",
  natural: "Does `translation` read as natural, idiomatic Simplified Chinese that a native speaker would write on " +
    "social media, rather than stiff word-for-word translationese?",
};
// 别的目标语言：同样三问，"地道"那一问改成引用 state 里的 `target_language`
export const JUDGE_QUESTIONS_ANY = {
  ...JUDGE_QUESTIONS,
  natural: "Does `translation` read as natural, idiomatic `target_language` that a native speaker would write on " +
    "social media, rather than stiff word-for-word translationese?",
};
// 和 translate_eval/or_bench.py 一字不差
export const SYSTEM_PROMPT = `你是资深的社交媒体译者，把 X（推特）上的帖子翻成简体中文，给中文用户在信息流里读。
要求：
1. 全部翻完：每一句、每个数字、每条列表都要在，不漏、不加、不解释。只输出译文本身。
2. @账号、#话题、$股票代码、链接、emoji、代码、版本号原样保留；产品名、人名没有通行译名时保留原文。
3. 用自然的中文网络口语，像中文用户自己写的；俚语、玩笑、反讽、双关按意思翻，不要逐字直译，语气要保留（粗口就用中文粗口）。
4. 保留原文的换行和列表结构。`;
// 别的目标语言：同样四条规则的英文模板
export const systemPromptFor = (name) => `You are an experienced social media translator. Translate posts from X (Twitter) into ${name} for people reading them in their feed.
Rules:
1. Translate everything: every sentence, number and list item must be there - nothing dropped, added or explained. Output only the translation.
2. Keep @handles, #hashtags, $cashtags, links, emoji, code and version numbers exactly as they are; keep product and personal names in the original when there is no established ${name} name.
3. Write natural, casual ${name} the way native speakers post online. Translate slang, jokes, sarcasm and puns by meaning, not word for word, and keep the tone (swearing stays swearing).
4. Keep the original line breaks and list structure.`;

// YouTube 字幕（0.29.0）：YouTube 自己的"自动翻译"一行一行地翻，一句话跨两三行的就翻碎了（一行几乎是空的、下一行塞进整句）。
// 这里把连着的几十行一起交给模型，当成一段连续的话翻，每一行的意思还放回它自己那个标记里（时间轴不变）
export const CAPTION_SYSTEM_ZH = `你是资深的视频字幕译者，把 YouTube 视频的字幕翻成简体中文。
要求：
1. 下面是同一个视频里连着的几行字幕，每行用 <c1>…</c1> 这样的标记包着。当成一段连续的话来理解和翻译，一句话跨几行的按整句翻顺。
2. 每一行的译文放回它自己的标记里，每个标记出现一次、按原来的顺序；为了每行读起来通顺，可以在相邻的两行之间挪几个词，但不要把整句挪走、不要合并或拆开标记。
3. 全部翻完，不漏、不加、不解释；人名、产品名没有通行译名时保留原文；用自然的中文口语，像中文字幕组写的。只输出带标记的译文。`;
export const captionSystemFor = (name) => `You are an experienced subtitle translator. Translate YouTube video subtitles into ${name}.
Rules:
1. Below are consecutive subtitle lines from one video, each wrapped in a marker like <c1>…</c1>. Read and translate them as one continuous piece of speech; a sentence that spans several lines is translated as a whole sentence.
2. Put each line's translation back in its own marker - every marker exactly once, in the original order. You may move a few words between neighbouring lines so each one reads naturally, but never move a whole sentence and never merge or split markers.
3. Translate everything - nothing dropped, added or explained; keep personal and product names in the original when there is no established ${name} name; write natural spoken ${name} like a good subtitle team. Output only the translated, marked lines.`;

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); reject(signal.reason); }, { once: true });
});
const fail = (message, code, retryable) => Object.assign(new Error(message), { code, retryable });

export async function judge(jevKey, { source, translation, srcLang, target = "zh" }, opts = {}) {
  const state = { source_language: (srcLang && langName(srcLang, "en")) || "unknown", target_language: targetName(target), source, translation };
  const { scores, tokens } = await askJev(jevKey, state, isZhHans(target) ? JUDGE_QUESTIONS : JUDGE_QUESTIONS_ANY, opts);
  return { scores, min: Math.min(...Object.values(scores)), tokens };
}

// 模型有时会给整段加引号或"译文："前缀；再多的格式问题交给 Jev 判（判下来不更好就不换）
export function cleanOutput(text) {
  let t = String(text || "").trim().replace(/^(译文|翻译|中文译文|Translation|Translated text)\s*[:：]\s*/i, "");
  const pairs = [["“", "”"], ["\"", "\""], ["「", "」"]];
  for (const [a, b] of pairs) if (t.startsWith(a) && t.endsWith(b) && t.length > 2 && !t.slice(1, -1).includes(b)) t = t.slice(1, -1).trim();
  return t;
}

// truncated：X 只显示了前一截（"显示更多"还没点开），告诉模型别替作者补完后半句
// markup：原文带着标记（Reddit 上的链接、加粗、列表这些，见 richtext.js）：<p1>…</p1> 一段，<t1>…</t1> 链接或格式（里面的字要翻），
// <x1/> 原样保留的东西（网址、代码、表情）。让模型原样留着，页面那头照标记把链接和格式拼回去
export const MARKUP_ZH = "原文带标记：<p1>…</p1> 是一段；<t1>…</t1> 是原文里的链接、加粗这类格式，里面的字要翻；<x1/> 是原样保留的东西（网址、代码、表情）。" +
  "每个标记都要出现在译文里，一个不少、不加新的，名字、编号、成对、嵌套都不变；<tN> 包住的是和原文那几个词对应的译文；只翻标记之间的文字；一段对一段，不合并、不拆开。";
export const MARKUP_EN = "The text carries markers: <p1>…</p1> is a paragraph; <t1>…</t1> wraps a link or formatting in the original - translate the words inside; " +
  "<x1/> stands for something kept as is (a URL, code, an emoji). Every marker must appear in your translation - none dropped, none added, same names and numbers, " +
  "same pairing and nesting - and each <tN> must wrap the words that translate the words it wrapped in the original. Translate only the text between markers; " +
  "one paragraph for one paragraph, never merge or split them.";
// batch：几条互不相干的短内容拼成一个请求（0.19.4，见 fillInBatch），每条用 <u1>…</u1> 包着，译文照样包着回来
export const BATCH_ZH = "下面是几条互不相干的内容，每条用 <u1>…</u1> 这样的标记包着。每一条单独翻；译文也用同样的标记包着，按原来的顺序，" +
  "每个标记出现一次、不多不少；不要把一条的内容挪到另一条，不要合并、拆开。";
export const BATCH_EN = "Below are several unrelated items, each wrapped in a marker like <u1>…</u1>. Translate each item on its own and wrap each translation " +
  "in the same marker, in the original order, every marker exactly once; never move content between items, merge them or split them.";
// onText：流式（0.19.4，只有几条一起翻的用）——请求带 stream: true，每来一段字就 onText(到现在为止的全文)，几条里先译完的那条先换上；
// 回来的不是事件流（比如中间的代理不支持）就照整段的读
// 不急的请求走 OpenAI 的 flex 通道（0.28.4，用户 10-19："兼顾成本和速度，可见区域的用标准的，不可见预翻译的可以用 flex"）：
// 同一个模型、半价（OpenRouter 上 openai/gpt-6-luna 的 openai/flex 端点 $0.05 / $0.25 每百万 token，标准 $0.10 / $0.50），
// OpenAI 忙的时候排在后面、可能没资源。2026-10-19 量的（30 条真实评论 / 30 条长帖，8 路并发）：flex 中位 1.96 s / 2.59 s、
// 最慢 3.1 s / 4.3 s，标准 2.26 s / 3.51 s、最慢 3.7 s / 6.5 s，都 30/30 成功。只有 OpenAI 的模型有 flex（后备的 DeepSeek 没有）。
// provider.order 先排 flex、allow_fallbacks 让 OpenRouter 在 flex 出错时自己换标准端点；FLEX_WAIT_MS 还没出字（流式的第一段 /
// 不流式的整个回复）就放弃 flex、改走标准通道（translate() 里，不算一次重试）。`:batch` 变体不能走 chat/completions（404），用不了。
// 0.28.5：flex 的请求一律流式——不流式的 OpenRouter 2–3 s 就先回头、再塞空白占着连接（实测），"回复头到了"不等于开始出字，
// 计时形同虚设；流式的第一段字到了才算开始，而且中途放弃时 OpenRouter 会叫上游停下、不再计费
const FLEX_OK = /^openai\//, FLEX_WAIT_MS = 10000;
export async function translateOnce(orKey, model, { source, srcLang, truncated, markup, batch, captions, target = "zh" }, { signal, fetchImpl = fetch, timeoutMs = 20000, onText, flex = false, flexWaitMs = FLEX_WAIT_MS } = {}) {
  const control = new AbortController();
  const stop = () => control.abort(signal.reason);
  signal?.addEventListener("abort", stop, { once: true });
  if (signal?.aborted) stop();
  const timer = setTimeout(() => control.abort(fail("翻译请求超时", "timeout", true)), timeoutMs);
  flex = flex && FLEX_OK.test(model);
  let slow = flex ? setTimeout(() => control.abort(fail("flex 通道太慢", "flex_slow", true)), flexWaitMs) : 0;
  const started = () => { if (slow) { clearTimeout(slow); slow = 0; } };
  if (flex && !onText) onText = () => {}; // flex 一律流式（见上）
  const wantStream = !!onText;
  if (onText && slow) { const f = onText; onText = (...a) => { started(); return f(...a); }; }
  const t0 = Date.now();
  try {
    const resp = await fetchImpl(OR_API, {
      method: "POST",
      // OpenRouter 认应用的两个头（用量统计里显示是谁在调）：名字和主页
      // 不带 X-Title / HTTP-Referer（0.28.8，review：OpenRouter 拿它们按应用汇总用量、可能公开排名，和"什么都不发给我们"对不上）
      headers: { Authorization: `Bearer ${orKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // 上限给足（按实际输出计费，给大了不多花钱）：中文译文的 token 数和英文原文的字数差不多，长帖 2000 不够用
        model, temperature: 0.2, max_tokens: Math.min(8000, Math.max(400, source.length * 2 + 300)),
        reasoning: { enabled: false }, usage: { include: true }, ...(wantStream ? { stream: true } : {}),
        ...(flex ? { provider: { order: ["openai/flex"], allow_fallbacks: true } } : {}),
        messages: captions
          ? [{ role: "system", content: isZhHans(target) ? CAPTION_SYSTEM_ZH : captionSystemFor(targetName(target)) },
            { role: "user", content: isZhHans(target) ? `字幕原文（${(srcLang && langName(srcLang, "zh-CN")) || "外语"}）：\n${source}` : `Subtitles (${(srcLang && langName(srcLang, "en")) || "another language"}):\n${source}` }]
          : isZhHans(target)
          ? [{ role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `${batch ? BATCH_ZH + "\n" : ""}${markup ? MARKUP_ZH + "\n" : ""}原文（${(srcLang && langName(srcLang, "zh-CN")) || "外语"}${truncated ? "，后面被截断了：只翻这一段，末尾加“…”，不要补全" : ""}）：\n${source}` }]
          : [{ role: "system", content: systemPromptFor(targetName(target)) },
            { role: "user", content: `${batch ? BATCH_EN + "\n" : ""}${markup ? MARKUP_EN + "\n" : ""}Original (${(srcLang && langName(srcLang, "en")) || "another language"}${truncated ? "; it is cut off here - translate only this part, end with “…”, and do not complete it" : ""}):\n${source}` }],
      }),
      signal: control.signal,
    });
    if (!resp.ok) {
      const body = (await resp.text()).slice(0, 200);
      if (resp.status === 401) throw fail(`OpenRouter key 无效（${body}）`, "or_badkey", false);
      if (resp.status === 402) throw fail(`OpenRouter 余额不足（${body}）`, "or_credit", false);
      throw fail(`OpenRouter HTTP ${resp.status}: ${body}`, "or_http", resp.status === 429 || resp.status >= 500);
    }
    const streamed = wantStream && resp.body && /event-stream/i.test(resp.headers.get("content-type") || "");
    if (!streamed) started(); // 不流式的：回复头到了就是整个回复好了
    const data = streamed ? await readStream(resp, onText) : await resp.json();
    const text = cleanOutput(data?.choices?.[0]?.message?.content);
    if (!text) throw fail("模型没有返回译文", "or_empty", true);
    // 输出到了上限被截断：这份译文不全，不能用（再试一次，还不行换后备模型）
    if (data.choices[0].finish_reason === "length") throw fail("模型输出被截断", "or_truncated", true);
    const u = data.usage || {};
    return { text, model: data.model || model, cost: Number.isFinite(u.cost) ? u.cost : 0,
      reasoningTokens: u.completion_tokens_details?.reasoning_tokens || 0, secs: (Date.now() - t0) / 1000 };
  } catch (e) {
    if (signal?.aborted) throw signal.reason;
    if (control.signal.aborted && ["timeout", "flex_slow"].includes(control.signal.reason?.code)) throw control.signal.reason;
    throw e;
  } finally {
    clearTimeout(timer); started(); // started()：清掉 flex 的计时

    signal?.removeEventListener("abort", stop);
  }
}

// 读 OpenRouter 的事件流：一行一个 "data: {…}"，最后 "data: [DONE]"，": OPENROUTER PROCESSING" 这类注释行跳过；
// 字在 choices[0].delta.content 里一段段来，花费（usage）在最后一段。中途出错（带 error）当可重试的错。拼成和整段回来一样的样子
async function readStream(resp, onText) {
  const reader = resp.body.getReader(), dec = new TextDecoder();
  let buf = "", content = "", finish = null, model = null, usage = null;
  const line = (l) => {
    if (!l.startsWith("data:")) return;
    const p = l.slice(5).trim();
    if (!p || p === "[DONE]") return;
    let j;
    try { j = JSON.parse(p); } catch { return; }
    if (j.error) throw fail(`OpenRouter 出错：${String(j.error.message || j.error).slice(0, 200)}`, "or_http", true);
    if (j.model) model = j.model;
    if (j.usage) usage = j.usage;
    const ch = j.choices?.[0];
    if (ch?.finish_reason) finish = ch.finish_reason;
    if (ch?.delta?.content) {
      content += ch.delta.content;
      try { onText(content); } catch { /* 那头出错不影响翻译 */ }
    }
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      for (let i; (i = buf.indexOf("\n")) >= 0; buf = buf.slice(i + 1)) line(buf.slice(0, i).trim());
    }
    line((buf + dec.decode()).trim());
  } catch (e) {
    reader.cancel().catch(() => {}); // 不再读了：连接放掉
    throw e;
  }
  return { model, usage, choices: [{ message: { content }, finish_reason: finish }] };
}

// 主模型一次、可重试的错误再一次，还不行换后备模型；key 无效、余额不足不换（换了也一样）。
// opts.flex：不急的（不在屏幕上的预翻译、X 上改进 Grok 译文）先走 flex 通道，出错或太慢马上改走标准通道（不等、不算一次重试）
// 返回里多两项：slug（设置里的模型名，OpenRouter 回报的 model 可能带日期之类，不能拿来比）、tried（试过的模型）
// flex 只在通道的问题上换标准：忙（429、5xx）、超时、太慢、网络断了；输出被截断、空的（or_truncated、or_empty）、400 这种
// 换通道也一样，照常重试或换后备（0.28.5，review：以前截断也换通道，一条翻坏的长帖能付 5 次钱）
const laneIssue = (e) => !e.code || e.code === "timeout" || e.code === "flex_slow" || (e.code === "or_http" && e.retryable);
export async function translate(orKey, settings, item, opts = {}) {
  const models = [settings.translateModel, settings.translateFallback].filter((m, i, a) => m && a.indexOf(m) === i);
  const tried = [];
  let last;
  for (const model of models) {
    tried.push(model);
    let flex = !!opts.flex && FLEX_OK.test(model);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await translateOnce(orKey, model, item, { ...opts, flex, ...(opts.onText ? { onText: (text) => opts.onText(text, model) } : {}) });
        return { ...r, slug: model, tried: [...tried] };
      } catch (e) {
        if (opts.signal?.aborted) throw e;
        last = e;
        if (e.code === "or_badkey" || e.code === "or_credit") throw e;
        if (flex && laneIssue(e)) { flex = false; attempt--; continue; }
        if (!e.retryable) break; // 比如这个模型的思考关不掉（400）：直接换后备
        await sleep(600 * (attempt + 1), opts.signal);
      }
    }
  }
  throw last || fail("没有可用的翻译模型", "or_model", false);
}

// ---------- 缓存：IndexedDB ff-translate，按占的地方算上限（设置里的 txCacheMB，默认 50 MB，和 Jev 结果的缓存分开算）----------
// 每条 {key, result, ts, size}；size 和 Jev 缓存一样估算（JSON 长度 + 64）。总量记在 meta 里，超过上限就按最后用到的时间
// 从旧到新删到上限的九成。读到时把时间刷新成现在（超过一天才刷，少写几次）：常看的留着，30 天没用过才过期。
// 0.13.6 以前按条数算（5000 条、后来 20000 条），用户觉得少，要按地方算（0.13.7）
const DB = "ff-translate", STORE = "tx", META = "meta", TTL = 30 * 86400e3, DEFAULT_CAP_MB = 50;
export const capOf = (settings) => (Number(settings?.txCacheMB) || DEFAULT_CAP_MB) * 1048576;
const sizeOf = (rec) => JSON.stringify(rec).length + 64;
let dbp = null;
function open() {
  if (!dbp) dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (e.oldVersion < 1) db.createObjectStore(STORE, { keyPath: "key" }).createIndex("ts", "ts");
      if (e.oldVersion < 2) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbp = null; reject(req.error); };
  });
  return dbp;
}
const reqp = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error); });
// 总量（字节、条数）；从旧版（没记总量）升上来的第一次用时数一遍
async function totals(tx) {
  const meta = tx.objectStore(META), st = tx.objectStore(STORE);
  const [bytes, count] = await Promise.all([reqp(meta.get("bytes")), reqp(meta.get("count"))]);
  if (Number.isFinite(bytes) && Number.isFinite(count)) return [bytes, count];
  let b = 0, n = 0;
  await new Promise((res, rej) => {
    const cur = st.openCursor();
    cur.onsuccess = () => { const c = cur.result; if (!c) return res(); b += c.value.size || sizeOf(c.value); n++; c.continue(); };
    cur.onerror = () => rej(cur.error);
  });
  meta.put(b, "bytes"); meta.put(n, "count");
  return [b, n];
}
export const idbCache = {
  async get(key) {
    const db = await open();
    const rec = await reqp(db.transaction(STORE, "readonly").objectStore(STORE).get(key));
    if (!rec || Date.now() - rec.ts >= TTL) return null;
    if (Date.now() - rec.ts > 86400e3) { // 刷新时间（大小不变，不用动总量），不等它写完
      try { db.transaction(STORE, "readwrite").objectStore(STORE).put({ ...rec, ts: Date.now() }); } catch { /* 写不进就算了 */ }
    }
    return rec.result;
  },
  async put(key, result, capBytes = DEFAULT_CAP_MB * 1048576) {
    const db = await open();
    const tx = db.transaction([STORE, META], "readwrite"), st = tx.objectStore(STORE), meta = tx.objectStore(META);
    let [bytes, count] = await totals(tx);
    const old = await reqp(st.get(key));
    if (old) { bytes -= old.size || sizeOf(old); count--; }
    const rec = { key, result, ts: Date.now() };
    rec.size = sizeOf(rec);
    st.put(rec);
    bytes += rec.size; count++;
    if (bytes > capBytes) await new Promise((res, rej) => { // 超了：最久没用的先删，删到上限的九成
      const cur = st.index("ts").openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c || bytes <= capBytes * 0.9) return res();
        if (c.value.key !== key) { bytes -= c.value.size || sizeOf(c.value); count--; c.delete(); }
        c.continue();
      };
      cur.onerror = () => rej(cur.error);
    });
    meta.put(Math.max(bytes, 0), "bytes"); meta.put(Math.max(count, 0), "count");
    await done(tx);
  },
  // 超过 TTL 没用过的真删掉（0.28.5，隐私政策：译文 30 天没用到就删；以前只是读的时候不用）；返回删了几条
  async purgeExpired(now = Date.now()) {
    const db = await open();
    const tx = db.transaction([STORE, META], "readwrite"), st = tx.objectStore(STORE), meta = tx.objectStore(META);
    let [bytes, count] = await totals(tx), removed = 0;
    await new Promise((res, rej) => {
      const cur = st.index("ts").openCursor(IDBKeyRange.upperBound(now - TTL));
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return res();
        bytes -= c.value.size || sizeOf(c.value); count--; removed++;
        c.delete(); c.continue();
      };
      cur.onerror = () => rej(cur.error);
    });
    meta.put(Math.max(bytes, 0), "bytes"); meta.put(Math.max(count, 0), "count");
    await done(tx);
    return removed;
  },
  async stats() {
    const db = await open();
    const tx = db.transaction([STORE, META], "readwrite");
    const [bytes, count] = await totals(tx);
    await done(tx);
    return { bytes, count };
  },
  async clear() {
    const db = await open();
    const tx = db.transaction([STORE, META], "readwrite");
    tx.objectStore(STORE).clear();
    tx.objectStore(META).put(0, "bytes"); tx.objectStore(META).put(0, "count");
    await done(tx);
  },
};

async function sha256(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, "0")).join("");
}

// 补翻（X 帖子页的补翻、Reddit 上的翻译）的缓存键：原文、截没截断、目标语言、模型、带不带标记（原文语言不在里面：同一段字认成哪种语言都一样）
const fillKey = (item, settings) => sha256(JSON.stringify([FILL_VERSION, item.id, item.source, !!item.truncated, item.target || "zh", settings.translateModel, ...(item.markup ? ["markup"] : [])]));
// 只查缓存、不翻：有就返回（带 cached: true），没有返回 null
export async function fillCached({ settings, item, cache = idbCache }) {
  try {
    const hit = await cache.get(await fillKey(item, settings));
    return hit ? { ...hit, cached: true } : null;
  } catch { return null; } // 缓存坏了就当没命中
}
// 帖子页补翻：item: {id, source, srcLang, truncated}；返回 {action: "fill", text, model, cost, cached}
export async function fillIn({ orKey, settings, item, cache = idbCache, signal, fetchImpl, flex = false }) {
  const key = await fillKey(item, settings);
  try {
    const hit = await cache.get(key);
    if (hit) return { ...hit, cached: true };
  } catch { /* 缓存坏了就当没命中 */ }
  const ours = await translate(orKey, settings, item, { signal, fetchImpl, flex });
  const result = { action: "fill", text: ours.text, model: ours.model, cost: ours.cost };
  try { await cache.put(key, result, capOf(settings)); } catch { /* 写不进缓存也照样返回 */ }
  return { ...result, cached: false };
}

// 几条一起补翻（0.19.4）：Hacker News 首页 30 个标题一条一个请求要 7 秒左右翻完（同时 8 个请求），4–5 条拼一个请求、同时 16 个，3 秒以内；
// 评论（几百个字）一条一个请求 40 条 13 秒，4 条 / 1200 字一个请求、同时 16 个 5 秒（真模型 GPT-6 Luna 量的，见 README 0.19.4）。
// items 都是缓存里没有的（后台先查过）；每条用 <uN> 包着发，回来按标记拆，每条照单条补翻的键存进缓存（以后单独查也命中）。
// 返回和 items 一一对应：拆得出来的 {action: "fill", text, model, cost, cached: false}，少了的、重复的是 null（页面那头单独再翻一次）。
// 纯文字的条目（标题）不该带标记，模型要是加了就去掉。
// onItem(k, 结果)：流式，第 k 条（从 0 数）的 </uN> 一到就先给（4 个标题一批，第一条 1.3 秒、整批 2 秒左右才完）；先给了的就定了，
// 后面同一个标记再出现（模型重复了）也不改。整批出错时先给了的照样进缓存。花费最后才知道：先给的不带，返回的带
export async function fillInBatch({ orKey, settings, items, cache = idbCache, signal, fetchImpl, onItem, flex = false }) {
  const source = items.map((it, k) => `<u${k + 1}>${it.source}</u${k + 1}>`).join("\n");
  const langs = new Set(items.map((it) => it.srcLang || ""));
  const unit = (it, text) => { // 一条的译文：纯文字的去掉标记、去掉多余的引号和前缀
    if (text && !it.markup) text = text.replace(/<\/?[pt]\d+>|<x\d+\/>/g, "");
    return text ? cleanOutput(text) : "";
  };
  const early = new Map(); // 流式先给了的：k → {text, model}
  const onText = onItem && ((all, model) => {
    for (const m of all.matchAll(/<u(\d+)>([\s\S]*?)<\/u\1>/g)) {
      const k = Number(m[1]) - 1;
      if (early.has(k) || !items[k]) continue;
      const text = unit(items[k], m[2]);
      if (!text) continue;
      early.set(k, { text, model });
      try { onItem(k, { action: "fill", text, model, cost: 0, cached: false }); } catch { /* 那头出错不影响 */ }
    }
  });
  const put = async (it, result) => { try { await cache.put(await fillKey(it, settings), result, capOf(settings)); } catch { /* 写不进缓存也照样返回 */ } };
  let r;
  try {
    r = await translate(orKey, settings, { source, srcLang: langs.size === 1 ? items[0].srcLang : null, markup: items.some((it) => it.markup),
      batch: items.length, target: items[0].target }, { signal, fetchImpl, onText, flex });
  } catch (e) {
    await Promise.all([...early].map(([k, x]) => put(items[k], { action: "fill", ...x, cost: 0 })));
    throw e;
  }
  const got = new Map();
  let odd = false;
  for (const m of r.text.matchAll(/<u(\d+)>([\s\S]*?)<\/u\1>/g)) {
    const k = Number(m[1]) - 1;
    if (k < 0 || k >= items.length) { odd = true; continue; }
    got.set(k, got.has(k) ? null : m[2]);
  }
  // 同一个标记出现两次、或者冒出不该有的标记（0.28.7，review：一条评论能诱导模型给同批别人那条先回一段假的，流式时先到的就定了、
  // 还进了 30 天缓存）：重复的那几条不认先给的、不进缓存，返回 null（页面那头撤掉先换上的、单独再翻）；有不该有的标记时整批都这样
  const keep = items.map((it, k) => !odd && got.get(k) !== null && !!(early.get(k)?.text || unit(it, got.get(k))));
  const n = keep.filter(Boolean).length;
  const cost = n ? r.cost / n : 0; // 花费摊给回来了的几条（以前按总条数摊，少了的那几条的份没记上）
  return Promise.all(items.map(async (it, k) => {
    if (!keep[k]) return null;
    const e = early.get(k), text = e ? e.text : unit(it, got.get(k));
    const result = { action: "fill", text, model: e ? e.model : r.model, cost };
    await put(it, result);
    return { ...result, cached: false };
  }));
}

// YouTube 字幕一段（连着的几十行，0.29.0）：lines 是这几行原文，返回 {lines（一一对应的译文）, model, cost, cached}。
// 模型回来的标记对不上（少了、多了、重复）：换后备模型再翻一次，还不对就报错（页面那头照旧用 YouTube 的）。缓存按这几行原文、目标语言、模型
export const CAPTION_VERSION = "cap1";
export async function translateCaptions({ orKey, settings, lines, srcLang, target = "zh", cache = idbCache, signal, fetchImpl, flex = false }) {
  const key = await sha256(JSON.stringify([CAPTION_VERSION, settings.translateModel, settings.translateFallback || "", target, srcLang || "", lines]));
  try { const hit = await cache.get(key); if (hit && Array.isArray(hit.lines) && hit.lines.length === lines.length) return { ...hit, cached: true }; } catch { /* 当没命中 */ }
  const source = lines.map((l, k) => `<c${k + 1}>${String(l).replace(/\s*\n\s*/g, " ").trim()}</c${k + 1}>`).join("\n");
  const parse = (text) => {
    const got = new Map();
    for (const m of String(text).matchAll(/<c(\d+)>([\s\S]*?)<\/c\1>/g)) {
      const k = Number(m[1]) - 1;
      if (k < 0 || k >= lines.length || got.has(k)) return null;
      got.set(k, cleanOutput(m[2]).replace(/\s*\n\s*/g, " "));
    }
    return got.size === lines.length ? lines.map((_, k) => got.get(k)) : null;
  };
  let cost = 0, last = null, err = null;
  const models = [settings.translateModel, settings.translateFallback].filter((m, i, a) => m && a.indexOf(m) === i);
  for (const model of models) {
    let r;
    try { r = await translate(orKey, { ...settings, translateModel: model, translateFallback: "" }, { source, srcLang, captions: true, target }, { signal, fetchImpl, flex }); }
    catch (e) { if (signal?.aborted || e.code === "or_badkey" || e.code === "or_credit") throw e; err = e; continue; } // 这个模型出错：换后备模型
    cost += r.cost || 0;
    const out = parse(r.text);
    if (out) {
      const result = { lines: out, model: r.model, cost };
      try { await cache.put(key, result, capOf(settings)); } catch { /* 写不进也照样用 */ }
      return { ...result, cached: false };
    }
    last = r.model;
  }
  if (err && !last) throw err;
  throw Object.assign(new Error(`字幕译文的标记对不上（${last || "?"}）`), { code: "or_captions", retryable: false, spent: { cost } });
}
// 判 YouTube 自动翻译的字幕好不好（0.29.0）：前面一段原文和 YouTube 的译文整段交给 Jev 判（和判 X 的 Grok 译文同一套问题），结果缓存
export async function judgeCaptions({ jevKey, settings, item, cache = idbCache, signal, fetchImpl }) {
  const key = await sha256(JSON.stringify([CAPTION_VERSION, "judge", item.source, item.translation, item.srcLang || "", item.target || "zh"]));
  try { const hit = await cache.get(key); if (hit && Number.isFinite(hit.min)) return { ...hit, tokens: 0, cached: true }; } catch { /* 当没命中 */ }
  const g = await judge(jevKey, item, { signal, fetchImpl });
  const result = { min: g.min, scores: g.scores };
  try { await cache.put(key, result, capOf(settings)); } catch { /* 写不进也照样用 */ }
  return { ...result, tokens: g.tokens, cached: false };
}

// item: {id, source, xText, srcLang, target}；返回 {action: "keep" | "replace", text?, model?, weak?（Grok 哪一问最差）, grok, ours?,
// retried?（换另一个模型又翻了一次）, cost, jevTokens, cached}
export async function improve({ jevKey, orKey, settings, item, cache = idbCache, signal, fetchImpl }) {
  const key = await sha256(JSON.stringify([TRANSLATOR_VERSION, item.id, item.source, item.xText, item.target || "zh", settings.translateModel,
    settings.translateThreshold, settings.translateMargin]));
  try {
    const hit = await cache.get(key);
    if (hit) return { ...hit, cached: true };
  } catch { /* 缓存坏了就当没命中 */ }
  const jevOpts = { signal, fetchImpl };
  // Grok 那次判分单独缓存（0.28.8，review）：后面重译、再判出错时整个结果写不进缓存，页面过 30 秒重试又要付一次判分
  const gkey = await sha256(JSON.stringify([TRANSLATOR_VERSION, "grok", item.source, item.xText, item.srcLang || "", item.target || "zh"]));
  let grok = null;
  try { const g = await cache.get(gkey); if (g && g.scores && Number.isFinite(g.min)) grok = { ...g, tokens: 0 }; } catch { /* 当没命中 */ }
  if (!grok) {
    grok = await judge(jevKey, { source: item.source, translation: item.xText, srcLang: item.srcLang, target: item.target }, jevOpts);
    try { await cache.put(gkey, { scores: grok.scores, min: grok.min }, capOf(settings)); } catch { /* 写不进也照样用 */ }
  }
  let result;
  if (grok.min >= settings.translateThreshold) {
    result = { action: "keep", grok: grok.scores, grokMin: grok.min, cost: 0, jevTokens: grok.tokens };
  } else {
    let spent = { cost: 0, jevTokens: grok.tokens };
    try {
      // 改进 Grok 的译文不急（页面上已经是 Grok 的译文了）：走 flex
      let pick = await translate(orKey, settings, item, { signal, fetchImpl, flex: true });
      spent.cost = pick.cost || 0;
      let judged = await judge(jevKey, { source: item.source, translation: pick.text, srcLang: item.srcLang, target: item.target }, jevOpts);
      let cost = pick.cost || 0, jevTokens = grok.tokens + judged.tokens, retried = false;
      // 重译的反倒比 Grok 还差：换另一个模型（主模型 / 后备模型里没用过的那个）再翻一次，两份里取分高的（0.28.3，用户 10-18：
      // 同一条韩文帖子 Luna 两次翻出来一次 0.40、一次 0.61，Grok 0.53。translate_eval 的数据上重译的 31 条里有 2 条比 Grok 还差，
      // DeepSeek 再翻救回 1 条）。只有这种时候多花一次翻译和一次判分；再翻出错就用第一份
      // 另一个：设置里的两个模型里没试过的那个（按 translate() 返回的 tried 认，不按 OpenRouter 回报的 model 名）
      const other = [settings.translateModel, settings.translateFallback].find((m) => m && !(pick.tried || [pick.model]).includes(m));
      if (judged.min < grok.min && other) {
        try {
          const again = await translate(orKey, { ...settings, translateModel: other, translateFallback: null }, item, { signal, fetchImpl, flex: true });
          cost += again.cost || 0; spent.cost += again.cost || 0; retried = true; // 翻好就记（后面判分出错也付过了）
          const j2 = await judge(jevKey, { source: item.source, translation: again.text, srcLang: item.srcLang, target: item.target }, jevOpts);
          jevTokens += j2.tokens;
          if (j2.min > judged.min) { pick = again; judged = j2; }
        } catch (e) { if (signal?.aborted) throw e; }
      }
      const weakest = Object.entries(grok.scores).sort((a, b) => a[1] - b[1])[0][0];
      const better = judged.min - grok.min >= settings.translateMargin - 1e-9; // 0.75 − 0.65 在浮点里比 0.1 小一点
      result = {
        action: better ? "replace" : "keep", tried: true, retried, text: better ? pick.text : undefined, model: pick.model,
        weak: weakest, grok: grok.scores, grokMin: grok.min, ours: judged.scores, oursMin: judged.min, cost, jevTokens,
      };
    } catch (e) { if (e && typeof e === "object" && (spent.cost || spent.jevTokens)) e.spent = spent; throw e; } // 付过的费跟着错误回去记账
  }
  try { await cache.put(key, result, capOf(settings)); } catch { /* 写不进缓存也照样返回 */ }
  return { ...result, cached: false };
}
