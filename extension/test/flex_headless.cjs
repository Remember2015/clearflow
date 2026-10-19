// 翻译走哪条通道（0.28.4，用户 10-19："可见区域的用标准的，不可见预翻译的可以用 flex"）：发请求时这一批有一条在屏幕上 → 标准（flex: false），
// 都不在（上下一屏内的预翻译）→ flex（半价，见 translator.js）。仿页面 reddit/post_en.html（英文帖子、英日西文评论），中文界面，窗口只有 420 高：
// 帖子在屏幕上，后面几条评论在屏幕下方（还在一屏之内，会预翻译）。位置在发请求那一刻记（翻好以后原文那一格会藏起来）。
// 用法：node test/flex_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]（run_all.mjs 会起服务）
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
    // 每发一个请求，记下那一刻这条评论（帖子）在哪儿
    await page.evaluateOnNewDocument(() => {
      window.__ffAt = {};
      // 藏起来了（被清理、折叠，量出来没有大小）当不在屏幕上：null（0.28.14，CI 上 Linux 慢一点，有一条先被清理了再发翻译请求，量出来 top 0）
      const where = (id) => { const c = document.querySelector(`shreddit-comment[thingid="${id}"] [slot="comment"], shreddit-post[id="${id}"]`); if (!c) return null; const r = c.getBoundingClientRect(); return r.width || r.height ? r.top : null; };
      const arr = (window.__ffTxMsgs = []);
      const push = arr.push.bind(arr);
      arr.push = (...ms) => { for (const m of ms) if (m && m.id && !(m.id in window.__ffAt)) window.__ffAt[m.id] = where(m.id); return push(...ms); };
    });
    await page.setViewport({ width: 900, height: 420 });
    await page.goto(`${BASE}/fakex/reddit/post_en.html`, { waitUntil: "load" });
    await wait(4000);
    const s = await page.evaluate(() => ({ vh: innerHeight, msgs: (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").map((m) => ({ id: m.id, flex: m.flex, top: window.__ffAt[m.id] })) }));
    const flexed = s.msgs.filter((m) => m.flex === true), std = s.msgs.filter((m) => m.flex === false);
    ok("屏幕下方预翻译的评论走 flex", flexed.length > 0, JSON.stringify(s.msgs));
    ok("走 flex 的那几条都不在屏幕上", flexed.every((m) => m.top === null || m.top >= s.vh), JSON.stringify(flexed));
    ok("屏幕上的评论走标准通道", std.some((m) => m.top !== null && m.top >= 0 && m.top < s.vh), JSON.stringify(std));
    ok("每个请求都说了走哪条（flex 是 true 或 false）", s.msgs.length > 0 && s.msgs.every((m) => typeof m.flex === "boolean"), JSON.stringify(s.msgs));
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
