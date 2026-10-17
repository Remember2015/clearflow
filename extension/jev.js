// TypeSafe Jev 客户端：一批回复（≤10 条）+ 原帖（和原帖作者），一次请求问五个是/否问题。
// 垃圾回复三问与 jev_eval/code/jev_eval.py 的 v3pa 一致（v3p 问法 + state 里带 post_author），辱骂、色情两问与 abuse1、sexual1 一致。
// 后台 service worker 和 Node 测试共用。

export const API = "https://api.typesafe.ai/v1/systemone";
// 钉版本（2026-10-15）：jev-latest 原来指 1.13.0，1.14.0 发布一周后会改指 1.14.0。1.14 整体打分偏高，照现在各平台的阈值
// 折得更多、多语言集上多出来的大多是错的（X 多语言热帖 7 对 7 错 → 7 对 9 错，YouTube 多语言集错 31 → 49），
// 要换得按各平台的数据重定门槛（见 jev_eval/code/xr_general/README.md "Jev 1.14"）。1.13.0 下线前至少提前 60 天通知。
// 这个名字也在缓存指纹里：换版本旧结果自动作废。
export const MODEL = "jev-1.13.0";
export const CLASSIFIER_VERSION = "v3pa-abuse1-sexual1-1";
const HEAD = "For the reply whose id equals `target_reply_id`: ";
export const QUESTIONS = {
  benefit:
    "does it steer readers toward a specific account, person, product, service, group, DM, or keyword to search for, " +
    "in a way that mainly benefits that destination (promotion or lead generation), rather than giving a source or " +
    "supporting material for the discussion?",
  disguised: "is it a promotional or traffic-driving message disguised as an ordinary user's spontaneous comment?",
  promo_mention:
    "does it @-mention or name another account or person in order to promote them to readers, rather than talking to " +
    "someone already in the conversation or inviting a friend to look?",
  // 辱骂 / 人身攻击：和上面三个"垃圾回复"问题分开用（另一个标签、另一个阈值）
  abuse:
    "does it insult, demean or attack a person or a group of people - name-calling, slurs, curses, or degrading remarks " +
    "aimed at the poster, another user, or a group - rather than disagreeing with or criticizing what was said?",
  // 色情：同样单独用（"疑似色情"标签、自己的阈值）。脏话当语气词（"fucking amazing""卧槽"）实测只有 0.02–0.03，不会误判
  sexual:
    "does it contain sexual content - explicit descriptions of sex acts or genitals, explicit sexual slang, " +
    "pornography or porn links, or offers or requests for sex or sexual services - rather than non-explicit " +
    "talk about dating, relationships, attractiveness, sexual health, or news?",
};
export const SPAM_KEYS = ["benefit", "disguised", "promo_mention"];
export const ALL_KEYS = Object.keys(QUESTIONS);
// 站点可以多问的问题（0.15.2 起 YouTube 问 setup，0.15.3 起 X、Reddit 的帖子页也问）：只有要的才问，缓存的指纹里带上问了哪几个，
// 没多问的请求和缓存一个字不变。
// setup：骗局的铺垫——编的发财 / 找回 / 落难故事，或者托儿式的提问、作证、推荐、联系方式暗示，目的是让读者去找某个人、某个项目。
// 不靠话术、不分语言：YouTube 两轮抽样上 AUC 0.98（"引流"0.83），把骗局串改写成别的说法、别的语言以后照样认得出（≥0.7 的从 168 条到 162 条，
// 照着话术写的正则从 22 条到 2 条），没参与定规则的多语言视频上也一样（见 jev_eval/code/yt_comments）。
export const EXTRA_QUESTIONS = {
  setup:
    "is it likely part of a scam setup - a fabricated story of sudden success, recovery or hardship (for example big returns, a " +
    "recovered account or lost funds, quitting a job, paying off debts thanks to someone), or a staged question, testimonial, " +
    "recommendation or contact hint meant to get readers to seek out, search for or contact some person, expert, mentor, hacker, " +
    "program, group or service - even when no name, link or contact is given in this reply?",
  // filler（0.22）：只有「赞」「mark」这类的回复——夸、附和、笑、情绪、谢谢、打招呼、占位、抽奖报名，没有具体的看法、信息、回答、提问。
  // 不是整批问，只问很短的那几条（回复上带 ask: ["filler"]，内容脚本按长度挑，见 fold_engine.js / content.js）。
  // 照插件这样同帖 10 条一批问（jev_eval/code/xr_general/short_jev2.mjs 问法 2），≤ 8 个汉字当量、不带图不带链接的短回复：
  // AUC X 0.909、小红书 0.975、YouTube 0.952；0.7 时纯表态藏掉 10/20、31/42、49/62，有内容的藏错 0/35、1/50、0/34。
  // 带上被回复的那条（楼中楼）没用（AUC 0.903 对不带的 0.911），不带
  filler:
    "does the reply add nothing beyond a generic reaction - only praise, agreement, laughter, an emotion, thanks, a greeting, " +
    "a placeholder (such as \"mark\", \"+1\", \"interested\", \"following\", a lone emoji or hashtag) or a contest / giveaway entry - " +
    "with no specific opinion, information, answer, question, or reference to particular content of the post?",
};
// 问帖子本身的（0.15.3 起）：rec——帖子是不是在请大家推荐东西。是的话回复里报名字是在回答，不算拉人，
// 垃圾回复的门槛换成"求推荐类帖子的阈值"（默认 0.9）。以前靠只认中文的正则（推荐 / 服务商 / 有没有…靠谱），帖子译成别的语言就认不出：
// X 的改写集（中文热帖译成 10 种语言）上中文正则失效、折错 6 → 3 条靠这一问补回；V2EX（论坛）上折错 17 → 2。原文、译文都认得出
// （求推荐帖 0.85–0.98，别的帖子都不到 0.2，只有一条译文 0.54）。哪个站点问由站点定（X、Reddit 问，YouTube 不问）。
export const POST_QUESTIONS = {
  rec: "About the post: does the post ask readers to recommend or suggest specific products, services, apps, providers, tools, " +
    "places, or people (so that replies naming them are expected answers rather than unsolicited promotion)?",
};
const postState = (post, author) => ({
  post: (post || "").slice(0, 400),
  ...(author && (author.name || author.handle) ? { post_author: { name: author.name || "", handle: author.handle || "" } } : {}),
});
export async function postFingerprint(postId, post, author) {
  const bytes = new TextEncoder().encode(JSON.stringify(["post", CLASSIFIER_VERSION, MODEL, POST_QUESTIONS, postId || "", post || "", author?.name || "", author?.handle || ""]));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, "0")).join("");
}
export const validPostScores = (sc) => !!sc && Object.keys(POST_QUESTIONS).every((k) => typeof sc[k] === "number" && Number.isFinite(sc[k]) && sc[k] >= 0 && sc[k] <= 1);

