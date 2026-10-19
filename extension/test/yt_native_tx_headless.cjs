// YouTube 自己的"翻译成中文（中国）"按钮（0.28.1，用户 10-18：Shorts 评论自带翻译，先替用户点、用 Google 的译文，不判，省 API）。
// 仿页面 yt/native.html（build_fakex.py）：Ugn01 韩文、按钮能用；Ugn02 西班牙文、按钮点了没反应；Ugn03 日文、没按钮；Ugn04 中文、没按钮。
// ① 有按钮的替你点了、换成 YouTube 的译文，插件不发补翻请求；没按钮的日文插件自己翻；中文不翻。
// ② 清理那边照原文判：发给 Jev 的没有 YouTube 的译文。
// ③ 你点回原文：不再替你点，Jev 也不因为字变了重判。
// ④ 按钮点了没反应的（YouTube 没翻成）：等一会儿改用插件自己翻。
// ⑤ 0.28.7（review）：YouTube 重画了这条评论（按钮换成新元素、回到原文）：插件点过的再替你点一次；你点回原文以后再重画，不再点。
// 用法：node test/yt_native_tx_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]（run_all.mjs 会起服务）
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 900, height: 2000 });
    await page.goto(`${BASE}/fakex/yt/native.html`, { waitUntil: "load" });
    await wait(4000);
    const state = () => page.evaluate(() => {
      const c = (id) => [...document.querySelectorAll("ytd-comment-view-model")].find((x) => (x.querySelector("#published-time-text a")?.getAttribute("href") || "").includes("lc=" + id));
      const one = (id) => { const x = c(id), b = x && x.querySelector(".translate-button"); return { state: b ? b.getAttribute("state") : null, text: x ? x.querySelector("#content-text > span").textContent : null }; };
      return {
        n1: one("Ugn01"), n2: one("Ugn02"),
        fills: (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").map((m) => m.source),
        jev: (window.__ffJevAll || []).length, jevText: JSON.stringify(window.__ffJevAll || []),
      };
    });
    let s = await state();
    ok("① 有 YouTube 翻译按钮的韩文评论：替你点了，正文是 YouTube 的译文", s.n1.state === "toggled" && s.n1.text.startsWith("【YouTube 翻译】"), JSON.stringify(s.n1));
    ok("① 插件不给它发补翻请求；没按钮的日文插件自己翻；中文不翻",
      !s.fills.some((t) => /챌린지/.test(t)) && s.fills.some((t) => /テント/.test(t)) && !s.fills.some((t) => /帐篷/.test(t)), JSON.stringify(s.fills));
    ok("④ 按钮点了没反应的：头几秒插件先不翻（等 YouTube）", !s.fills.some((t) => /Alguien/.test(t)), JSON.stringify(s.fills));
    ok("② 清理照原文判：发给 Jev 的没有 YouTube 的译文、有韩文原文", s.jev > 0 && !s.jevText.includes("YouTube 翻译") && s.jevText.includes("챌린지"), String(s.jev));
    // ⑤ YouTube 重画（按钮换成新元素、正文回到原文）：再替你点一次
    const rerender = () => page.evaluate(() => {
      const x = [...document.querySelectorAll("ytd-comment-view-model")].find((c) => (c.querySelector("#published-time-text a")?.getAttribute("href") || "").includes("lc=Ugn01"));
      const host = x.querySelector(".translate-button"), span = x.querySelector("#content-text > span");
      if (span.__orig) span.textContent = span.__orig;
      const fresh = host.cloneNode(true);
      fresh.setAttribute("state", "untoggled");
      fresh.querySelector("tp-yt-paper-button").textContent = "Translate to Chinese (China)";
      host.replaceWith(fresh);
    });
    await rerender();
    await wait(3000);
    s = await state();
    ok("⑤ YouTube 重画了这条评论（新按钮、回到原文）：插件再替你点一次", s.n1.state === "toggled" && s.n1.text.startsWith("【YouTube 翻译】"), JSON.stringify(s.n1));
    // ③ 你点回原文
    const jevBefore = s.jev;
    await page.evaluate(() => {
      const x = [...document.querySelectorAll("ytd-comment-view-model")].find((c) => (c.querySelector("#published-time-text a")?.getAttribute("href") || "").includes("lc=Ugn01"));
      x.querySelector(".translate-button tp-yt-paper-button").click();
    });
    await wait(3500);
    s = await state();
    ok("③ 你点回原文：不再替你点，Jev 也不重判", s.n1.state === "untoggled" && !s.n1.text.startsWith("【") && s.jev === jevBefore, JSON.stringify({ n1: s.n1, jev: s.jev, jevBefore }));
    await rerender();
    await wait(3000);
    s = await state();
    ok("⑤ 你点回原文以后 YouTube 再重画：不再替你点", s.n1.state === "untoggled" && !s.n1.text.startsWith("【"), JSON.stringify(s.n1));
    // ④ 点了没反应的（6 秒）
    await wait(5000);
    s = await state();
    ok("④ 等了一会儿 YouTube 还没翻成：改用插件自己翻", s.n2.state === "untoggled" && s.fills.some((t) => /Alguien/.test(t)), JSON.stringify(s.fills));
  } catch (e) {
    out.push(`FAIL 出错 ${e.stack || e}`);
  } finally {
    await browser.close();
  }
  console.log(out.join("\n"));
  const fails = out.filter((l) => !l.startsWith("PASS")).length;
  console.log(`\n${out.length - fails}/${out.length} PASS`);
  process.exit(fails ? 1 : 0);
})();
