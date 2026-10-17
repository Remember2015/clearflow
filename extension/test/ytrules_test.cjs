// ytrules.js（YouTube 评论区的本地规则）的手写用例。规则只看结构和分，不看说了什么：用例里的句子是编的，换成什么语言结论都一样。
// 用法：node test/ytrules_test.cjs
const assert = require("node:assert/strict");
const Y = require("../ytrules.js");
const R = require("../rules.js");

// ---- 不再有照着话术写的规则 ----
for (const k of ["bait", "LURE", "SHORT_LURE"]) assert.ok(!(k in Y), `${k} 应该删掉了`);

// ---- 短评论、只贴链接 ----
for (const s of ["Cardano!", "AND CARDANO", "Realme 14 pro", "@MrBeast", "WATCH INJECTIVE", "pregúntame cómo"]) assert.ok(Y.isShort(s), s);
for (const s of ["加我微信看主页", "@someone THAT IS THE USER NAME", "If one hits 100x, it's this coin."]) assert.ok(!Y.isShort(s), s);
for (const s of ["https://youtu.be/abcdEFG", "@someone https://www.youtube.com/watch?v=abcdEFGhijk", "  https://example.com/x  "]) assert.ok(Y.linkOnly(s), s);
for (const s of ["watch this https://youtu.be/abcdEFG", "https://youtu.be/a and https://youtu.be/b", "no link at all"]) assert.ok(!Y.linkOnly(s), s);

// ---- 一串回复里一唱一和 ----
const sc = (benefit, disguised = 0.1, setup) => ({ benefit, disguised, promo_mention: 0.1, abuse: 0.02, sexual: 0.01, ...(setup === undefined ? {} : { setup }) });
const thread = [
  { id: "yt_R1", handle: "@bait", text: "At 54, earning 41K biweekly… the money isn't even the highlight.", scores: sc(0.03) },
  { id: "yt_R1.a", handle: "@asker", text: "How did you do it?", scores: sc(0.04) },
  { id: "yt_R1.b", handle: "@pusher", text: "Credits go to Marla Quentin Hollis, one of the finest portfolio managers.", scores: sc(0.91, 0.86) },
  { id: "yt_R1.c", handle: "@fan", text: "This woman has really set the standard, we love her here!", scores: sc(0.24, 0.65) },
  { id: "yt_R1.d", handle: "@bait", text: "SHES MOSTLY ON TELEGRAMS", scores: sc(0.78) },
  { id: "yt_R1.e", handle: "@creator", text: "Please be careful, these are scams.", op: true, scores: sc(0.2) },
];
let g = Y.scamThreads(thread, 0.6, 0.7);
assert.deepEqual([...g.keys()].sort(), ["yt_R1", "yt_R1.b", "yt_R1.c", "yt_R1.d"]); // 开头那个号也在里面；只问了一句的、频道主的不折
assert.equal(g.get("yt_R1.b").n, 3);
// 换一个开头的号（被骗子借用的真人评论）：开头不折
g = Y.scamThreads(thread.map((x) => (x.id === "yt_R1" ? { ...x, handle: "@real" } : x)), 0.6, 0.7);
assert.ok(!g.has("yt_R1") && g.has("yt_R1.b"));
// 只有两条回复、或者只有一个号在推：不算
assert.equal(Y.scamThreads(thread.slice(0, 3), 0.6, 0.7).size, 0);
assert.equal(Y.scamThreads(thread.map((x) => (x.id === "yt_R1.c" || x.id === "yt_R1.d" ? { ...x, scores: sc(0.05) } : x)), 0.6, 0.7).size, 0);
// 阈值跟着设置走（少折 0.7 时 0.65 的锚点不够）；还没打分的不算参与者
const weaker = thread.map((x) => (x.id === "yt_R1.b" ? { ...x, scores: sc(0.65, 0.5) } : x.id === "yt_R1.d" ? { ...x, scores: sc(0.65) } : x));
assert.equal(Y.scamThreads(weaker, 0.7, 0.8).size, 0);
assert.equal(Y.scamThreads(weaker, 0.6, 0.7).size, 4);
assert.equal(Y.scamThreads(thread.map((x) => (x.id === "yt_R1.c" ? { ...x, scores: undefined } : x)), 0.6, 0.7).size, 3); // @fan 还没分：不在里面
// 不看语言、不看说法：一串西班牙语的，"引流"都不高（托儿不直接拉人），setup 高——一样认得出
const es = [
  { id: "yt_E1", handle: "@empiezo", text: "¿Alguien de verdad gana dinero con esto? Llevo meses perdiendo y ya no sé qué hacer.", scores: sc(0.03, 0.05, 0.62) },
  { id: "yt_E1.a", handle: "@animo", text: "Te entiendo, a mí me pasaba lo mismo hasta que alguien me guió.", scores: sc(0.12, 0.2, 0.66) },
  { id: "yt_E1.b", handle: "@guia", text: "Yo sigo a la señora Valeria Ostin, explica todo en vivo, búscala.", scores: sc(0.4, 0.3, 0.83) },
  { id: "yt_E1.c", handle: "@empiezo", text: "¿Cómo la contacto?", scores: sc(0.2, 0.1, 0.7) },
  { id: "yt_E1.d", handle: "@real", text: "Esto huele a estafa, cuidado.", scores: sc(0.02, 0.02, 0.1) },
];
g = Y.scamThreads(es, 0.6, 0.7);
assert.deepEqual([...g.keys()].sort(), ["yt_E1", "yt_E1.a", "yt_E1.b", "yt_E1.c"]); // 说"像骗局"的真人不折
assert.equal(Y.scamThreads(es, 0.6).size, 0); // 不给 setup 的门槛（别的站点）就只看引流，这串认不出
// 同一串、同样的分，换成中文写：结果一样（规则不读字）
const zh = es.map((x, i) => ({ ...x, text: ["真的有人靠这个赚到钱吗？", "我懂，我以前也这样。", "我跟着一位老师，直播里全讲，去搜她。", "怎么联系她？", "这像骗局，小心。"][i] }));
assert.deepEqual([...Y.scamThreads(zh, 0.6, 0.7).keys()].sort(), [...g.keys()].sort());