// 请求里的 extra：只留认识的、去重
export const cleanExtra = (extra) => (Array.isArray(extra) ? [...new Set(extra.filter((k) => typeof k === "string" && Object.hasOwn(EXTRA_QUESTIONS, k)))] : []);
// 这一条回复自己要多问的（r.ask），整批已经问了的不算
export const askOf = (r, extra = []) => { const all = cleanExtra(extra); return cleanExtra(r && r.ask).filter((k) => !all.includes(k)); };

// author：原帖作者 {name, handle}。不给的话 Jev 不知道帖子是谁发的，会把回复里提到的作者自家产品
// （一家模型公司的帖子下面，有人催它出下一代模型）当成在给别人拉人：同一条 0.58–0.69，带上作者后 0.36–0.50
// model：不给就是 MODEL（评测脚本用它比别的版本）。
// 看图片（0.18）：回复上带 imageRefs（assets 里的引用名）的，state 里这条回复多一个 images 字段；Jev 把引用名换成那张图
// 只问某几条的（0.22，filler）：回复上带 ask（EXTRA_QUESTIONS 里的名字），这一条多问这几个；state 里不带
// examples（0.26）：你标记过的垃圾（[{handle, text}]）；给了就放进 state 的 marked_spam，每条回复多问一句 marked（见下面 MARKED_QUESTION）
export function buildPayload(post, replies, author, extra = [], model = MODEL, assets = null, examples = null) {
  const questions = {}, asked = { ...QUESTIONS, ...Object.fromEntries(cleanExtra(extra).map((k) => [k, EXTRA_QUESTIONS[k]])) };
  for (const r of replies) {
    const mine = { ...asked, ...Object.fromEntries(askOf(r, extra).map((k) => [k, EXTRA_QUESTIONS[k]])) };
    for (const [name, q] of Object.entries(mine)) {
      questions[`${r.id}__${name}`] = { type: "noul", instructions: { target_reply_id: r.id, question: HEAD + q } };
    }
    if (examples && examples.length) questions[`${r.id}__marked`] = { type: "noul", instructions: { target_reply_id: r.id, question: HEAD + MARKED_QUESTION } };
  }
  const state = {
    post: (post || "").slice(0, 400),
    ...(examples && examples.length ? { marked_spam: markedState(examples) } : {}),
    replies: replies.map((r) => ({ id: r.id, author_name: r.name || "", handle: r.handle || "", text: (r.text || "").slice(0, 600),
      ...(Array.isArray(r.imageRefs) && r.imageRefs.length ? { images: r.imageRefs } : {}) })),
  };
  return {
    model,
    state: author && (author.name || author.handle) ? { post_author: { name: author.name || "", handle: author.handle || "" }, ...state } : state,
    questions,
    ...(assets && Object.keys(assets).length ? { assets } : {}),
  };
}
// 带图的请求要这个头（TypeSafe 的 Danger Zone；1.13、1.14 都能看图）
export const IMAGE_HEADER = { "TypeSafe-Danger-Zone-Images": "true" };

