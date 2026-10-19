// 翻译增强后台逻辑（translator.js）的离线测试：Jev 和 OpenRouter 都用假的 fetch，缓存用内存，不需要任何 key。
// node test/translator_test.mjs
import assert from "node:assert/strict";
import { improve, fillIn, fillInBatch, fillCached, translate, cleanOutput, OR_API, SYSTEM_PROMPT, BATCH_ZH } from "../translator.js";

const S = { translateThreshold: 0.7, translateMargin: 0.1, translateModel: "openai/gpt-6-luna", translateFallback: "deepseek/deepseek-v4.1-flash" };
const item = { id: "1900000000000000101", source: "Why is it so hard to hire good people? Because the good ones are not for hire!", xText: "为什么雇佣好人这么难？因为好人不是雇佣兵！", srcLang: "en" }; // 合成的
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json" } });
const memCache = () => { const m = new Map(); return { get: async (k) => m.get(k) || null, put: async (k, v) => { m.set(k, v); }, m }; };

// 假网络：Jev 按译文给分（judgeScores(translation) → 三问分），OpenRouter 按 orPlan 回
function fakeNet({ judgeScores, orPlan }) {
  const calls = { jev: [], or: [] };
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    if (url === OR_API) {
      calls.or.push(body);
      const r = orPlan(body, calls.or.length);
      return r instanceof Response ? r : json({ model: body.model, choices: [{ message: { content: r } }], usage: { cost: 0.00004, completion_tokens_details: { reasoning_tokens: 0 } } });
    }
    calls.jev.push(body);
    const sc = judgeScores(body.state.translation);
    return json({ answers: Object.fromEntries(Object.entries(sc).map(([k, v]) => [k, { noul: v }])), usage: { input_tokens: 500 } });
  };
  return { fetchImpl, calls };
}
const good = { faithful: 0.9, complete: 0.88, natural: 0.85 };
const bad = { faithful: 0.3, complete: 0.8, natural: 0.6 };
const out = [];
const ok = (name, fn) => fn().then(() => out.push(`PASS ${name}`), (e) => { out.push(`FAIL ${name}: ${e.stack}`); });

await ok("Grok 译文合格：只判一次，不调模型", async () => {
  const net = fakeNet({ judgeScores: () => good, orPlan: () => { throw new Error("不该调模型"); } });
  const r = await improve({ jevKey: "j", orKey: "o", settings: S, item, cache: memCache(), fetchImpl: net.fetchImpl });
  assert.equal(r.action, "keep"); assert.equal(r.tried, undefined);
  assert.equal(net.calls.jev.length, 1); assert.equal(net.calls.or.length, 0);
  assert.deepEqual(Object.keys(net.calls.jev[0].questions), ["faithful", "complete", "natural"]);
  assert.equal(net.calls.jev[0].state.source, item.source); assert.equal(net.calls.jev[0].state.translation, item.xText);
});

await ok("Grok 不合格、重译明显更好：换上，请求里不开思考", async () => {
  const ours = "为什么好人这么难招？因为真正厉害的人根本不缺工作！";
  const net = fakeNet({ judgeScores: (t) => (t === ours ? good : bad), orPlan: () => ours });
  const r = await improve({ jevKey: "j", orKey: "o", settings: S, item, cache: memCache(), fetchImpl: net.fetchImpl });
  assert.equal(r.action, "replace"); assert.equal(r.text, ours); assert.equal(r.weak, "faithful");
  assert.equal(net.calls.or.length, 1); assert.equal(net.calls.jev.length, 2);
  const body = net.calls.or[0];
  assert.deepEqual(body.reasoning, { enabled: false }, "必须显式关掉思考");
  assert.equal(body.model, "openai/gpt-6-luna");
  assert.equal(body.messages[0].content, SYSTEM_PROMPT);
  assert.ok(body.messages[1].content.includes(item.source) && body.messages[1].content.includes("英语"));
});

