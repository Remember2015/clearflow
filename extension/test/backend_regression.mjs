// 离线回归：真实客户端与后台控制流，替换 Chrome 存储、缓存及网络，不使用任何 API key。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { scoreReplies, JevError, validScores, cacheRequests, cleanExtra, keysOf, askOf, ALL_KEYS, markedRequests, askMarked, askPost, MARKED_MAX, MARKED_BATCH } from "../jev.js";

globalThis.crypto ||= webcrypto;
const scores = (v = 0.1) => Object.fromEntries(ALL_KEYS.map((k) => [k, v]));
const answers = (id = "1", sc = scores()) => Object.fromEntries(Object.entries(sc).map(([k, v]) => [`${id}__${k}`, { noul: v }]));
const response = (data) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
const reply = { id: "1", name: "Reader", handle: "@reader", text: "普通回复" };
const msg = (id = "1", post = "原帖") => ({ type: "jev", postId: "P1", post, author: { name: "作者", handle: "@op" }, replies: [{ ...reply, id }] });
const settle = () => new Promise((r) => setImmediate(r));

// 清流会员（0.30.0）：account.js / cloud.js 的替身。cloudCalls 记下发给服务器的判断；cloudError 让下一次判断抛这个错
class CloudError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
function backend({ fetchImpl, failWrite, initial = {}, signedIn = false, cloudError = null } = {}) {
  // rev 跟着 settings.js 的 DEFAULTS.rev（0.29.8 起 6）：旧的会触发迁移，迁移写回去会盖掉测试随后改的设置
  const store = { ff_key: "fake-key", ff_settings: { rev: 6, enabled: true, useJev: true, cacheMB: 50 }, ...initial };
  const records = new Map(), changes = [], keyMap = new Map();
  const keyStore = { getKey: async (n) => keyMap.get(n) || "", setKey: async (n, v) => { if (v) keyMap.set(n, v); else keyMap.delete(n); } }; // keys.js（IndexedDB）的替身
  let listener, calls = 0, writes = 0;
  const cloudCalls = [], notices = [];
  const CLOUD = Object.freeze({ via: "cf" });
  const account = { STATE: "ff_account", CloudError, signedIn: async () => signedIn, refreshMe: async () => store.ff_account || {} };
  const cloud = { CLOUD, settingsFor: (st) => st, clearBlock() {},
    scoreReplies: async (route, post, replies, opts) => {
      cloudCalls.push({ route, post, ids: replies.map((r) => r.id), postId: opts.postId, keys: opts.keys });
      if (cloudError) throw cloudError;
      return { scores: Object.fromEntries(replies.map((r) => [r.id, scores(0.2)])), invalid: [], marked: {}, tokens: 0 };
    } };
  const chrome = {
    storage: { onChanged: { addListener: (f) => changes.push(f) }, local: {
      get: async (keys) => (keys == null ? structuredClone(store) : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((k) => k in store).map((k) => [k, structuredClone(store[k])]))),
      set: async (o) => { writes++; if (failWrite?.(o, writes)) throw new Error("temporary write failure"); Object.assign(store, structuredClone(o)); },
      remove: async (k) => { for (const x of Array.isArray(k) ? k : [k]) delete store[x]; },
    } },
    runtime: { onMessage: { addListener: (f) => { listener = f; } } },
    tabs: { query: async () => [{ id: 7, url: "https://x.com/a/status/1" }], sendMessage: async (id, m) => { notices.push({ id, ...m }); } },
  };
  const cache = {
    getMany: async (queries) => Object.fromEntries(queries.filter((q) => records.get(q.id)?.fingerprint === q.fingerprint).map((q) => [q.id, records.get(q.id).scores])),
    putMany: async (rows) => { rows.forEach((r) => records.set(r.id, r)); return { evicted: 0 }; },
    stats: async () => ({ count: records.size }), clear: async () => records.clear(),
  };
  const context = vm.createContext({
    chrome, cache, keyStore, account, cloud, askPost, validScores, cacheRequests, cleanExtra, keysOf, askOf, JevError, markedRequests, askMarked, MARKED_MAX, MARKED_BATCH, TextEncoder, crypto: webcrypto,
    AbortController, DOMException, Date, Promise, console, URL, // URL：settings.js 按网址认网站（0.20）
    setTimeout: () => 0, // 0.28.5：后台起来 5 秒后清过期缓存（purgeCaches）；这里不跑
    scoreReplies: (key, post, replies, options) => scoreReplies(key, post, replies, {
      ...options, totalTimeoutMs: 500, requestTimeoutMs: 200,
      fetchImpl: async (...args) => {
        calls++;
        if (fetchImpl) return fetchImpl(...args);
        const payload = JSON.parse(args[1].body);
        return response({ answers: Object.assign({}, ...payload.state.replies.map((r) => answers(r.id))), usage: { input_tokens: 10 } });
      },
    }),
  });
  vm.runInContext(readFileSync(new URL("../rules.js", import.meta.url), "utf8"), context);
  const feedbackSource = readFileSync(new URL("../feedback.js", import.meta.url), "utf8").replace(/^import .*;$/mg, "").replace(/^export /mg, "");
  context.feedback = vm.runInContext(`(() => { ${feedbackSource}; return { getOverrides, saveDecision, listSlogans, rememberSlogan, removeSlogan, clearSlogans, examplesFor, undoMark, clearOverrides }; })()`, context);
  vm.runInContext(readFileSync(new URL("../settings.js", import.meta.url), "utf8"), context);
  const source = readFileSync(new URL("../background.js", import.meta.url), "utf8").replace(/^import .*;$/mg, "").replaceAll("export async function", "async function");
  vm.runInContext(source, context);
  return {
    store, records, cloudCalls, notices, get calls() { return calls; }, get writes() { return writes; },
    call: (message, sender = {}) => new Promise((resolve) => listener(message, sender, resolve)),
    change: (patch) => { const delta = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, { oldValue: store[k], newValue: v }])); Object.assign(store, structuredClone(patch)); changes.forEach((f) => f(delta, "local")); },
  };
}

