// rules.js 0.19.1 加的两条本地结构规则（用法：node test/rules_near_test.cjs）：
//   hiddenChars  字里塞了看不见的字符（零宽字符），表情序列、连写文字、方向标记里的正常用法不算
//   D1 近乎一样的模板（findDupSlogans 的 mergeNear）：换掉推的号 / 链接、改一两个字的同一句话也算一组；短句要每条带链接；增量算和全量一样
// 句子都是编的（不放采来的真实回复）。
const assert = require("assert");
const R = require("../rules.js");
const out = [];
const ok = (name, cond, extra = "") => { out.push(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : " " + extra}`); };
const ZW = ["​", "‌", "‍", "⁠"];
const stuff = (s) => [...s].map((c, i) => c + ZW[i % 4] + ZW[(i + 1) % 4]).join("");

// ---------- 看不见的字符 ----------
ok("每个字中间塞零宽字符：算", R.hiddenChars(stuff("快来看我主页有惊喜")) > 0 && R.localVerdict(stuff("快来看我主页有惊喜"), new Set())?.kind === "hidden");
ok("英文也一样", R.hiddenChars(stuff("check my profile for more")) > 0);
ok("表情序列里的 ZWJ（一家人、职业、彩虹旗）不算", !R.hiddenChars("我家 👨‍👩‍👧‍👦👨‍👩‍👧‍👦 还有 👩‍💻🧑‍🍳🏳️‍🌈 哈哈"));
ok("波斯文的 ZWNJ 不算", !R.hiddenChars("می‌خواهم برم خونه و می‌دونم که نمی‌تونم بیام چون کار دارم"));
ok("印地文的 ZWJ / ZWNJ 不算", !R.hiddenChars("क्‍ष र्‍य क्‌ष यह एक सामान्य वाक्य है"));
ok("阿拉伯文里的方向标记不算", !R.hiddenChars("‏هذا ‏تعليق ‏عادي ‏جدا ‏مع ‏علامات"));
ok("长文里偶尔一两个零宽字符（复制粘贴带进来的）不算", !R.hiddenChars("This is a long ordinary comment​ that someone pasted from somewhere​ else, nothing hidden here at all."));
ok("零宽字符多但字也多（不到四分之一）不算", !R.hiddenChars("a​bcdefghijklmnop​qrstuvwxyz​ abcdefghijklmnopqrstuvwxyz​"));
ok("没有字、全是零宽字符：算", R.hiddenChars("​‌⁠​⁠") > 0);

// ---------- 近乎一样的模板 ----------
const it = (id, handle, text) => ({ id, handle, text, time: null });
const tpl = (name) => `大家快去看（${name}）的主页，最新的视频都在那里，晚了就被删了，赶紧看`;
let g = R.findDupSlogans([it(1, "a", tpl("小羊一号")), it(2, "b", tpl("猫猫二号")), it(3, "c", tpl("宝藏三号")), it(4, "d", "这个说法我不同意，太片面了")], "帖子正文");
ok("长句模板只换推的号：3 个号算一组", g.size === 1 && JSON.stringify([...g.values()][0].sort()) === "[1,2,3]", JSON.stringify([...g.entries()]));
ok("只认一字不差时（near: false）认不出", R.findDupSlogans([it(1, "a", tpl("小羊一号")), it(2, "b", tpl("猫猫二号")), it(3, "c", tpl("宝藏三号"))], "", { near: false }).size === 0);
ok("同一个模板只有 2 个号：不算", R.findDupSlogans([it(1, "a", tpl("小羊一号")), it(2, "b", tpl("猫猫二号"))], "").size === 0);
ok("同一个号发 3 次：不算", R.findDupSlogans([it(1, "a", tpl("小羊一号")), it(2, "a", tpl("猫猫二号")), it(3, "a", tpl("宝藏三号"))], "").size === 0);
g = R.findDupSlogans([it(1, "a", "这个是不是那个谁啊\nhttps://s.example/AAA111"), it(2, "b", "这个是不是那个谁啊\nhttps://s.example/BBB222"), it(3, "c", "这个是不是这个谁啊🤔\nhttps://s.example/CCC333")], "");
ok("短句 + 每条换一个链接、偶尔改一个字：算一组", g.size === 1 && [...g.values()][0].length === 3, JSON.stringify([...g.entries()]));
ok("短句不带链接：差一个字的不并（真人也常说得差不多）", R.findDupSlogans([it(1, "a", "这个是不是那个谁啊"), it(2, "b", "这个是不是那个谁啊"), it(3, "c", "这个是不是这个谁啊")], "").size === 0);
ok("短句只有一部分带链接：不并", R.findDupSlogans([it(1, "a", "这个是不是那个谁啊 https://s.example/A1"), it(2, "b", "这个是不是那个谁啊 https://s.example/B2"), it(3, "c", "这个是不是这个谁啊")], "").size === 0);
ok("说法差得多的长句不并", R.findDupSlogans([it(1, "a", "我觉得这个政策对年轻人影响很大，房价还会继续涨"), it(2, "b", "这个政策对老年人没什么影响，主要还是看退休金"), it(3, "c", "政策出来以后我家附近的房价反而跌了不少")], "").size === 0);
ok("主帖里要大家刷的那句话不算", R.findDupSlogans([it(1, "a", tpl("小羊一号")), it(2, "b", tpl("猫猫二号")), it(3, "c", tpl("宝藏三号"))], tpl("小羊一号") + tpl("猫猫二号") + tpl("宝藏三号")).size === 0);
ok("英文模板（故意打错字）也认", R.findDupSlogans([it(1, "a", "For anyone new to crypto: stop staring at short charts, I lost a lot until a mentor helped me"),
  it(2, "b", "For anyone new to TRADING: stop staring at short charts, I lost a lot until a mentor helped me"), it(3, "c", "For anyone new to TRDAING: stop staring at short charts, I lost a lot until a mentor helped me")], "").size === 1);
// 一字不差的组还是原样（键就是那句话）
g = R.findDupSlogans([it(1, "a", "快来看我主页有惊喜哦"), it(2, "b", "快来看我主页有惊喜哦！"), it(3, "c", "快来看我主页有惊喜哦😂")], "");
ok("一字不差的组照旧，键是那句话", g.size === 1 && [...g.keys()][0] === R.normSlogan("快来看我主页有惊喜哦"));

// ---------- 编辑距离（只算带子）和完整的一样 ----------
const full = (a, b) => { let p = Array.from({ length: b.length + 1 }, (_, j) => j), c = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) { c[0] = i; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); [p, c] = [c, p]; } return p[b.length]; };
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
let bad = 0;
for (let k = 0; k < 5000; k++) {
  const s = () => Array.from({ length: 1 + Math.floor(rnd() * 16) }, () => "abcd"[Math.floor(rnd() * 4)]);
  const a = s(), b = s(), max = Math.floor(rnd() * 7), f = full(a, b);
  if (R.editDistance(a, b, max) !== (f <= max ? f : max + 1)) bad++;
}
ok("编辑距离：5000 对随机串和完整算法一样", bad === 0, `不一样 ${bad} 对`);

// ---------- 增量（同一个页面越滚越多）和全量一样 ----------
const page = [];
// 普通评论：从一堆词里随机拼，说法各不一样（只差几个数字的其实也是模板，会并）
const WORDS = ["今天", "我觉得", "这个", "视频", "说得", "挺好", "不过", "有点", "太长", "了", "上次", "看到", "类似的", "内容", "还是", "这里", "讲得", "清楚", "支持", "一下",
  "作者", "辛苦", "希望", "多更新", "关于", "价格", "问题", "其实", "大家", "都", "知道", "只是", "没人", "说", "我家", "孩子", "也", "喜欢", "学到", "很多"];
const sentence = () => Array.from({ length: 6 + Math.floor(rnd() * 10) }, () => WORDS[Math.floor(rnd() * WORDS.length)]).join("");
for (let i = 0; i < 300; i++) page.push(it(i, "u" + i, i % 10 === 0 ? tpl("号" + i) : sentence()));
const cache = R.nearState();
let same = true;
for (let n = 10; n <= page.length; n += 10) {
  const a = R.findDupSlogans(page.slice(0, n), "", { nearCache: cache }), b = R.findDupSlogans(page.slice(0, n), "");
  const norm = (m) => JSON.stringify([...m.values()].map((x) => [...x].sort((p, q) => p - q)).sort());
  if (norm(a) !== norm(b)) { same = false; break; }
}
const last = R.findDupSlogans(page, "", { nearCache: cache });
ok("增量算和每次从头算结果一样（30 次）", same);
ok("模板那 30 条并成一组", last.size === 1 && [...last.values()][0].length === 30, JSON.stringify([...last.values()].map((x) => x.length)));

// ---- 你标记的垃圾，本地比（0.27，markedMatch）----
{
  const L = (p) => `是这一部吧https://\nt.cn/${p}`;
  const P = R.markedPrep([{ raw: L("FAKE0001"), text: R.normSlogan(L("FAKE0001")) }]);
  const m = (t) => R.markedMatch(t, P)?.kind || null;
  ok("标记：一模一样（连链接、空白不算）→ same", m("是这一部吧 https://t.cn/FAKE0001") === "same");
  ok("标记：短句换了链接、少一个字 → near（5 个字许差 1 个，0.2×5 浮点取整不能是 0）", m("是这部吧\nhttps://\nt.cn/FAKE0002") === "near");
  ok("标记：同一句话不带链接 → 不算（短句要两边都带链接）", m("是这一部吧") === null);
  ok("标记：别的短句带链接 → 不算", m("看这个 https://t.cn/FAKE0003") === null && m("你说的是哪部 https://t.cn/FAKE0004") === null);
  const P2 = R.markedPrep([{ raw: "https://t.cn/ONLYLINK1" }, { raw: "看 https://x.com/" }]);
  ok("标记：只有链接的样例按链接认，不和别的只有链接的回复算像", R.markedMatch("快来 https://t.cn/ONLYLINK1", P2)?.kind === "link" && R.markedMatch("https://t.cn/OTHERLNK2", P2) === null);
  ok("标记：只有大站域名的链接不算同一个链接", R.markedMatch("看看 https://x.com/", P2) === null);
  ok("标记：旧格式（只有去掉标点的那句，够长）照样一字不差地认", R.markedMatch("这是一句很长的旧版记住的话术！", R.markedPrep([{ text: "这是一句很长的旧版记住的话术" }]))?.kind === "near");
  ok("标记：没有样例 → null", R.markedMatch("随便一句", []) === null);
}
console.log(out.join("\n"));
const fails = out.filter((l) => !l.startsWith("PASS")).length;
console.log(fails ? `${fails} 项没过` : `全过（${out.length} 项）`);
process.exit(fails ? 1 : 0);