await ok("重译分数没高出 margin：不换", async () => {
  const net = fakeNet({ judgeScores: (t) => (t === item.xText ? { ...bad, faithful: 0.62 } : { faithful: 0.68, complete: 0.9, natural: 0.9 }), orPlan: () => "差不多的译文" });
  const r = await improve({ jevKey: "j", orKey: "o", settings: S, item, cache: memCache(), fetchImpl: net.fetchImpl });
  assert.equal(r.action, "keep"); assert.equal(r.tried, true); assert.equal(r.text, undefined);
});

// 0.28.3：重译的反倒比 Grok 还差，换另一个模型再翻一次、两份里取分高的
await ok("重译的比 Grok 还差：换后备模型再翻一次，后备的够好就换上它", async () => {
  const luna = "翻差了的译文", ds = "后备模型翻得好的译文";
  const net = fakeNet({ judgeScores: (t) => (t === item.xText ? { faithful: 0.62, complete: 0.8, natural: 0.7 } : t === luna ? { faithful: 0.5, complete: 0.8, natural: 0.7 } : good),
    orPlan: (body) => (body.model === S.translateModel ? luna : ds) });
  const r = await improve({ jevKey: "j", orKey: "o", settings: S, item, cache: memCache(), fetchImpl: net.fetchImpl });
  assert.equal(r.action, "replace"); assert.equal(r.text, ds); assert.equal(r.model, S.translateFallback); assert.equal(r.retried, true);
  assert.deepEqual(net.calls.or.map((b) => b.model), [S.translateModel, S.translateFallback]);
  assert.equal(net.calls.jev.length, 3); assert.ok(Math.abs(r.cost - 0.00008) < 1e-12, String(r.cost));
});
await ok("重译的比 Grok 还差、后备的也不行：不换（两份里取分高的那份记下）", async () => {
  const luna = "翻差了的译文", ds = "也翻差了的译文";
  const net = fakeNet({ judgeScores: (t) => (t === item.xText ? { faithful: 0.62, complete: 0.8, natural: 0.7 } : t === luna ? { faithful: 0.4, complete: 0.8, natural: 0.7 } : { faithful: 0.55, complete: 0.8, natural: 0.7 }),
    orPlan: (body) => (body.model === S.translateModel ? luna : ds) });
  const r = await improve({ jevKey: "j", orKey: "o", settings: S, item, cache: memCache(), fetchImpl: net.fetchImpl });
  assert.equal(r.action, "keep"); assert.equal(r.retried, true); assert.equal(r.oursMin, 0.55); assert.equal(r.model, S.translateFallback);
});
await ok("重译的比 Grok 好、只是没高出 margin：不再翻", async () => {
  const net = fakeNet({ judgeScores: (t) => (t === item.xText ? { ...bad, faithful: 0.62 } : { faithful: 0.65, complete: 0.9, natural: 0.9 }), orPlan: () => "差不多的译文" });
  const r = await improve({ jevKey: "j", orKey: "o", settings: S, item, cache: memCache(), fetchImpl: net.fetchImpl });
  assert.equal(r.action, "keep"); assert.equal(r.retried, false); assert.equal(net.calls.or.length, 1);
});
await ok("再翻那一次出错：照第一份判，不报错", async () => {
  const luna = "翻差了的译文";
  const net = fakeNet({ judgeScores: (t) => (t === item.xText ? { faithful: 0.62, complete: 0.8, natural: 0.7 } : { faithful: 0.5, complete: 0.8, natural: 0.7 }),
    orPlan: (body) => (body.model === S.translateModel ? luna : json({ error: { message: "bad request" } }, 400)) });
  const r = await improve({ jevKey: "j", orKey: "o", settings: S, item, cache: memCache(), fetchImpl: net.fetchImpl });
  assert.equal(r.action, "keep"); assert.equal(r.retried, false); assert.equal(r.oursMin, 0.5);
});