test("Jev requires five finite scores in [0, 1] for every requested reply", async () => {
  const good = await scoreReplies("fake", "p", [reply], { fetchImpl: async () => response({ answers: answers() }) });
  assert.deepEqual(good.scores["1"], scores());
  for (const bad of [{}, { "1__benefit": { noul: 0.9 } }, answers("1", { ...scores(), abuse: "0.1" }), answers("1", { ...scores(), sexual: 1.1 })]) {
    await assert.rejects(scoreReplies("fake", "p", [reply], { fetchImpl: async () => response({ answers: bad }) }), (e) => e.code === "invalid_response");
  }
});

test("extra questions (YouTube's setup) are asked only when requested, must be answered, and get their own cache keys", async () => {
  let body = null;
  const fetchImpl = async (_u, init) => { body = JSON.parse(init.body); return response({ answers: { ...answers(), "1__setup": { noul: 0.7 } } }); };
  const r = await scoreReplies("fake", "p", [reply], { fetchImpl, extra: ["setup", "nope"] });
  assert.equal(r.scores["1"].setup, 0.7);
  assert.ok(Object.keys(body.questions).includes("1__setup") && !Object.keys(body.questions).some((k) => k.endsWith("__nope")));
  const plain = await scoreReplies("fake", "p", [reply], { fetchImpl });
  assert.ok(!Object.keys(body.questions).includes("1__setup") && !("setup" in plain.scores["1"]));
  await assert.rejects(scoreReplies("fake", "p", [reply], { extra: ["setup"], fetchImpl: async () => response({ answers: answers() }) }), (e) => e.code === "invalid_response");
  const [a] = await cacheRequests("p1", "p", [reply], null), [b] = await cacheRequests("p1", "p", [reply], null, ["setup"]), [c] = await cacheRequests("p1", "p", [reply], null, []);
  assert.equal(a.fingerprint, c.fingerprint);
  assert.notEqual(a.fingerprint, b.fingerprint);
  assert.ok(validScores(scores()) && !validScores(scores(), ["setup"]) && validScores({ ...scores(), setup: 0.3 }, ["setup"]));
});

