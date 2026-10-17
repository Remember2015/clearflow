// YouTube 评论区的本地规则：纯函数，不碰页面；内容脚本里挂到 globalThis.FFYTRules，Node 测试里 require 进来。
// 0.15.2 起只留**不靠话术、不分语言**的规则：看的是号和号之间的结构（一串里几个号配合、几个号吹同一个名字、同一个号重复）和 Jev 的分，
// 不再有照着眼下骗局说法写的正则（0.15.1 的"理财骗局开头""诉苦求带""短勾人话"清单都删了）。语义那一层交给 Jev 新问的 setup
// （jev.js 的 EXTRA_QUESTIONS：编的发财 / 找回 / 落难故事，或者托儿式的提问、作证、推荐、联系方式暗示）。
// 依据（2026-10-14，脚本在 feed-filter/jev_eval/code/yt_comments/，抽来的评论和标签只留本机）。折对 / 折错，0.15.1 → 0.15.2：
// - 训练集（45 个视频、4728 条、人工标 1815 条）：345 / 19 → 401 / 21（召回 66% → 77%）。
// - 验证集（换一批英文搜索词的 22 个视频，两版折了的都人工看过）：156 / 13 → 174 / 16。
// - 多语言集（西、葡、德、法、印地、印尼、日、韩、中的理财视频，加账号找回、免费 Robux、菜谱，32 个视频、3679 条，规则定完才抽的）：297 / 14 → 350 / 17。
// - 改写集（90 串标过的评论交给模型改写：意思和角色不变，措辞、人名、金额、联系平台全换，再译成 9 种语言）：169 / 3 → 220 / 5；
//   0.15.1 的正则在改写后从抓 22 条掉到 2 条，setup（≥0.7）从 168 条到 162 条——话术一换，正则就失效，语义问题几乎不受影响。
(function () {
  // ---------- 名字比较（冒充频道主）：转小写、去掉 @ 和符号，长得像的字换成一样的（0→o、1/i/|→l、rn→m、vv→w） ----------
  const fold = (s) => String(s || "").normalize("NFKC").toLowerCase().replace(/^@+/, "").replace(/rn/g, "m").replace(/vv/g, "w").replace(/[0]/g, "o").replace(/[1i|!]/g, "l").replace(/[5]/g, "s").replace(/[^\p{L}\p{N}]/gu, "");
  function lookalike(author, owner) {
    const a = fold(author), o = fold(owner);
    if (o.length < 4 || a.length < 4) return false;
    if (a === o) return true;
    if (a.startsWith(o) && a.length - o.length <= 8 && !/^(fan|fans|lover|lovers|army|stan|clips?|edits?|daily|news|world)/.test(a.slice(o.length))) return true; // RickAstley-x7k2 这种
    return false;
  }

  // ---------- 字数 ----------
  const CJK = /[぀-ヿ㐀-鿿가-힯]/;
  const words = (s) => (String(s || "").replace(/https?:\/\/\S+|@\S+/g, " ").match(/[\p{L}\p{N}']+/gu) || []).length;
  // 一两个词的短评论（"Cardano!""Realme 14 pro""@MrBeast"）证据太少，Jev 常给 0.6 上下：要多 0.25 才折。中日韩文不按词数算（"加我微信"是一个"词"），不算短
  const isShort = (s) => !CJK.test(s || "") && words(s) <= 3;

  // ---------- 只贴了一个链接（可以带几个 @） ----------
  const LINK_ONLY = /^\s*(?:@\S+\s+)*https?:\/\/\S+\s*$/;
  const linkOnly = (s) => LINK_ONLY.test(String(s || ""));

  // ---------- 成群吹同一个名字（一页上的） ----------
  // 名字：大写开头的词或两个词、带数字的词、全大写的词，常见词不算（拉丁字母写的；人名、币名、书名在各种语言的骗局里多半是这样写的）
  const STOP = new Set(("i the a an and but or so if it its this that these those we you he she they my your our their his her what who why how when where which " +
    "thanks thank great good love like just very really also please yes no not can will would should could do does did is are was were be been have has had " +
    "bitcoin btc eth ethereum crypto gold silver trump us usa america american god lol omg wow hi hello hey dear sir mr mrs ms dr youtube").split(" "));
  function names(text) {
    const out = new Set();
    for (const tk of String(text || "").match(/\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|[A-Za-z]+\d+[A-Za-z\d]*|[A-Z]{3,})\b/g) || []) {
      const ws = tk.toLowerCase().split(/\s+/);
      if (ws.every((w) => STOP.has(w)) || tk.length < 4) continue;
      out.add(ws.filter((w) => !STOP.has(w)).join(" "));
    }
    return out;
  }
  // 句首的大写词（"There""Llevo""Thanks"）不一定是名字：这一页上至少有一次是在句子中间大写的才算（多语言集上"Llevo un tiempo…""There was…"凑成过一群）
  const MIDCAP = /(?<=[A-Za-z0-9,;:'"’)] )([A-Z][a-z]+|[A-Z]{3,}|[A-Za-z]+\d+[A-Za-z\d]*)\b/g;
  function midcapWords(items) {
    const out = new Set();
    for (const it of items) for (const m of String(it.text || "").matchAll(MIDCAP)) out.add(m[1].toLowerCase());
    return out;
  }
  const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const who = (x) => String(x.handle || x.id).toLowerCase();
  // items: [{id, handle, text, op, scores}]；skip：视频标题和频道名（里面有的名字不算）；med："引流"分的中位数要到多少。
  // 同一个名字三个以上的号在说、这几条的中位数够了、而且不是一两个词报个名（中位字数 ≥ 5，"Cardano!""AND CARDANO"不算），
  // 名字在这一页上至少有一次出现在句子中间。
  // 返回 Map(id → {n: 几个号, name: 原文里的写法})
  function shillClusters(items, skip, med) {
    const by = new Map(), out = new Map(), mid = midcapWords(items);
    for (const it of items) {
      if (it.op) continue;
      for (const n of names(it.text)) {
        if (skip.includes(n) || !n.split(" ").some((w) => mid.has(w))) continue;
        if (!by.has(n)) by.set(n, []);
        by.get(n).push(it);
      }
    }
    for (const [n, xs] of by) {
      const ws = new Set(xs.map(who)), scored = xs.filter((x) => x.scores);
      if (ws.size < 3 || scored.length < 3 || median(scored.map((x) => x.scores.benefit)) < med || median(xs.map((x) => words(x.text))) < 5) continue;
      const shown = xs[0].text.match(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "i"))?.[0] || n;
      for (const x of xs) if (!out.has(x.id)) out.set(x.id, { n: ws.size, name: shown });
    }
    return out;
  }

  // ---------- 一串回复里一唱一和 ----------
  // 骗局常是一串"剧本"：有人开头（晒收益、诉苦、提问），几个号接着问"你跟的谁"、有人报出一个人名或项目、有人给联系方式、几个号跟着夸。
  // 一条条看，问的、夸的分都不高；串起来看就清楚。不看说了什么，只看结构和分：一串（一级评论 + 它的回复；回复的 id 是"一级的 id.回复的 id"）
  // 里至少 3 条回复，有一条回复"引流"到了阈值 th 或者 setup 到了 setupTh，不同的号里至少两个"引流"≥ th − 0.3、"伪装的推广"≥ th − 0.1
  // 或者 setup ≥ setupTh − 0.2：这几个号在这一串里的话都折，开头那条是其中一个号发的也折。频道主（op）的不算、不折。返回 Map(id → {n: 几个号})
  function scamThreads(items, th, setupTh = 1.01) {
    const by = new Map(), out = new Map();
    for (const it of items) { const r = it.id.split(".")[0]; if (!by.has(r)) by.set(r, []); by.get(r).push(it); }
    const sp = (x) => (typeof x.scores?.setup === "number" ? x.scores.setup : 0);
    for (const xs of by.values()) {
      const reps = xs.filter((x) => x.id.includes(".") && !x.op);
      if (reps.length < 3 || !reps.some((x) => x.scores && (x.scores.benefit >= th || sp(x) >= setupTh))) continue;
      const parts = new Set(reps.filter((x) => x.scores && (x.scores.benefit >= th - 0.3 || x.scores.disguised >= th - 0.1 || sp(x) >= setupTh - 0.2)).map(who));
      if (parts.size < 2) continue;
      for (const x of xs) if (!x.op && parts.has(who(x))) out.set(x.id, { n: parts.size });
    }
    return out;
  }

  // ---------- 同一个号把同一句话发好几遍 ----------
  // 去掉 @ 和符号后一样、至少 12 个字、发了 3 遍以上（回给不同的人也算）。返回 Map(id → {n: 几遍})
  function selfRepeat(items) {
    const by = new Map(), out = new Map();
    for (const it of items) {
      if (it.op) continue;
      const n = String(it.text || "").toLowerCase().replace(/@\S+/g, "").replace(/[^\p{L}\p{N}]/gu, "");
      if (n.length < 12) continue;
      const k = who(it) + "\n" + n;
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(it);
    }
    for (const xs of by.values()) if (xs.length >= 3) for (const x of xs) out.set(x.id, { n: xs.length });
    return out;
  }

  const api = { lookalike, words, isShort, linkOnly, names, shillClusters, scamThreads, selfRepeat };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.FFYTRules = Object.freeze(api);
})();
