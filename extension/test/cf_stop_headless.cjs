// 清流会员停了（0.34.1，用户 10-26 截图：评论区上面写"部分回复尚未完成模型判断：quota_daily 重试未完成的判断"，看不懂、点重试也没用）：
// 判断回 cf_stop 时，评论区最上面那一行说人话（今天额度用完、本月额度用完、会员或试用结束、登录失效），不出"重试未完成的判断"；
// 别的错误照旧"部分回复尚未完成模型判断：…"和重试。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，起 ext-fakex（8767），然后
// node test/cf_stop_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
// 不给网址就自己起一个临时的静态服务（只服务 test/ 目录，测完就关）
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const http = require("http");
const fs = require("fs");
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
  const banner = async (err) => {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 1280, height: 2400 });
    await page.goto(`${BASE}/fakex/status/123/?jevErr=${encodeURIComponent(JSON.stringify(err))}`, { waitUntil: "load" });
    await wait(1500);
    const b = await page.evaluate(() => { const e = document.querySelector(".ff-banner"); return e ? { text: e.textContent.trim(), retry: !!e.querySelector("button, a") } : null; });
    if (process.env.SHOT_DIR && err.reason) { const e = await page.$(".ff-banner"); if (e) await e.screenshot({ path: path.join(process.env.SHOT_DIR, `banner-${err.reason}.png`) }); } // 设了 SHOT_DIR 就截这一行
    await page.close();
    return b;
  };
  try {
    const stop = (reason) => ({ error: reason, code: "cf_stop", reason, retryable: false });
    let b = await banner(stop("quota_daily"));
    ok("今天额度用完：说今天的额度用完了、明天恢复、本地规则照常，不露 quota_daily，没有重试", b && b.text === "今天的额度用完了，AI 判断明天恢复，本地规则照常" && !b.retry, JSON.stringify(b));
    b = await banner(stop("quota_monthly"));
    ok("本月额度用完", b && /本月额度用完了/.test(b.text) && !/quota/.test(b.text) && !b.retry, JSON.stringify(b));
    b = await banner(stop("subscription_required"));
    ok("会员或试用结束", b && /会员或试用已结束/.test(b.text) && !b.retry, JSON.stringify(b));
    b = await banner(stop("signed_out"));
    ok("登录失效", b && /登录已失效/.test(b.text) && !b.retry, JSON.stringify(b));
    b = await banner(stop("something_new"));
    ok("认不得的原因：说暂时停用，不露代码", b && b.text === "AI 判断暂时停用，本地规则照常" && !b.retry, JSON.stringify(b));
    b = await banner({ error: "超时了", code: "network", retryable: false });
    ok("别的错误照旧：部分回复尚未完成模型判断 + 重试", b && /部分回复尚未完成模型判断/.test(b.text) && b.retry, JSON.stringify(b));
  } catch (e) {
    out.push(`FAIL 运行出错 ${e && e.stack || e}`);
  } finally {
    await browser.close();
    if (server) server.close();
    console.log(out.join("\n"));
    process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
  }
})();
