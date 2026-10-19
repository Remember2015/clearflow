// 翻译引擎的几处零碎（0.28.10，review 第六批）。仿页面 hn/item_misc.html（build_fakex.py），中文界面，替身补翻"【替身补翻】"加原文：
// ① 只贴了一段代码的评论（9201）：不翻、不付费。
// ② 字里本来就有像标记的"<t1>""<x3/>"（9202）：送出去时转义（&lt;t1>），一次就过（不换后备模型重翻），译文里照原样显示 <t1>。
// ③ 评论的字改了（9203）：按新的字重翻。
// ④ OpenRouter 余额不足停下来以后，你在设置里关掉翻译：换上的译文都撤下（0.28.10 以前停下来就当成"本来关着"，关掉时什么都不撤）。
// 用法：node test/tx_misc_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]（run_all.mjs 会起服务）
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
    await page.setViewport({ width: 900, height: 1600 });
    await page.goto(`${BASE}/fakex/hn/item_misc.html`, { waitUntil: "load" });
    await wait(3500);
    const msgs = () => page.evaluate(() => (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").map((m) => ({ id: m.id, source: m.source, alt: !!m.alt })));
    const clone = (cid) => page.evaluate((cid) => { const row = document.getElementById(cid); const c = row && row.querySelector(".ff-rtx-whole"); return c ? c.textContent : null; }, cid);
    let m = await msgs();
    ok("① 只贴了代码的评论：不翻", !m.some((x) => x.id === "hn_9201"), JSON.stringify(m.map((x) => x.id)));
    const m2 = m.filter((x) => x.id === "hn_9202");
    ok("② 像标记的字：送出去时转义、一次就过（不换后备模型重翻）", m2.length === 1 && m2[0].source.includes("&lt;t1>") && m2[0].source.includes("&lt;x3/>") && !m2[0].alt, JSON.stringify(m2));
    const c2 = await clone("9202");
    ok("② 译文里照原样显示 <t1>、<x3/>", !!c2 && c2.includes("【替身补翻】") && c2.includes("<t1>") && c2.includes("<x3/>") && !c2.includes("&lt;"), String(c2));
    // ③ 改字
    await page.evaluate(() => { document.querySelector('[id="9203"] .commtext').textContent = "The edited version of this comment talks about synthetic lighthouses instead."; });
    await wait(3000);
    m = await msgs();
    const m3 = m.filter((x) => x.id === "hn_9203");
    const c3 = await clone("9203");
    ok("③ 评论的字改了：按新的字重翻、换上新的译文", m3.length === 2 && /lighthouses/.test(m3[1].source) && !!c3 && /lighthouses/.test(c3), JSON.stringify({ m3, c3 }));
    // ④ 余额不足停下来，再关掉翻译
    await page.evaluate(() => {
      window.__ffTxFn = () => ({ error: "no credit", code: "or_credit", retryable: false });
      const tb = document.querySelector(".comment-tree > tbody");
      const tr = document.querySelector('[id="9203"]').cloneNode(true);
      tr.id = "9204"; tr.querySelector(".commtext").textContent = "A brand new comment that arrives after the credit ran out.";
      tr.querySelector(".ff-rtx-whole")?.remove(); tr.querySelector(".ff-rtx-bnote")?.remove();
      const ct = tr.querySelector(".commtext"); ct.style.display = ""; delete ct.dataset.ffTxHidden;
      tr.querySelector('.age a').setAttribute("href", "item?id=9204");
      tb.appendChild(tr);
    });
    await wait(3000);
    const before = await page.evaluate(() => document.querySelectorAll(".ff-rtx-whole").length);
    await page.evaluate(() => chrome.storage.local.set({ ff_settings: { ...(chrome.storage.local._d.ff_settings || {}), translate: false } }));
    await wait(1500);
    const after = await page.evaluate(() => ({ clones: document.querySelectorAll(".ff-rtx-whole").length, hidden: document.querySelectorAll("[data-ff-tx-hidden]").length }));
    const sent4 = (await msgs()).some((x) => x.id === "hn_9204");
    ok("④ 余额不足停下来以后关掉翻译：换上的译文都撤下、原文都露出来", sent4 && before > 0 && after.clones === 0 && after.hidden === 0, JSON.stringify({ sent4, before, after }));
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
