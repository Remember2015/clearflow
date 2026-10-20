// 界面文字的一致性（不开浏览器）：19 种主流语言都在、键和占位符和英文一致，X 和浏览器给的语言代码都能对上，_locales 齐全。
// node test/i18n_test.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const load = (f) => { delete globalThis.FFI18nStrings; new Function(fs.readFileSync(path.join(ROOT, f), "utf8"))(); return globalThis.FFI18nStrings; };
const page = load("i18n_page.js"), all = load("i18n_all.js");
require(path.join(ROOT, "i18n.js"));
const I = globalThis.FFI18n;
const out = [];
const ok = (name, fn) => { try { fn(); out.push(`PASS ${name}`); } catch (e) { out.push(`FAIL ${name}: ${e.message}`); } };
const PH = /\{(\w+)\}/g;
const X_LANGS = ["ar", "ar-x-fm", "bn", "en-gb", "bg", "ca", "hr", "cs", "da", "nl", "en", "fil", "fi", "fr", "de", "el", "gu", "he", "hi", "hu", "id",
  "it", "ja", "kn", "ko", "msa", "mr", "no", "fa", "pl", "pt", "ro", "ru", "sr", "zh-cn", "sk", "es", "sv", "ta", "th", "zh-tw", "tr", "uk", "ur", "vi"];