export const validScores = (sc, extra = []) => !!sc && [...ALL_KEYS, ...cleanExtra(extra)].every((k) =>
  typeof sc[k] === "number" && Number.isFinite(sc[k]) && sc[k] >= 0 && sc[k] <= 1);

// 只缓存指纹，不额外保存原帖和回复原文；问题改动也会自动令旧结果失效。
export async function cacheRequests(postId, post, replies, author, extra = []) {
  const ex = cleanExtra(extra);
  // 多问了的话指纹里带上问题原文（没多问时和以前一模一样，旧缓存照常命中）
  const context = [CLASSIFIER_VERSION, MODEL, QUESTIONS, ...(ex.length ? [ex.map((k) => [k, EXTRA_QUESTIONS[k]])] : []), postId || "", post || "", author?.name || "", author?.handle || ""];
  return Promise.all(replies.map(async (r) => {
    // 看图片：这条带了哪几张图（网址）也进指纹；没带图的和以前一模一样
    const imgs = Array.isArray(r.images) && r.images.length ? [r.images] : [];
    // 这一条自己多问的（filler）也进指纹，问题原文一起；没多问的和以前一模一样
    const ask = askOf(r, ex), more = ask.length ? [ask.map((k) => [k, EXTRA_QUESTIONS[k]])] : [];
    const bytes = new TextEncoder().encode(JSON.stringify([...context, r.id, r.name || "", r.handle || "", r.text || "", ...imgs, ...more]));
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const fingerprint = Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, "0")).join("");
    return { id: r.id, fingerprint };
  }));
}

const timeoutError = () => Object.assign(new Error("Jev 请求超时"), { name: "TimeoutError", code: "timeout", retryable: true });
const abortReason = (signal) => signal.reason || new DOMException("已取消", "AbortError");
function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortReason(signal));
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const finish = () => { signal.removeEventListener("abort", abort); resolve(); };
    const timer = setTimeout(finish, ms);
    const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(abortReason(signal)); };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

export class JevError extends Error {
  constructor(status, body) {
    super(`Jev HTTP ${status}: ${String(body).slice(0, 200)}`);
    this.status = status;
    this.code = "http";
    this.retryable = status === 429 || status >= 500;
  }
}

