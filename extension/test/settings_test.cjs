const assert = require("node:assert/strict");
require("../settings.js");
const { DEFAULTS, normalize, validate } = globalThis.FFSettings;
for (const value of ["", "  ", null, NaN, Infinity, -1, 1, {}, []]) {
  assert.equal(validate({ threshold: value }).settings, null, `threshold ${String(value)} must fail`);
  assert.equal(normalize({ threshold: value }).threshold, DEFAULTS.threshold);
}
for (const [key, bad] of [["cacheMB", 0], ["cacheMB", 501], ["txCacheMB", 4], ["txCacheMB", 501], ["m1MaxLen", 15.1], ["m1MaxLen", 41],
  ["abuseThreshold", .1], ["sexualThreshold", .1], ["recThreshold", 1], ["bannerRatio", 0], ["translateFill", "false"], ["enabled", 0]]) {
  assert.ok(validate({ [key]: bad }).error, key);
  assert.equal(normalize({ [key]: bad })[key], DEFAULTS[key], key);
}
const good = validate({ threshold: "0.61", cacheMB: "5", txCacheMB: "200", m1MaxLen: "40", enabled: false, translateFill: false, feedObserve: true });
assert.equal(good.error, null);
assert.equal(good.settings.txCacheMB, 200); // 译文的缓存上限和过滤结果的分开设
assert.equal(DEFAULTS.txCacheMB, 50);
assert.equal(good.settings.threshold, .61);
assert.equal(good.settings.m1MaxLen, 40);
assert.equal(good.settings.enabled, false);
assert.equal(good.settings.translateFill, false);
assert.equal(good.settings.feedObserve, undefined); // 0.11 去掉的首页记录开关：旧数据里有也不留
assert.equal(normalize({ threshold: .61 }).threshold, .61);
assert.equal(normalize({ threshold: ".61" }).threshold, .6);
assert.equal(normalize({ unknown: true }).unknown, undefined);
assert.deepEqual(normalize(null), { ...DEFAULTS, sites: {} });
console.log("PASS shared settings: empty/type/range/integer/old-data normalization and 0.61");

// 0.20 每个网站的设置：只认识的网站、这个网站用得上的项、合法的值；forSite 盖上去；网址认网站
const { forSite, siteOf } = globalThis.FFSettings;
const raw = { threshold: 0.6, abuse: true, sites: { reddit: { fold: false, threshold: 0.5, m1: false }, hn: { threshold: 0.4, sexual: false }, yt: { images: true }, bogus: { fold: false } } };
assert.deepEqual(normalize(raw).sites, { reddit: { fold: false, threshold: 0.5 }, hn: { sexual: false } }); // m1 不归网站管、HN 没有垃圾那一档、YouTube 没有看图片
const rd = forSite(raw, "reddit");
assert.equal(rd.enabled, false); assert.equal(rd.translate, true); assert.equal(rd.threshold, 0.5);
assert.equal(forSite(raw, "hn").sexual, false); assert.equal(forSite(raw, "hn").threshold, 0.6);
assert.equal(forSite(raw, "x").threshold, 0.6); assert.equal(forSite(raw, "x").enabled, true);
assert.equal(forSite(raw, null).threshold, 0.6); // 不是网站发来的：默认的那一份
assert.equal(forSite({ enabled: false }, "x").enabled, false); // 以前的总开关（升级时折进各网站）照样管用
assert.equal(validate({ sites: { reddit: { threshold: 2 } } }).settings, null);
assert.equal(validate({ sites: { hn: { threshold: 0.5 } } }).settings, null);
assert.equal(validate({ sites: { nope: { fold: false } } }).settings, null);
assert.equal(validate({ sites: { x: { fold: "no" } } }).settings, null);
assert.deepEqual(validate({ sites: { x: { fold: false, images: true } } }).settings.sites, { x: { fold: false, images: true } });
assert.equal(siteOf("https://news.ycombinator.com/item?id=1"), "hn");
assert.equal(siteOf("https://twitter.com/a"), "x");
assert.equal(siteOf("https://www.rednote.com/explore"), "xhs");
assert.equal(siteOf("https://old.reddit.com/"), null); // 插件只认新版 www.reddit.com
assert.equal(siteOf("https://www.google.com/"), null);
assert.equal(siteOf(undefined), null);
// 0.21 每个网站的总开关 on：关了清理、翻译都不做；存着的清理、翻译开关不动
const offX = forSite({ sites: { x: { on: false, fold: true } } }, "x");
assert.equal(offX.enabled, false); assert.equal(offX.translate, false);
assert.deepEqual(validate({ sites: { x: { on: false } } }).settings.sites, { x: { on: false } });
assert.equal(validate({ sites: { x: { on: "off" } } }).settings, null);
console.log("PASS per-site settings: sites validation, forSite overrides, siteOf hosts, site master switch");
