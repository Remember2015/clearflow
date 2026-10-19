// zhconv.js（0.29.0，scripts/build-zhconv.py 用 OpenCC 的词表生成）：繁体 → 简体，台湾、香港用词换成大陆用词。node test/zhconv_test.cjs
const assert = require("node:assert/strict");
require("../zhconv.js");
const Z = globalThis.FFZhConv;
const out = [];
const ok = (name, fn) => { try { fn(); out.push(`PASS ${name}`); } catch (e) { out.push(`FAIL ${name}: ${e.message}`); } };
ok("字形：繁体字换成简体字", () => assert.equal(Z.convert("這些研究人員開始著手測量——我有收到那封電子郵件嗎？", "tw2sp"), "这些研究人员开始着手测量——我有收到那封电子邮件吗？"));
ok("台湾用词换成大陆用词", () => assert.equal(Z.convert("這部影片介紹了軟體和網路資訊安全", "tw2sp"), "这部视频介绍了软件和网络信息安全"));
ok("一个繁体字对多个简体字的按词定（頭髮、發財、乾了）", () => assert.equal(Z.convert("頭髮已經乾了，發財了", "tw2sp"), "头发已经干了，发财了"));
ok("香港：hk2sp 只换香港的写法，粤语字不动", () => assert.equal(Z.convert("呢個軟件好正，我哋一齊睇", "hk2sp"), "呢个软件好正，我哋一齐睇"));
ok("t2s：只转字形、不换用词", () => assert.equal(Z.convert("這部影片", "t2s"), "这部影片"));
ok("简体、英文、表情原样留着", () => assert.equal(Z.convert("已经是简体 English 😀 123", "tw2sp"), "已经是简体 English 😀 123"));
ok("不认识的方案原样返回", () => assert.equal(Z.convert("這部影片", "nope"), "這部影片"));
console.log(out.join("\n"));
process.exit(out.some((l) => l.startsWith("FAIL")) ? 1 : 0);