// 网络、读响应体和退避都受总时限约束，关闭开关会立即中断它们。parse 把响应变成结果；它抛的错（答案无效）不重试。
async function postJev(key, body, {
  retries = 5, fetchImpl = fetch, signal, requestTimeoutMs = 10000, totalTimeoutMs = 25000, parse, headers = null,
} = {}) {
  const total = new AbortController();
  const cancel = () => total.abort(abortReason(signal));
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const totalTimer = setTimeout(() => total.abort(timeoutError()), totalTimeoutMs);
  try {
    for (let i = 0; i < retries; i++) {
      total.signal.throwIfAborted();
      const request = new AbortController();
      const cancelRequest = () => request.abort(abortReason(total.signal));
      total.signal.addEventListener("abort", cancelRequest, { once: true });
      const requestTimer = setTimeout(() => request.abort(timeoutError()), requestTimeoutMs);
      let retryMs = 1000 * 2 ** i;
      try {
        const data = await abortable((async () => {
          const resp = await fetchImpl(API, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(headers || {}) },
            body, signal: request.signal,
          });
          if (!resp.ok) {
            const ra = Number(resp.headers.get("retry-after"));
            if (Number.isFinite(ra) && ra > 0) retryMs = Math.min(ra * 1000, totalTimeoutMs);
            throw new JevError(resp.status, await resp.text());
          }
          return await resp.json();
        })(), request.signal);
        return parse(data);
      } catch (e) {
        if (total.signal.aborted) throw abortReason(total.signal);
        // 无效答案不能当成正常评分；交给调用方展示失败并由用户重试。
        if (e.code === "invalid_response" || (e instanceof JevError && !e.retryable) || i === retries - 1) throw e;
      } finally {
        clearTimeout(requestTimer);
        total.signal.removeEventListener("abort", cancelRequest);
      }
      await sleep(retryMs, total.signal);
    }
    throw new JevError(429, "retries exhausted");
  } finally {
    clearTimeout(totalTimer);
    signal?.removeEventListener("abort", cancel);
  }
}
const tokensOf = (data) => (Number.isFinite(data.usage?.input_tokens) && data.usage.input_tokens >= 0 ? data.usage.input_tokens : 0);
const validScore = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

// examples 给了的话，结果里多一个 marked：{回复 id: 0–1}（和五问的 scores 分开放、分开缓存；这一问的答案坏了只是没有，不算这条失败）
export async function scoreReplies(key, post, replies, { author = null, extra = [], model = MODEL, assets = null, examples = null, ...opts } = {}) {
  const keys = [...ALL_KEYS, ...cleanExtra(extra)];
  const withImages = !!(assets && Object.keys(assets).length);
  return postJev(key, JSON.stringify(buildPayload(post, replies, author, extra, model, assets, examples)), {
    // 带图的请求大、慢：单次、总时限放宽
    ...(withImages ? { headers: IMAGE_HEADER, requestTimeoutMs: 25000, totalTimeoutMs: 45000 } : {}),
    ...opts,
    parse: (data) => {
      // 一条回复的答案缺了或越界，只算这一条失败（invalid），同批其他回复的有效分数照常用；全坏才算整批失败
      const scores = {}, invalid = [];
      for (const r of replies) {
        const ask = askOf(r, extra);
        const sc = Object.fromEntries([...keys, ...ask].map((k) => [k, data?.answers?.[`${r.id}__${k}`]?.noul]));
        if (validScores(sc, [...extra, ...ask])) scores[r.id] = sc; else invalid.push(r.id);
      }
      if (!Object.keys(scores).length) {
        throw Object.assign(new Error(`Jev 返回了不完整或无效的分数（${invalid.join("、")}）`), { code: "invalid_response", retryable: true });
      }
      const marked = {};
      if (examples && examples.length) for (const r of replies) { const v = data?.answers?.[`${r.id}__marked`]?.noul; if (validScore(v)) marked[r.id] = v; }
      return { scores, invalid, marked, tokens: tokensOf(data), model: data.model };
    },
  });
}

// 帖子本身的几问（POST_QUESTIONS）。返回 {scores: {rec}, tokens}
export async function askPost(key, post, author, opts = {}) {
  return askJev(key, postState(post, author), POST_QUESTIONS, opts);
}