test("per-reply questions (0.22 filler) are asked only for the replies that carry ask, must be answered, and get their own cache keys", async () => {
  let body = null;
  const two = [{ ...reply, ask: ["filler", "nope"] }, { ...reply, id: "2" }];
  const fetchImpl = async (_u, init) => { body = JSON.parse(init.body); return response({ answers: { ...answers("1"), ...answers("2"), "1__filler": { noul: 0.8 } } }); };
  const r = await scoreReplies("fake", "p", two, { fetchImpl });
  assert.equal(r.scores["1"].filler, 0.8);
  assert.ok(!("filler" in r.scores["2"]));
  assert.ok(Object.keys(body.questions).includes("1__filler") && !Object.keys(body.questions).includes("2__filler") && !Object.keys(body.questions).some((k) => k.endsWith("__nope")));
  assert.ok(body.state.replies.every((x) => !("ask" in x))); // 只是"多问哪一问"，不进 state
  // 带了 ask 却没答这一问：只有这一条算失败
  const miss = await scoreReplies("fake", "p", two, { fetchImpl: async () => response({ answers: { ...answers("1"), ...answers("2") } }) });
  assert.deepEqual(miss.invalid, ["1"]);
  const [a] = await cacheRequests("p1", "p", [reply], null), [b] = await cacheRequests("p1", "p", [{ ...reply, ask: ["filler"] }], null), [c] = await cacheRequests("p1", "p", [{ ...reply, ask: [] }], null);
  assert.equal(a.fingerprint, c.fingerprint);
  assert.notEqual(a.fingerprint, b.fingerprint);
});

test("one bad answer only fails that reply; the rest of the batch keeps valid scores", async () => {
  const two = [reply, { ...reply, id: "2" }];
  const r = await scoreReplies("fake", "p", two, { fetchImpl: async () => response({ answers: { ...answers("1"), ...answers("2", { ...scores(), sexual: 2 }) } }) });
  assert.deepEqual(r.scores["1"], scores());
  assert.equal(r.scores["2"], undefined);
  assert.deepEqual(r.invalid, ["2"]);
  await assert.rejects(scoreReplies("fake", "p", two, { fetchImpl: async () => response({ answers: {} }) }), (e) => e.code === "invalid_response");
});

test("per-request deadlines cover both fetch and response bodies", async () => {
  for (const fetchImpl of [async () => new Promise(() => {}), async () => ({ ok: true, json: () => new Promise(() => {}) })]) {
    await assert.rejects(scoreReplies("fake", "p", [reply], { fetchImpl, retries: 1, requestTimeoutMs: 15, totalTimeoutMs: 100 }), (e) => e.code === "timeout");
  }
});

test("total deadline and cancellation interrupt Retry-After backoff", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response("busy", { status: 429, headers: { "retry-after": "3600" } }); };
  await assert.rejects(scoreReplies("fake", "p", [reply], { fetchImpl, totalTimeoutMs: 25 }), (e) => e.code === "timeout");
  assert.equal(calls, 1);
  const control = new AbortController();
  const waiting = scoreReplies("fake", "p", [reply], { fetchImpl, signal: control.signal });
  await settle(); control.abort(new DOMException("cancel", "AbortError"));
  await assert.rejects(waiting, (e) => e.name === "AbortError");
  assert.equal(calls, 2);
});

