import assert from "node:assert/strict";
const store = {
  ff_slogans: ["这是之前自动学到的不可信口号"],
  ff_log: [
    { id: "1", label: "missed", ts: "2026-10-10T01:00:00Z" },
    { id: "1", label: "fp", ts: "2026-10-10T02:00:00Z" },
    { id: "2", label: "confirm", kind: "abuse" },
  ],
};
let fail = false;
globalThis.chrome = { storage: { local: {
  async get(keys) { if (keys == null) return structuredClone(store); return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((k) => k in store).map((k) => [k, structuredClone(store[k])])); },
  async set(data) { if (fail) { fail = false; throw new Error("disk failure"); } Object.assign(store, structuredClone(data)); },
  async remove(keys) { for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k]; },
} } };
const F = await import("../feedback.js");
assert.deepEqual(await F.getOverrides(["1", "2", "3"]), { 1: "fp", 2: "missed_abuse" });
assert.deepEqual(await F.listSlogans(), [], "旧自动口号不能成为用户确认");
store.ff_log = [];
assert.equal((await F.getOverrides(["1"]))["1"], "fp", "清诊断日志不清纠错");
await F.saveDecision({ id: "3", label: "missed_sexual" });
const restarted = await import("../feedback.js?restart");
assert.equal((await restarted.getOverrides(["3"]))["3"], "missed_sexual");
const entry = { id: "4", postId: "99", handle: "@synthetic", text: "测试用的跨帖垃圾回复话术" };
// 0.26：手动清理掉一条（missed）同时记进"你标记的垃圾"，带原文和网站；不是这个网站的、旧的没记网站的样例怎么给
await F.saveDecision({ ...entry, label: "missed" }, "yt");
let slogans = await F.listSlogans();
assert.equal(slogans.length, 1, "手动清理掉的记进你标记的垃圾");
assert.equal(slogans[0].source.id, "4");
assert.equal(slogans[0].source.postId, "99");
assert.equal(slogans[0].raw, entry.text);
assert.equal(slogans[0].site, "yt");
assert.deepEqual(await F.examplesFor("yt"), [{ handle: "@synthetic", text: entry.text }]);
assert.deepEqual(await F.examplesFor("x"), [], "别的网站上标的不给");
await F.rememberSlogan(entry, "yt");
assert.equal((await F.listSlogans()).length, 1, "同一条再标不重复");
// 太短、一字不差认不了的也留着当样例；按 id 删
await F.rememberSlogan({ id: "7", postId: "98", handle: "@bot", text: "@quickcash 看这个😍" }, "x");
assert.equal((await F.listSlogans()).length, 2);
assert.equal((await F.examplesFor("x"))[0].text, "@quickcash 看这个😍");
await F.removeSlogan(globalThis.FFRules.normSlogan("@quickcash 看这个😍"), "7");
assert.equal((await F.listSlogans()).length, 1, "按 id 删掉短的那条");
// 撤销手动清理：纠错和这一条都删掉
await F.saveDecision({ id: "8", postId: "97", handle: "@h", text: "撤销用的一条垃圾回复测试句子", label: "missed" }, "reddit");
await F.undoMark("8");
assert.equal((await F.getOverrides(["8"]))["8"], undefined, "撤销后没有纠错");
assert.ok(!(await F.listSlogans()).some((x) => x.source.id === "8"), "撤销后不在你标记的垃圾里");
// 旧的（0.26 以前存的，只有 text、没 raw、没 site）：留在列表里（本地照样认），但 0.28.5 起不当样例发给 TypeSafe
// （隐私政策写的是"那个网站上的"）
await chrome.storage.local.set({ ff_confirmed_slogans: [...(await F.listSlogans()), { text: "旧版记住的一句很长的话术", source: { id: "9", postId: "1", handle: "" }, createdAt: 0 }] });
assert.ok((await F.listSlogans()).some((x) => x.text === "旧版记住的一句很长的话术"), "旧的留在列表里");
assert.ok(!(await F.examplesFor("hn")).some((x) => x.text === "旧版记住的一句很长的话术"), "旧的没记网站：不当样例发");
await chrome.storage.local.set({ ff_confirmed_slogans: (await F.listSlogans()).filter((x) => x.source.id !== "9") });
await F.saveDecision({ ...entry, label: "fp" });
assert.equal((await F.listSlogans()).length, 0, "误判同时撤销已确认口号");
fail = true;
await assert.rejects(F.saveDecision({ id: "5", label: "fp" }), /disk failure/);
await F.saveDecision({ id: "5", label: "fp" });
assert.equal((await F.getOverrides(["5"]))["5"], "fp", "一次失败不能污染以后写入");
await Promise.all([F.rememberSlogan(entry), F.rememberSlogan({ ...entry, id: "6", text: "另一个完整的垃圾回复测试句子" })]);
assert.equal((await F.listSlogans()).length, 2, "并发写不覆盖另一条");
await F.removeSlogan(globalThis.FFRules.normSlogan(entry.text));
assert.equal((await F.listSlogans()).length, 1);
await F.clearSlogans();
assert.equal((await F.listSlogans()).length, 0);
await assert.rejects(F.saveDecision({ id: "5", label: "unknown" }));
// 0.28.5：清理条上点"判对了"（confirm）存成 missed，但不算标记（只有手动清理和漏斗算）
await F.saveDecision({ id: "10", postId: "96", handle: "@spam", label: "confirm", kind: "jev", text: "判对了的那条垃圾回复，不该进你标记的垃圾" }, "yt");
assert.equal((await F.getOverrides(["10"]))["10"], "missed", "判对了照样存成 missed");
assert.ok(!(await F.listSlogans()).some((x) => x.source.id === "10"), "判对了不算标记");
// 纠正最多留 3000 条（删最早的）
for (let i = 0; i < 3005; i++) store["ff_reply_override:c" + i] = { label: "fp", updatedAt: 1000 + i };
await F.saveDecision({ id: "11", label: "fp" });
const overrideKeys = () => Object.keys(store).filter((k) => k.startsWith("ff_reply_override:"));
assert.equal(overrideKeys().length, 3000, "纠正最多 3000 条");
assert.ok(!("ff_reply_override:c0" in store) && "ff_reply_override:11" in store, "删的是最早的，刚存的留着");
// 清空统计和记录时纠正一起清掉
await F.clearOverrides();
assert.equal(overrideKeys().length, 0, "纠正清掉了");
assert.deepEqual(await F.getOverrides(["11", "3"]), {}, "清掉以后不再从旧日志迁回来");
console.log("PASS 纠错迁移、独立持久化、你标记的垃圾（手动清理记进去、样例按网站、短的也留、按 id 删、撤销、旧格式不当样例）、误判撤销、失败恢复和并发保存、判对了不算标记、纠正上限 3000、清空纠正");