await ok("主模型 400（思考关不掉之类）：换后备模型", async () => {
  const net = fakeNet({ judgeScores: (t) => (t === item.xText ? bad : good),
    orPlan: (body) => (body.model === "openai/gpt-6-luna" ? json({ error: { message: "Reasoning is mandatory" } }, 400) : "后备的译文") });
  const r = await improve({ jevKey: "j", orKey: "o", settings: S, item, cache: memCache(), fetchImpl: net.fetchImpl });
  assert.equal(r.action, "replace"); assert.equal(r.text, "后备的译文");
  assert.deepEqual(net.calls.or.map((b) => b.model), ["openai/gpt-6-luna", "deepseek/deepseek-v4.1-flash"]);
  assert.ok(net.calls.or.every((b) => b.reasoning.enabled === false));
});

await ok("key 无效：不换后备，直接报 or_badkey", async () => {
  const net = fakeNet({ judgeScores: () => bad, orPlan: () => json({ error: "bad key" }, 401) });
  await assert.rejects(improve({ jevKey: "j", orKey: "o", settings: S, item, cache: memCache(), fetchImpl: net.fetchImpl }), (e) => e.code === "or_badkey");
  assert.equal(net.calls.or.length, 1);
});

await ok("同一条第二次走缓存：不再请求", async () => {
  const cache = memCache();
  const net = fakeNet({ judgeScores: (t) => (t === item.xText ? bad : good), orPlan: () => "缓存测试译文" });
  await improve({ jevKey: "j", orKey: "o", settings: S, item, cache, fetchImpl: net.fetchImpl });
  const n = net.calls.jev.length + net.calls.or.length;
  const r = await improve({ jevKey: "j", orKey: "o", settings: S, item, cache, fetchImpl: net.fetchImpl });
  assert.equal(r.cached, true); assert.equal(r.text, "缓存测试译文");
  assert.equal(net.calls.jev.length + net.calls.or.length, n);
  // Grok 译文变了（比如长帖展开）或换了模型：不算同一条
  await improve({ jevKey: "j", orKey: "o", settings: S, item: { ...item, xText: item.xText + "（展开后）" }, cache, fetchImpl: net.fetchImpl });
  await improve({ jevKey: "j", orKey: "o", settings: { ...S, translateModel: "qwen/qwen3.8-flash" }, item, cache, fetchImpl: net.fetchImpl });
  assert.ok(net.calls.jev.length + net.calls.or.length > n + 2);
});

await ok("中途取消：立即停下", async () => {
  const control = new AbortController();
  const fetchImpl = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true }));
  const p = translate("o", S, item, { signal: control.signal, fetchImpl });
  control.abort(new DOMException("设置已改变", "AbortError"));
  await assert.rejects(p, (e) => e.name === "AbortError");
});

await ok("帖子页补翻：不判分直接翻，不开思考，走缓存", async () => {
  const net = fakeNet({ judgeScores: () => { throw new Error("补翻不该调 Jev"); }, orPlan: () => "还有一件事：老套餐继续能用。" });
  const cache = memCache();
  const reply = { id: "1900000000000000301", source: "And one more thing: the old plan keeps working.", srcLang: "en" };
  const r = await fillIn({ orKey: "o", settings: S, item: reply, cache, fetchImpl: net.fetchImpl });
  assert.equal(r.action, "fill"); assert.equal(r.text, "还有一件事：老套餐继续能用。"); assert.equal(r.cached, false);
  assert.equal(net.calls.jev.length, 0); assert.equal(net.calls.or.length, 1);
  assert.deepEqual(net.calls.or[0].reasoning, { enabled: false });
  assert.ok(!net.calls.or[0].messages[1].content.includes("截断"));
  const again = await fillIn({ orKey: "o", settings: S, item: reply, cache, fetchImpl: net.fetchImpl });
  assert.equal(again.cached, true); assert.equal(net.calls.or.length, 1);
});