test("fingerprints cover post, author, reply text and reply author", async () => {
  const original = await cacheRequests("P1", "p", [reply], { name: "op", handle: "@op" });
  assert.deepEqual(await cacheRequests("P1", "p", [reply], { name: "op", handle: "@op" }), original);
  for (const args of [["P2", "p", [reply], { name: "op", handle: "@op" }], ["P1", "edited", [reply], { name: "op", handle: "@op" }], ["P1", "p", [reply], { name: "other", handle: "@op" }], ["P1", "p", [{ ...reply, text: "edited" }], { name: "op", handle: "@op" }], ["P1", "p", [{ ...reply, handle: "@other" }], { name: "op", handle: "@op" }]]) {
    assert.notEqual((await cacheRequests(...args))[0].fingerprint, original[0].fingerprint);
  }
});

test("disabled or missing-key requests never enter the network", async () => {
  const h = backend();
  h.store.ff_settings.enabled = false;
  assert.equal((await h.call(msg())).code, "disabled");
  h.store.ff_settings.enabled = true; h.store.ff_settings.useJev = false;
  assert.equal((await h.call(msg())).code, "disabled");
  h.store.ff_settings.useJev = true; h.store.ff_key = "";
  assert.equal((await h.call(msg())).code, "nokey");
  assert.equal(h.calls, 0);
});

test("a site with hiding turned off (0.20 sites.<id>.fold) never enters the network; other sites still work", async () => {
  const h = backend({ initial: { ff_settings: { rev: 6, useJev: true, cacheMB: 50, sites: { reddit: { fold: false } } } } });
  assert.equal((await h.call(msg("1"), { url: "https://www.reddit.com/r/a/comments/b/c/" })).code, "disabled");
  assert.equal(h.calls, 0);
  const r = await h.call(msg("2"), { url: "https://x.com/a/status/1" });
  assert.ok(r.scores && !r.error, JSON.stringify(r));
  assert.equal(h.calls, 1);
});

test("settings and key changes cancel active and queued work; slots recover", async () => {
  for (const patch of [{ ff_settings: { rev: 3, enabled: false, useJev: false, cacheMB: 50 } }, { ff_key: "new-key" }]) {
    let hang = true;
    const h = backend({ fetchImpl: async (_, options) => hang ? new Promise(() => {}) : response({ answers: answers(JSON.parse(options.body).state.replies[0].id) }) });
    const pending = [h.call(msg("1")), h.call(msg("2")), h.call(msg("3"))];
    for (let i = 0; i < 100 && h.calls < 2; i++) await settle();
    assert.equal(h.calls, 2);
    h.change(patch);
    const results = await Promise.all(pending);
    assert.ok(results.every((r) => r.code === "cancelled" || r.code === "disabled"));
    assert.equal(h.calls, 2);
    hang = false;
    h.change({ ff_settings: { rev: 3, enabled: true, useJev: true, cacheMB: 50 } });
    assert.ok((await h.call(msg("4"))).scores["4"]);
    assert.equal(h.calls, 3);
  }
});

test("toggling translation settings or rewriting identical settings does not cancel comment requests", async () => {
  const h = backend({ fetchImpl: async () => new Promise(() => {}) });
  let settled = 0;
  const pending = [h.call(msg("1")), h.call(msg("2"))];
  pending.forEach((p) => p.then(() => { settled++; }));
  for (let i = 0; i < 100 && h.calls < 2; i++) await settle();
  h.change({ ff_settings: { ...h.store.ff_settings, translateFill: false } });
  h.change({ ff_settings: { ...h.store.ff_settings } });
  for (let i = 0; i < 20; i++) await settle();
  assert.equal(settled, 0, "只改翻译开关时进行中的请求不能被取消");
  h.change({ ff_key: "another-key" });
  const results = await Promise.all(pending);
  assert.ok(results.every((r) => r.code === "cancelled"));
});