// 和你标记过的垃圾是不是同一类（0.26，用户：把标记为垃圾的发给 Jev 作为样例；尽量少发请求）：最近标的几条（MARKED_MAX）放进 state 的
// marked_spam，每条回复问一句。平时不多发请求：并进本来就要发的五问那个请求（buildPayload 的 examples），缓存里已经有分的不为这一问再问；
// 只有你刚标了一条时，把这一页上没清理的回复单独问一遍（askMarked，一个请求最多 MARKED_BATCH 条），同页的同伙马上跟着清理。
// YouTube 标过的评论上量的（jev_eval/code/learn/）：同一个视频里标一条现在漏掉的，并在五问的请求里问，≥ 0.6 时漏掉的 57 条多清理 10 条、
// 正常的 303 条一条没误伤；五问的分几乎不受样例影响（平均绝对差 0.004–0.024，按现在的门槛 399 条里只有 4 条折不折变了、都是垃圾）。
// 单独问时 AUC 0.959、漏掉的 188 条多清理 15 条、零误伤；拿别的视频里标的当样例，漏掉的 210 条只多 4 条——这批数据里漏掉的骗局回复跨视频很少重样
export const MARKED_QUESTION = "is it likely part of the same spam or scam campaign as any reply in `marked_spam` (replies this reader marked as spam elsewhere) - " +
  "for example a reworded version of the same message, a reply pushing the same person, account, link, contact, product or investment scheme, " +
  "a similar staged story or testimonial, or the same account again?";
// 样例最多 10 条、每条 240 字：每个请求多带的字少一点
export const MARKED_MAX = 10, MARKED_BATCH = 25; // 门槛在 settings.js 的 MARKED_THRESHOLD（内容脚本用）
const markedState = (examples) => examples.slice(0, MARKED_MAX).map((x) => ({ handle: x.handle || "", text: String(x.text || "").slice(0, 240) }));
export function buildMarkedPayload(post, replies, author, examples, model = MODEL) {
  const questions = Object.fromEntries(replies.map((r) => [`${r.id}__marked`, { type: "noul", instructions: { target_reply_id: r.id, question: HEAD + MARKED_QUESTION } }]));
  const state = {
    ...(author && (author.name || author.handle) ? { post_author: { name: author.name || "", handle: author.handle || "" } } : {}),
    post: (post || "").slice(0, 400),
    marked_spam: markedState(examples),
    replies: replies.map((r) => ({ id: r.id, author_name: r.name || "", handle: r.handle || "", text: (r.text || "").slice(0, 600) })),
  };
  return { model, state, questions };
}
// 缓存：键 "marked:" + 回复 id，指纹里带问题、样例（标了新的、删了一条，旧结果都不算）、帖子和这条回复
export async function markedRequests(postId, post, replies, author, examples) {
  const ctx = ["marked", MODEL, MARKED_QUESTION, markedState(examples), postId || "", post || "", author?.name || "", author?.handle || ""];
  return Promise.all(replies.map(async (r) => {
    const bytes = new TextEncoder().encode(JSON.stringify([...ctx, r.id, r.name || "", r.handle || "", r.text || ""]));
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return { id: `marked:${r.id}`, reply: r.id, fingerprint: Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, "0")).join("") };
  }));
}
// 返回 {scores: {回复 id: 0–1}, tokens}
export async function askMarked(key, post, replies, { author = null, examples = [], model = MODEL, ...opts } = {}) {
  return postJev(key, JSON.stringify(buildMarkedPayload(post, replies, author, examples, model)), {
    ...opts,
    parse: (data) => {
      const scores = {};
      for (const r of replies) {
        const v = data?.answers?.[`${r.id}__marked`]?.noul;
        if (!validScore(v)) throw Object.assign(new Error("Jev 返回了不完整或无效的分数（marked）"), { code: "invalid_response", retryable: true });
        scores[r.id] = v;
      }
      return { scores, tokens: tokensOf(data) };
    },
  });
}

// 通用提问：state 是任意 JSON（问题里用 `字段名` 引用），questions 是 {名字: 问题}。返回 {scores: {名字: 0–1}, tokens}
export async function askJev(key, state, questions, { model = MODEL, ...opts } = {}) {
  const body = JSON.stringify({
    model, state,
    questions: Object.fromEntries(Object.entries(questions).map(([name, q]) => [name, { type: "noul", instructions: q }])),
  });
  return postJev(key, body, {
    ...opts,
    parse: (data) => {
      const scores = {};
      for (const name of Object.keys(questions)) {
        const v = data?.answers?.[name]?.noul;
        if (!validScore(v)) throw Object.assign(new Error(`Jev 返回了不完整或无效的分数（${name}）`), { code: "invalid_response", retryable: true });
        scores[name] = v;
      }
      return { scores, tokens: tokensOf(data), model: data.model };
    },
  });
}