await ok("半截长帖：告诉模型被截断了、别补全；和完整的分开缓存", async () => {
  const net = fakeNet({ judgeScores: () => ({}), orPlan: () => "一段译文…" });
  const cache = memCache();
  const cut = { id: "1900000000000000302", source: "We had to trim the context window to make", srcLang: "en", truncated: true };
  await fillIn({ orKey: "o", settings: S, item: cut, cache, fetchImpl: net.fetchImpl });
  assert.ok(net.calls.or[0].messages[1].content.includes("截断") && net.calls.or[0].messages[1].content.includes("不要补全"));
  await fillIn({ orKey: "o", settings: S, item: { ...cut, source: cut.source + " this work.", truncated: false }, cache, fetchImpl: net.fetchImpl });
  assert.equal(net.calls.or.length, 2);
});

await ok("模型输出到上限被截断：这份不用，重试一次再换后备；长帖的输出上限给够", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const cut = body.model === "openai/gpt-6-luna";
    return json({ model: body.model, choices: [{ message: { content: cut ? "截了一半的译" : "完整的译文。" }, finish_reason: cut ? "length" : "stop" }], usage: {} });
  };
  const r = await translate("o", S, { source: "word ".repeat(600), srcLang: "en" }, { fetchImpl });
  assert.equal(r.text, "完整的译文。");
  assert.deepEqual(calls.map((c) => c.model), ["openai/gpt-6-luna", "openai/gpt-6-luna", "deepseek/deepseek-v4.1-flash"]);
  assert.ok(calls[0].max_tokens >= 6000, `3000 字的原文，输出上限 ${calls[0].max_tokens} 不够`);
});

await ok("目标语言不是简体中文：英文模板提示词、Jev 问法引用 target_language，缓存按目标语言分开", async () => {
  const cache = memCache();
  const net = fakeNet({ judgeScores: (t) => (t === "Grok said something off." ? bad : good), orPlan: () => "A natural English translation." });
  const ja = { id: "1900000000000000111", source: "今日はいい天気ですね。散歩に行こう。", xText: "Grok said something off.", srcLang: "ja", target: "en" };
  const r = await improve({ jevKey: "j", orKey: "o", settings: S, item: ja, cache, fetchImpl: net.fetchImpl });
  assert.equal(r.action, "replace");
  const [sys, user] = net.calls.or[0].messages;
  assert.ok(/into English/.test(sys.content) && !/简体中文/.test(sys.content), sys.content);
  assert.ok(user.content.startsWith("Original (Japanese):"), user.content);
  assert.equal(net.calls.jev[0].state.target_language, "English");
  assert.equal(net.calls.jev[0].state.source_language, "Japanese");
  assert.ok(net.calls.jev[0].questions.natural.instructions.includes("`target_language`"));
  // 同一条换成繁体中文目标：不能用英文那份缓存
  await improve({ jevKey: "j", orKey: "o", settings: S, item: { ...ja, target: "zh-TW" }, cache, fetchImpl: net.fetchImpl });
  assert.equal(net.calls.or.length, 2);
  assert.ok(/Traditional Chinese/.test(net.calls.or[1].messages[0].content));
  // 简体中文照旧用验证过的中文提示词和原来那句问法
  await improve({ jevKey: "j", orKey: "o", settings: S, item: { ...ja, target: "zh" }, cache, fetchImpl: net.fetchImpl });
  assert.equal(net.calls.or.at(-1).messages[0].content, SYSTEM_PROMPT);
  assert.ok(net.calls.or.at(-1).messages[1].content.startsWith("原文（日语）"));
  assert.ok(net.calls.jev.at(-1).questions.natural.instructions.includes("Simplified Chinese"));
});

