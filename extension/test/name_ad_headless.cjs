// 昵称在打广告（0.35，用户 10-26 截图「40%OKX合约返佣 @BossLady_Promo」：回复正文正常，广告在昵称里）。仿 X 帖子 7010：
// ① 昵称是广告、正文正常 → 清理，理由"昵称在打广告"；② 昵称是广告、正文很短（"确实离谱"）→ 照样清理（广告不在正文里，不受短回复豁免）；
// ③ 长的正常昵称（"尼克胡｜投资与生活"）→ 问了、没过门槛、不清理；④ 短昵称（"小王"）→ 不多问这一句。
// ⑤ 门槛 = 垃圾回复的门槛 + 0.1（标准档 0.6 → 0.7）：0.75 的清理、0.69 的不清理。
// ⑥ 回来的分里没有这一问（会员模式下服务端还是旧版、不认）：同一条只问一次，不会每次扫描都重问。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，然后
// node test/name_ad_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]；不给网址就自己起一个临时的静态服务（只服务 test/，测完就关）
const path = require("path");
const http = require("http");
const fs = require("fs");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
let BASE = process.argv[3] || null, server = null;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  if (!BASE) {
    server = http.createServer((req, res) => {
      let f = path.join(__dirname, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!f.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    BASE = `http://127.0.0.1:${server.address().port}`;
  }
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  const look = async (jev, query = "") => {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 1280, height: 2400 });
    await page.goto(`${BASE}/fakex/status/7010/?jev=${encodeURIComponent(JSON.stringify(jev))}${query}`, { waitUntil: "load" });
    await wait(1500);
    const r = await page.evaluate(() => {
      const bars = Object.fromEntries([...document.querySelectorAll(".ff-bar")].map((b) => [b.dataset.ffId, b.querySelector(".ff-reason")?.textContent || ""]));
      const asked = {};
      for (const m of window.__ffJevAll || []) for (const x of m.replies || []) asked[x.id] = x.ask || [];
      return { bars, asked };
    });
    await page.close();
    return r;
  };
  try {
    const J = { "魔幻操作": { name_ad: 0.92 }, "确实离谱": { name_ad: 0.86 } };
    let r = await look(J);
    ok("① 昵称是广告、正文正常：清理，理由写昵称在打广告", /昵称在打广告/.test(r.bars["8101"] || ""), JSON.stringify(r));
    ok("② 昵称是广告、正文很短：照样清理（不受短回复豁免）", /昵称在打广告/.test(r.bars["8102"] || ""), JSON.stringify(r));
    ok("③ 长的正常昵称：问了这一句（替身给 0.1）、不清理", (r.asked["8103"] || []).includes("name_ad") && !r.bars["8103"], JSON.stringify(r));
    ok("④ 短昵称：不多问这一句、不清理", !(r.asked["8104"] || []).includes("name_ad") && !r.bars["8104"], JSON.stringify(r));
    r = await look({ "魔幻操作": { name_ad: 0.75 }, "确实离谱": { name_ad: 0.69 } });
    ok("⑤ 标准档门槛 0.7：0.75 的清理、0.69 的不清理", /昵称在打广告/.test(r.bars["8101"] || "") && !r.bars["8102"], JSON.stringify(r));
    // ⑥ 回来的分里没有这一问（会员模式下服务端还是旧版）：每条只问一次，不会每次扫描都重问；也不清理
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 2400 });
    await page.goto(`${BASE}/fakex/status/7010/?jev=${encodeURIComponent(JSON.stringify(J))}&jevDrop=name_ad`, { waitUntil: "load" });
    await wait(1500);
    await page.evaluate(() => window.scrollBy(0, 300)); await wait(800); await page.evaluate(() => window.scrollBy(0, -300)); await wait(1200);
    const sent = await page.evaluate(() => (window.__ffJevAll || []).reduce((n, m) => n + (m.replies || []).filter((x) => x.id === "8101").length, 0));
    const bar = await page.evaluate(() => !!document.querySelector('.ff-bar[data-ff-id="8101"]'));
    await page.close();
    ok("⑥ 分里没有这一问（旧版服务端）：同一条只问一次、不清理", sent === 1 && !bar, JSON.stringify({ sent, bar }));
  } catch (e) {
    out.push(`FAIL 运行出错 ${e && e.stack || e}`);
  } finally {
    await browser.close();
    if (server) server.close();
    console.log(out.join("\n"));
    process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
  }
})();