const KEEP = ["en", "zh-CN", "zh-TW", "ja", "ko", "es", "pt", "fr", "de", "it", "ru", "ar", "tr", "id", "hi", "th", "vi", "pl", "nl"];
ok("19 种主流语言都在；X 的 45 个显示语言里别的退回英文（阿拉伯语阴性、英式英语并进 ar、en）", () => {
  assert.deepEqual(Object.keys(all).sort(), [...KEEP].sort());
  const mapped = Object.fromEntries(X_LANGS.map((l) => [l, I.pick(l)]));
  for (const k of KEEP) assert.ok(Object.values(mapped).includes(k), `${k} 不是 X 的显示语言`);
  for (const [l, to] of Object.entries(mapped)) assert.ok(to === "en" || KEEP.includes(to), `${l} → ${to}`);
  assert.equal(mapped["ar-x-fm"], "ar"); assert.equal(mapped["en-gb"], "en"); assert.equal(mapped.ur, "en"); assert.equal(mapped.msa, "en");
});
ok("每种语言的键和英文一样、占位符一样", () => {
  const en = all.en;
  for (const [c, d] of Object.entries(all)) {
    assert.deepEqual(Object.keys(d).sort(), Object.keys(en).sort(), `${c} 键不一致`);
    for (const k of Object.keys(en)) assert.deepEqual([...d[k].matchAll(PH)].map((m) => m[1]).sort(), [...en[k].matchAll(PH)].map((m) => m[1]).sort(), `${c} ${k}`);
  }
});
ok("没有照抄中文的（0.29.4）：日文里没有一长串汉字、一个假名都没有的句子；简繁中文和日文以外的语言里没有汉字", () => {
  const HAN = /[\u3400-\u9fff]/, KANA = /[\u3040-\u30ff]/;
  for (const [k, v] of Object.entries(all.ja)) assert.ok([...v].filter((ch) => HAN.test(ch)).length < 6 || KANA.test(v), `ja ${k}：${v.slice(0, 30)}`);
  for (const [c, d] of Object.entries(all)) if (!["zh-CN", "zh-TW", "ja"].includes(c)) for (const [k, v] of Object.entries(d)) assert.ok(!HAN.test(v), `${c} ${k}：${v.slice(0, 30)}`);
});
ok("内容脚本那份只带 X 页面要用的键，语言一样多", () => {
  assert.deepEqual(Object.keys(page).sort(), Object.keys(all).sort());
  for (const k of Object.keys(page.en)) assert.ok(/^(tx|reason|kind|cat|cs|bar|banner|err|filler|group|mark|heavy|app)\.|^c\.notDone$/.test(k), k);
  for (const k of ["tx.improved", "cat.spam.tag", "bar.ask", "banner.bait", "err.timeout", "c.notDone", "filler.line", "filler.tag"]) assert.ok(page.ja[k], k);
});
ok("语言代码对得上：X 的 ar-x-fm / en-gb / zh-cn / zh-tw，浏览器的 zh-Hant / pt-BR / es-419，老代码 in；不做的语言和认不得的用英文", () => {
  const cases = { "ar-x-fm": "ar", "en-gb": "en", "zh-cn": "zh-CN", zh: "zh-CN", "zh-tw": "zh-TW", "zh-Hant-TW": "zh-TW", "zh-HK": "zh-TW",
    "pt-BR": "pt", "pt-PT": "pt", in: "id", id: "id", "es-419": "es", ja: "ja", "nl-BE": "nl", msa: "en", ur: "en", sv: "en", nb: "en", "xx-YY": "en", "": "en" };
  for (const [from, to] of Object.entries(cases)) assert.equal(I.pick(from), to, from);
});
ok("单复数（0.24）：数字 n 按这种语言的复数规则挑 键.one / 键.few，变体里也带 {n}（俄语的 one 还包括 21）", () => {
  for (const [l, k, n, want] of [["en", "filler.line", 1, "Hid 1 reply like"], ["en", "filler.line", 2, "Hid 2 replies like"], ["de", "filler.lineShown", 1, "1 Antwort wie"],
    ["pl", "filler.lineShown", 21, "21 odpowiedzi"], ["zh-CN", "filler.line", 1, "清理了 1 条"]]) {
    const d = all[l], rule = new Intl.PluralRules(l).select(n), s = (d[`${k}.${rule}`] ?? d[k]).replace("{n}", n);
    assert.ok(s.startsWith(want), `${l} ${n}: ${s}`);
  }
  for (const [l, d] of Object.entries(all)) for (const k of Object.keys(d)) if (/\.(one|few)$/.test(k)) assert.ok(d[k].includes("{n}"), `${l} ${k}`);
});
ok("缺的键退回英文，乱写的键原样返回", () => {
  globalThis.FFI18nStrings = { en: { "a.b": "Hello {n}" }, ja: {} };
  assert.equal(I.t("a.b", { n: 3 }), "Hello 3");
  assert.equal(I.t("no.such"), "no.such");
  globalThis.FFI18nStrings = all;
});
ok("_locales：插件名、按钮提示、简介都在，简介不超过 132 字，目录名是 Chrome 认的", () => {
  const CHROME = new Set(["ar", "am", "bg", "bn", "ca", "cs", "da", "de", "el", "en", "en_AU", "en_GB", "en_US", "es", "es_419", "et", "fa", "fi", "fil", "fr",
    "gu", "he", "hi", "hr", "hu", "id", "it", "ja", "kn", "ko", "lt", "lv", "ml", "mr", "ms", "nl", "no", "pl", "pt_BR", "pt_PT", "ro", "ru", "sk", "sl", "sr",
    "sv", "sw", "ta", "te", "th", "tr", "uk", "vi", "zh_CN", "zh_TW"]);
  const dirs = fs.readdirSync(path.join(ROOT, "_locales"));
  assert.equal(dirs.length, 21, dirs.join(","));  // 19 种，西班牙语、葡萄牙语各两个目录
  for (const d of dirs) {
    assert.ok(CHROME.has(d), `${d} 不是 Chrome 认的目录名`);
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, "_locales", d, "messages.json"), "utf8"));
    for (const k of ["extName", "extTitle", "extDesc"]) assert.ok(m[k] && m[k].message, `${d} ${k}`);
    assert.ok(m.extDesc.message.length <= 132, `${d} 简介 ${m.extDesc.message.length} 字`);
  }
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  assert.equal(man.default_locale, "en");
  assert.ok(dirs.includes("en"));
});
ok("从右往左的语言：阿拉伯语是；波斯语、希伯来语、乌尔都语不做，退回英文", () => {
  for (const [l, rtl] of [["ar", true], ["ar-x-fm", true], ["fa", false], ["he", false], ["ur", false], ["ja", false], ["en", false]]) {
    globalThis.FFI18nStrings = all;
    assert.equal(new Set(["ar", "fa", "he", "ur"]).has(I.pick(l)), rtl, l);
  }
});
console.log(out.join("\n"));
process.exitCode = out.some((l) => l.startsWith("FAIL")) ? 1 : 0;