await ok("几条一起补翻：一个请求、按标记拆开、每条照单条的键进缓存", async () => {
  const items = [
    { id: "hn-1", source: "Show HN: A tiny database in one file", srcLang: "en" },
    { id: "hn-2", source: "Why the old plan keeps working", srcLang: "en" },
    { id: "hn-3", source: "Ask HN: How do you back up photos?", srcLang: "en" }];
  const net = fakeNet({ judgeScores: () => { throw new Error("补翻不该调 Jev"); },
    orPlan: () => "<u1>Show HN：一个文件里的小数据库</u1>\n<u2>老套餐为什么还能用</u2>\n<u3>Ask HN：你们怎么备份照片？</u3>" });
  const cache = memCache();
  const r = await fillInBatch({ orKey: "o", settings: S, items, cache, fetchImpl: net.fetchImpl });
  assert.equal(net.calls.or.length, 1); assert.equal(net.calls.jev.length, 0);
  assert.deepEqual(net.calls.or[0].reasoning, { enabled: false });
  const user = net.calls.or[0].messages[1].content;
  assert.ok(user.startsWith(BATCH_ZH), user);
  assert.ok(user.includes("原文（英语）") && user.includes("<u2>Why the old plan keeps working</u2>"), user);
  assert.deepEqual(r.map((x) => x.text), ["Show HN：一个文件里的小数据库", "老套餐为什么还能用", "Ask HN：你们怎么备份照片？"]);
  assert.ok(r.every((x) => x.action === "fill" && x.cached === false));
  assert.ok(Math.abs(r[0].cost - 0.00004 / 3) < 1e-12, "费用平分");
  // 以后单条查缓存、单条补翻都命中，不再请求
  assert.equal((await fillCached({ settings: S, item: items[1], cache })).text, "老套餐为什么还能用");
  const again = await fillIn({ orKey: "o", settings: S, item: items[2], cache, fetchImpl: net.fetchImpl });
  assert.equal(again.cached, true); assert.equal(net.calls.or.length, 1);
});

await ok("几条一起补翻：少了一条、重复一条的给 null，不进缓存；纯文字条目去掉模型加的格式标记", async () => {
  const items = [1, 2, 3, 4].map((k) => ({ id: `hn-${10 + k}`, source: `Title number ${k} about databases`, srcLang: "en" }));
  const net = fakeNet({ judgeScores: () => ({}),
    orPlan: () => "<u1><t1>第一条</t1>讲数据库</u1>\n<u2>第二条</u2>\n<u2>又一个第二条</u2>\n<u4>第四条</u4>" });
  const cache = memCache();
  const r = await fillInBatch({ orKey: "o", settings: S, items, cache, fetchImpl: net.fetchImpl });
  assert.equal(r[0].text, "第一条讲数据库");
  assert.equal(r[1], null, "重复的标记不知道哪个对"); assert.equal(r[2], null, "少了的");
  assert.equal(r[3].text, "第四条");
  assert.equal(cache.m.size, 2);
  assert.equal(await fillCached({ settings: S, item: items[2], cache }), null);
});

await ok("几条一起补翻：原文语言不一样就不写语言名，带格式的条目留着标记", async () => {
  const items = [
    { id: "r-1", source: "<p1>Hello</p1> world", srcLang: "en", markup: true },
    { id: "r-2", source: "Bonjour tout le monde", srcLang: "fr" }];
  const net = fakeNet({ judgeScores: () => ({}), orPlan: () => "<u1><p1>你好</p1>世界</u1><u2>大家好</u2>" });
  const r = await fillInBatch({ orKey: "o", settings: S, items, cache: memCache(), fetchImpl: net.fetchImpl });
  const user = net.calls.or[0].messages[1].content;
  assert.ok(user.includes("原文（外语）"), user);
  assert.ok(user.includes("<p1>"), "带格式的要告诉模型标记怎么处理");
  assert.equal(r[0].text, "<p1>你好</p1>世界"); assert.equal(r[1].text, "大家好");
});