test("partially invalid answers cache only the valid replies and report a retryable error", async () => {
  const h = backend({ fetchImpl: async () => response({ answers: answers("1") }) });
  const r = await h.call({ ...msg("1"), replies: [{ ...reply, id: "1" }, { ...reply, id: "2", text: "另一条" }] });
  assert.deepEqual(r.scores["1"], scores()); assert.equal(r.scores["2"], undefined);
  assert.equal(r.code, "invalid_response"); assert.equal(r.retryable, true);
  assert.deepEqual([...h.records.keys()], ["1"]);
});

test("asking only the questions a page uses (0.29.14 keys): only those go out, they are enough to cache, and the full five don't reuse them", async () => {
  let sent = null;
  const h = backend({ fetchImpl: async (url, init) => {
    const p = JSON.parse(init.body);
    sent = Object.keys(p.questions).sort();
    return response({ answers: Object.assign({}, ...p.state.replies.map((r) => answers(r.id))), usage: { input_tokens: 10 } });
  } });
  const sub = { ...msg(), keys: ["sexual", "abuse", "not_a_question"] };
  const r = await h.call(sub);
  assert.deepEqual(sent, ["1__abuse", "1__sexual"]);
  assert.equal(typeof r.scores["1"].abuse, "number");
  await h.call(sub);
  assert.equal(h.calls, 1); // 缓存命中
  await h.call(msg());
  assert.equal(h.calls, 2); // 五问全问是另一份指纹，不拿只问了两问的冒充
  assert.equal(sent.length, 5);
});

test("batch cache matches context and rejects old full-post prefetch", async () => {
  const h = backend();
  await h.call(msg()); await h.call(msg());
  assert.equal(h.calls, 1);
  await h.call(msg("1", "编辑后的原帖"));
  assert.equal(h.calls, 2);
  assert.equal(Object.keys((await h.call({ type: "cachedForPost", postId: "P1" })).scores).length, 0);
});

test("a transient storage failure does not poison statistics or feedback queues", async () => {
  for (const field of ["ff_stats", "ff_log"]) {
    let failed = false;
    const h = backend({ failWrite: (o) => { if (field in o && !failed) { failed = true; return true; } return false; } });
    const message = field === "ff_stats" ? { type: "stat", delta: { seen: 1 } } : { type: "feedback", entry: { label: "fp", id: "1" } };
    const first = await h.call(message);
    assert.ok(field === "ff_log" ? first.ok && first.warning : first.error);
    assert.equal((await h.call(message)).ok, true);
    assert.ok(h.writes >= 2);
  }
});

test("background marks bad keys permanent and invalid scores retryable", async () => {
  const key = backend({ fetchImpl: async () => new Response("invalid", { status: 401 }) });
  const badkey = await key.call(msg());
  assert.equal(badkey.code, "badkey"); assert.equal(badkey.retryable, false);
  const invalid = backend({ fetchImpl: async () => response({ answers: {} }) });
  const badscores = await invalid.call(msg());
  assert.equal(badscores.code, "invalid_response"); assert.equal(badscores.retryable, true);
  assert.equal(invalid.records.size, 0);
});


// 0.28.5（用户 10-19 定）："清空统计和记录"连你的纠正一起清（以前特意留着，界面上删不掉）
test("clearing stats and records also clears user decisions, including ones still only in the old log", async () => {
  const h = backend({ initial: { ff_log: [
    { id: "1", label: "missed", ts: "2026-10-10T01:00:00Z" },
    { id: "1", label: "fp", ts: "2026-10-10T02:00:00Z" },
    { id: "2", label: "confirm", kind: "abuse", ts: "2026-10-10T03:00:00Z" },
  ], ff_stats: { "2026-10-10": { seen: 10 } } } });
  assert.equal((await h.call({ type: "clearLog" })).ok, true);
  assert.equal(h.store.ff_log.length, 0);
  assert.equal(Object.keys(h.store.ff_stats).length, 0);
  // 再建一个后台上下文：纠正没了，也不会从旧日志迁回来
  const restarted = backend({ initial: structuredClone(h.store) });
  const restored = await restarted.call({ type: "replyOverrides", ids: ["1", "2"] });
  assert.equal(Object.keys(restored.overrides).length, 0);
});