// ---- 同一个号发好几遍 ----
const rep = (h, t, i) => ({ id: `yt_x${i}`, handle: h, text: t });
const same = "Jesus loves you and tell your friends and family that if you want";
assert.equal(Y.selfRepeat([rep("@a", same, 1), rep("@a", "@bob " + same, 2), rep("@A", same + "!!", 3)]).size, 3);
assert.equal(Y.selfRepeat([rep("@a", same, 1), rep("@a", same, 2)]).size, 0);
assert.equal(Y.selfRepeat([rep("@a", same, 1), rep("@b", same, 2), rep("@c", same, 3)]).size, 0); // 不同的号是 D1 的事
assert.equal(Y.selfRepeat([rep("@a", "Amen 🙏", 1), rep("@a", "Amen", 2), rep("@a", "amen!", 3)]).size, 0); // 太短
assert.equal(Y.selfRepeat(["关注我的频道，每天分享赚钱的方法", "@某人 关注我的频道，每天分享赚钱的方法", "关注我的频道，每天分享赚钱的方法！"].map((t, i) => rep("@zh", t, i))).size, 3);

// ---- 成群吹同一个名字 ----
const coin = [["@a", "If Zorvium keeps building like this, it could have a huge launch."], ["@b", "My bags are all in on Zorvium, we're gonna fly!!!"],
  ["@c", "Zorvium got a green light on two big exchanges, this is huge."]].map(([h, t], i) => ({ id: `yt_c${i}`, handle: h, text: t, scores: sc(0.6) }));
g = Y.shillClusters(coin, "bitcoin price prediction cilinix", 0.45);
assert.equal(g.size, 3);
assert.deepEqual(g.get("yt_c0"), { n: 3, name: "Zorvium" });
assert.equal(Y.shillClusters(coin, "zorvium review", 0.45).size, 0); // 视频就是讲它的
const shortCoin = ["Cardano!", "AND CARDANO", "Cardano ❤"].map((t, i) => ({ id: `yt_s${i}`, handle: `@u${i}`, text: t, scores: sc(0.62) }));
assert.equal(Y.shillClusters(shortCoin, "", 0.45).size, 0); // 报个币名的短评论不算托儿

// 句首大写的普通词凑不成一群（"Llevo un tiempo…" 三个号都这么开头）；名字在句子中间出现过才算
const llevo = ["Llevo un tiempo siguiendo a Talia y me encanta cómo explica todo.", "Llevo un tiempo aprendiendo trading y tus videos me ayudan mucho.",
  "Llevo un tiempo siguiendo a Madalyn, explica las inversiones con calma."].map((t, i) => ({ id: `yt_l${i}`, handle: `@l${i}`, text: t, scores: sc(0.6) }));
assert.deepEqual([...new Set([...Y.shillClusters(llevo, "", 0.45).values()].map((x) => x.name))], []);
const veraStart = ["Veraxum is going to fly this year, I am all in.", "Veraxum just got listed on two exchanges, huge news.", "My bags are full of Veraxum, see you at the top."]
  .map((t, i) => ({ id: `yt_v${i}`, handle: `@v${i}`, text: t, scores: sc(0.6) }));
assert.equal(Y.shillClusters(veraStart, "", 0.45).size, 3); // 名字有一次在句子中间就认

// ---- 冒充频道主 ----
assert.ok(Y.lookalike("@RickAstIey-x7k2", "Rick Astley"));
assert.ok(!Y.lookalike("@RickAstleyFans", "Rick Astley"));

// ---- D1 的句子长度按汉字当量算（0.15.3 起各站点一样，YouTube 不再单设 16 个字符）：英文短句真人也会撞，不算 ----
const three = (ts) => ts.map((t, i) => ({ id: `h${i}`, handle: `@h${i}`, text: t, time: null }));
assert.equal(R.findDupSlogans(three(["hows it going", "Hows it going", "How's it going?"]), "").size, 0);
assert.equal(R.findDupSlogans(three(Array(3).fill("Check out this video on YouTube:")), "").size, 1);
assert.equal(R.findDupSlogans(three(Array(3).fill("快来看我的主页有惊喜")), "").size, 1);
assert.equal(R.findDupSlogans(three(Array(3).fill("快来看我的主页有惊喜")), "", { minUnits: 12 }).size, 0);

console.log("ytrules ok");