await ok("几条一起补翻：目标语言不是简体中文时用英文的拼条说明", async () => {
  const items = [{ id: "e-1", source: "今日はいい天気", srcLang: "ja", target: "en" }, { id: "e-2", source: "散歩に行こう", srcLang: "ja", target: "en" }];
  const net = fakeNet({ judgeScores: () => ({}), orPlan: () => "<u1>Nice weather today</u1>\n<u2>Let's go for a walk</u2>" });
  const r = await fillInBatch({ orKey: "o", settings: S, items, cache: memCache(), fetchImpl: net.fetchImpl });
  const user = net.calls.or[0].messages[1].content;
  assert.ok(user.startsWith("Below are several unrelated items") && user.includes("Original (Japanese):"), user);
  assert.deepEqual(r.map((x) => x.text), ["Nice weather today", "Let's go for a walk"]);
});

// ---------- 流式（0.19.4，几条一起翻的先译完先给）----------
// 假的事件流：chunks 一段段给（highWaterMark 0：读一次才给一段，log 里记下给到第几段）
const sseResp = (chunks, log) => { let i = 0; const enc = new TextEncoder();
  return new Response(new ReadableStream({ pull(c) { if (i < chunks.length) { log?.push(`chunk${i}`); c.enqueue(enc.encode(chunks[i++])); } else c.close(); } }, { highWaterMark: 0 }),
    { status: 200, headers: { "content-type": "text/event-stream" } }); };
const ev = (o) => `data: ${JSON.stringify(o)}\n\n`;
const delta = (t, model = "openai/gpt-6-luna") => ev({ model, choices: [{ index: 0, delta: { content: t } }] });
const endEv = (cost, model = "openai/gpt-6-luna", finish = "stop") => ev({ model, choices: [{ index: 0, delta: {}, finish_reason: finish }], usage: { cost } }) + "data: [DONE]\n\n";
const three = [1, 2, 3].map((k) => ({ id: `hn-s${k}`, source: `Streaming title number ${k}`, srcLang: "en" }));

await ok("流式：几条一起翻时请求带 stream，哪条的 </uN> 到了就先给哪条，不等整批；最后返回的带花费、都进缓存", async () => {
  const log = [], bodies = [];
  const fetchImpl = async (url, init) => { bodies.push(JSON.parse(init.body));
    return sseResp([": OPENROUTER PROCESSING\n\n", delta("<u1>第一"), delta("条</u1>\n<u"), delta("2>第二条</u2>"), delta("\n<u3>第三条</u3>"), endEv(0.00009)], log); };
  const cache = memCache();
  const r = await fillInBatch({ orKey: "o", settings: S, items: three, cache, fetchImpl, onItem: (k, x) => log.push(`item${k}:${x.text}`) });
  assert.equal(bodies.length, 1); assert.equal(bodies[0].stream, true); assert.deepEqual(bodies[0].reasoning, { enabled: false });
  assert.deepEqual(log, ["chunk0", "chunk1", "chunk2", "item0:第一条", "chunk3", "item1:第二条", "chunk4", "item2:第三条", "chunk5"]);
  assert.deepEqual(r.map((x) => x.text), ["第一条", "第二条", "第三条"]);
  assert.ok(r.every((x) => x.cached === false && Math.abs(x.cost - 0.00003) < 1e-12 && x.model === "openai/gpt-6-luna"));
  assert.equal(cache.m.size, 3);
  assert.equal((await fillCached({ settings: S, item: three[2], cache })).text, "第三条");
});

await ok("流式：一行事件被网络拆成好几段也照样拼得起来", async () => {
  const all = delta("<u1>甲</u1>") + delta("<u2>乙</u2>") + delta("<u3>丙</u3>") + endEv(0.00003);
  const pieces = []; for (let i = 0; i < all.length; i += 7) pieces.push(all.slice(i, i + 7));
  const got = [];
  const r = await fillInBatch({ orKey: "o", settings: S, items: three, cache: memCache(), fetchImpl: async () => sseResp(pieces), onItem: (k, x) => got.push([k, x.text]) });
  assert.deepEqual(got, [[0, "甲"], [1, "乙"], [2, "丙"]]);
  assert.deepEqual(r.map((x) => x.text), ["甲", "乙", "丙"]);
});