test("a failed clear keeps the log; clearing again succeeds and the decisions are gone", async () => {
  let failMigration = true;
  const h = backend({
    initial: { ff_log: [{ id: "7", label: "fp", ts: "2026-10-10T01:00:00Z" }] },
    failWrite: (o) => { if (failMigration && "ff_feedback_rev" in o) { failMigration = false; return true; } return false; },
  });
  assert.ok((await h.call({ type: "clearLog" })).error);
  assert.equal(h.store.ff_log.length, 1, "清理失败时必须保留唯一的旧纠错来源");
  assert.equal((await h.call({ type: "clearLog" })).ok, true);
  assert.equal(h.store.ff_log.length, 0);
  assert.equal((await h.call({ type: "replyOverrides", ids: ["7"] })).overrides["7"], undefined);
});

// 0.29.11：判断默认走 OpenRouter（只要一个 OpenRouter 密钥）。jev.js 一层：给 {via: "or", key} 就换 OpenRouter 的地址、型号名、密钥，
// 图片和 Danger Zone 头去掉（OpenRouter 收下图片却不转给 Jev，只按文字判）；给字符串还是直连 TypeSafe
test("Jev through OpenRouter: OpenRouter URL, model and key; images and the image header dropped; a plain key still goes direct", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push({ url, auth: init.headers.Authorization, header: init.headers["TypeSafe-Danger-Zone-Images"], body: JSON.parse(init.body) }); return response({ answers: answers(), usage: { input_tokens: 10 } }); };
  const assets = { img_1_0: { type: "image", format: "jpg", data_base64: "AAAA" } };
  await scoreReplies({ via: "or", key: "sk-or-x" }, "p", [{ ...reply, imageRefs: ["img_1_0"] }], { fetchImpl, assets });
  await scoreReplies("ts-key", "p", [{ ...reply, imageRefs: ["img_1_0"] }], { fetchImpl, assets });
  assert.equal(seen[0].url, "https://openrouter.ai/api/v1/systemone");
  assert.equal(seen[0].body.model, "typesafe/jev-1.13");
  assert.equal(seen[0].auth, "Bearer sk-or-x");
  assert.equal(seen[0].body.assets, undefined); assert.equal(seen[0].header, undefined);
  assert.equal(seen[1].url, "https://api.typesafe.ai/v1/systemone");
  assert.equal(seen[1].body.model, "jev-1.13.0"); assert.equal(seen[1].auth, "Bearer ts-key");
  assert.ok(seen[1].body.assets && seen[1].header === "true");
});

// 后台一层：没填 TypeSafe、有 OpenRouter 的密钥 → 判断走 OpenRouter；OpenRouter 回 401 记成 OpenRouter 的密钥无效（弹窗那头提醒 OpenRouter）
test("without a TypeSafe key the backend judges through OpenRouter; a 401 there is recorded as the OpenRouter key being bad", async () => {
  let url = null, auth = null, status = 200;
  const h = backend({ initial: { ff_key: "", ff_or_key: "sk-or-x" }, fetchImpl: async (u, init) => {
    url = u; auth = init.headers.Authorization;
    return status === 200 ? response({ answers: answers(), usage: { input_tokens: 10 } }) : new Response("{\"error\":{\"message\":\"User not found.\",\"code\":401}}", { status });
  } });
  const ok = await h.call(msg("1"));
  assert.ok(ok.scores && !ok.error, JSON.stringify(ok));
  assert.equal(url, "https://openrouter.ai/api/v1/systemone"); assert.equal(auth, "Bearer sk-or-x");
  status = 401;
  const bad = await h.call(msg("2"));
  assert.equal(bad.code, "or_badkey");
  await settle(); await settle();
  assert.equal(h.store.ff_health?.or?.code, "or_badkey"); assert.equal(h.store.ff_health?.jev, undefined);
  h.store.ff_or_key = ""; // 两个都没了：nokey，不发网络
  const before = h.calls;
  assert.equal((await h.call(msg("3"))).code, "nokey"); assert.equal(h.calls, before);
});