await ok("要了流式、回来的却是整段 JSON（中间的代理不支持）：照整段读，不先给", async () => {
  const net = fakeNet({ judgeScores: () => ({}), orPlan: () => "<u1>一</u1><u2>二</u2><u3>三</u3>" });
  const got = [];
  const r = await fillInBatch({ orKey: "o", settings: S, items: three, cache: memCache(), fetchImpl: net.fetchImpl, onItem: (k) => got.push(k) });
  assert.equal(net.calls.or[0].stream, true);
  assert.deepEqual(got, []); assert.deepEqual(r.map((x) => x.text), ["一", "二", "三"]);
});

await ok("流式中途出错：重试一次；先给了的不再给、不换，没给的用重试回来的", async () => {
  let n = 0; const got = [];
  const fetchImpl = async () => (++n === 1 ? sseResp([delta("<u1>第一条</u1>\n<u2>第二"), ev({ error: { message: "upstream died" } })])
    : sseResp([delta("<u1>重试的第一条</u1><u2>重试的第二条</u2><u3>重试的第三条</u3>"), endEv(0.00006)]));
  const r = await fillInBatch({ orKey: "o", settings: S, items: three, cache: memCache(), fetchImpl, onItem: (k, x) => got.push([k, x.text]) });
  assert.equal(n, 2);
  assert.deepEqual(got, [[0, "第一条"], [1, "重试的第二条"], [2, "重试的第三条"]]);
  assert.deepEqual(r.map((x) => x.text), ["第一条", "重试的第二条", "重试的第三条"]);
});

await ok("流式：两个模型都失败了整批报错，但先给了的照样进缓存", async () => {
  const cache = memCache();
  const fetchImpl = async () => sseResp([delta("<u1>只来得及这一条</u1>\n<u2>半"), ev({ error: { message: "upstream died" } })]);
  await assert.rejects(fillInBatch({ orKey: "o", settings: S, items: three, cache, fetchImpl, onItem: () => {} }), (e) => e.code === "or_http");
  assert.equal((await fillCached({ settings: S, item: three[0], cache })).text, "只来得及这一条");
  assert.equal(await fillCached({ settings: S, item: three[1], cache }), null);
});

await ok("流式：同一个标记出现两次，先给的定了（整段时重复的那条不要）", async () => {
  const got = [];
  const r = await fillInBatch({ orKey: "o", settings: S, items: three, cache: memCache(), onItem: (k, x) => got.push([k, x.text]),
    fetchImpl: async () => sseResp([delta("<u1>一</u1><u2>二</u2><u2>又一个二</u2>"), endEv(0.00003)]) });
  assert.deepEqual(got, [[0, "一"], [1, "二"]]);
  assert.deepEqual(r.map((x) => x && x.text), ["一", "二", null]);
});

await ok("流式：输出到上限被截断（finish_reason length）：这份不算，重试", async () => {
  let n = 0;
  const fetchImpl = async () => (++n === 1 ? sseResp([delta("<u1>一</u1><u2>二"), endEv(0.00002, "openai/gpt-6-luna", "length")])
    : sseResp([delta("<u1>一</u1><u2>二</u2><u3>三</u3>"), endEv(0.00003)]));
  const r = await fillInBatch({ orKey: "o", settings: S, items: three, cache: memCache(), fetchImpl, onItem: () => {} });
  assert.equal(n, 2); assert.deepEqual(r.map((x) => x.text), ["一", "二", "三"]);
});

await ok("模型输出去掉多余的引号和前缀", async () => {
  assert.equal(cleanOutput("译文：“你好”"), "你好");
  assert.equal(cleanOutput("“他说“好”，我说“不”。”"), "“他说“好”，我说“不”。”", "里面还有引号时不剥");
  assert.equal(cleanOutput("  正常译文\n第二行 "), "正常译文\n第二行");
});

console.log(out.join("\n"));
process.exitCode = out.some((l) => l.startsWith("FAIL")) ? 1 : 0;