// ---------- 清流会员（0.30.0） ----------
test("membership mode, signed in: judging goes to ClearFlow's server (with the post id), not to Jev; results land in the local cache", async () => {
  const b = backend({ signedIn: true, initial: { ff_key: "", ff_settings: { rev: 6, enabled: true, useJev: true, cacheMB: 50, account: true } } });
  const r = await b.call(msg("1"), { url: "https://x.com/a/status/1" });
  assert.deepEqual(r.scores["1"], scores(0.2));
  assert.equal(b.calls, 0); // 没碰 Jev
  assert.equal(b.cloudCalls.length, 1);
  assert.equal(b.cloudCalls[0].postId, "P1");
  assert.equal(b.cloudCalls[0].route.via, "cf");
  const again = await b.call(msg("1"), { url: "https://x.com/a/status/1" }); // 本地缓存命中，不再问服务器
  assert.deepEqual(again.scores["1"], scores(0.2));
  assert.equal(b.cloudCalls.length, 1);
  const st = await b.call({ type: "settings" });
  assert.equal(st.hasKey, true);
  assert.equal(st.hasOrKey, true);
});

test("membership mode, signed out: treated like no key (local rules only), even with an own key stored", async () => {
  const b = backend({ signedIn: false, initial: { ff_settings: { rev: 6, enabled: true, useJev: true, cacheMB: 50, account: true } } });
  const r = await b.call(msg("1"), { url: "https://x.com/a/status/1" });
  assert.equal(r.code, "nokey");
  assert.equal(b.calls, 0);
  assert.equal(b.cloudCalls.length, 0);
  assert.equal((await b.call({ type: "settings" })).hasKey, false);
});

test("membership ended / allowance used up: the page gets cf_stop (not retryable) and the open site tab gets one notice", async () => {
  const b = backend({ signedIn: true, cloudError: new CloudError(402, "subscription_required"),
    initial: { ff_key: "", ff_settings: { rev: 6, enabled: true, useJev: true, cacheMB: 50, account: true }, ff_account: { email: "a@example.com", status: "none", lastPlan: "trial" } } });
  const r = await b.call(msg("1"), { url: "https://x.com/a/status/1" });
  assert.equal(r.code, "cf_stop");
  assert.equal(r.reason, "subscription_required");
  assert.equal(r.retryable, false);
  for (let i = 0; i < 20 && !b.notices.length; i++) await settle();
  assert.deepEqual(b.notices.map((n) => [n.id, n.type, n.kind, n.plan]), [[7, "ffNotice", "ended", "trial"]]);
  await b.call(msg("2"), { url: "https://x.com/a/status/1" });
  for (let i = 0; i < 20; i++) await settle();
  assert.equal(b.notices.length, 1); // 同一件事只提示一次
  const quota = backend({ signedIn: true, cloudError: new CloudError(429, "rate_limited"), initial: { ff_key: "", ff_settings: { rev: 6, enabled: true, useJev: true, cacheMB: 50, account: true } } });
  const q = await quota.call(msg("1"), { url: "https://x.com/a/status/1" });
  assert.equal(q.code, "rate_limited");
  assert.equal(q.retryable, true); // 限流可以重试
});

test("account messages are only accepted from the extension's own pages", async () => {
  const b = backend({ signedIn: true });
  const r = await b.call({ type: "account", op: "logout" }, { url: "https://x.com/home" });
  assert.equal(r.ok, false);
  assert.equal(r.error, "invalid_request");
});
