// 跑全部测试（不联网、不要 key、不要真实数据）：先重打注入包和仿页面，自己起两个本地静态服务（仿页面、HTML 测试页），
// 依次跑 Node 的单元测试、无头 Chrome 的测试、HTML 测试页，最后汇总；有失败退出码 1。
// 要：Node 20+、Python 3、Chrome（环境变量 CHROME_PATH，不给就用 macOS 的 /Applications/Google Chrome.app）、ui/ 下 npm ci 过（puppeteer-core）。
// 用法：node extension/test/run_all.mjs [--unit] [--only 名字,名字]（名字是文件名或去掉后缀的，比如 --only ui_headless,background_test.html）
//       端口被占时用 FF_FAKEX_PORT / FF_STATIC_PORT 换（默认 8767、8776；测试文件里写的默认地址也是这两个）；ui/ 不在插件目录旁边时用 FF_UI_DIR 指。
// 不在这里跑的：rules_parity.cjs（要维护者本机的真实数据）、live_*.cjs 和 jev_live.mjs（打真网站、要真 key、要花钱，手动跑）。
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const EXT = path.resolve(HERE, "..");
const UI = process.env.FF_UI_DIR || path.resolve(EXT, "../ui"); // 插件目录旁边的 ui/（装着 puppeteer-core）；不在旁边时用 FF_UI_DIR 指
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FAKEX_PORT = Number(process.env.FF_FAKEX_PORT || 8767), STATIC_PORT = Number(process.env.FF_STATIC_PORT || 8776);
const only = process.argv.includes("--only") ? new Set(process.argv[process.argv.indexOf("--only") + 1].split(",")) : null;

const UNIT = ["rules_near_test.cjs", "zhconv_test.cjs", "ytrules_test.cjs", "i18n_test.cjs", "settings_test.cjs", "feedback_test.mjs", "translator_test.mjs", "backend_regression.mjs"];
const HEADLESS = ["x_local", "x_ad", "x_tx_hold", "op_topic", "x_thread_misc", "images", "xhs", "yt", "yt_shorts", "yt_captions", "yt_native_tx", "yt_long_tx", "tx_misc", "flex", "hn", "reddit", "reddit_tx", "latin_tx", "mark", "budget", "translate", "search", "quote", "probe", "profile", "netdata", "rec",
  "ui", "i18n", "filler", "group", "welcome"].map((n) => `${n}_headless.cjs`);
const HTML = ["background_test.html", "background_translate_test.html", "settings_test.html", "cache_test.html", "cache_context_test.html", "content_reliability_test.html"];
const unitOnly = process.argv.includes("--unit"); // 只跑 Node 的单元测试：不要 Chrome、不起服务（CI 上那一步）
const want = (name) => (!unitOnly || UNIT.includes(name)) && (!only || only.has(name.replace(/\.(cjs|mjs|html)$/, "")) || only.has(name));

// ---------- 静态服务：目录访问给 index.html，带上 MIME（ES 模块要 text/javascript） ----------
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8" };
function serve(root, port) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/api/timedtext") { // 仿 YouTube 的字幕接口（yt_captions_headless）：按 lang、tlang 给 fakex/yt/timedtext/ 下的文件
      const q = new URL(req.url, "http://x").searchParams;
      p = `/fakex/yt/timedtext/${q.get("set") ? q.get("set").replace(/[^\w-]/g, "") + "/" : ""}${(q.get("lang") || "").replace(/[^\w-]/g, "")}${q.get("tlang") ? "." + q.get("tlang").replace(/[^\w-]/g, "") : ""}.json`;
    }
    let file = path.join(root, p);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", (e) => reject(e.code === "EADDRINUSE" ? new Error(`端口 ${port} 被占了：关掉占着的服务，或者用 FF_FAKEX_PORT / FF_STATIC_PORT 换一个`) : e));
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

const run = (cmd, args) => new Promise((resolve) => {
  const p = spawn(cmd, args, { cwd: EXT, env: process.env });
  let out = "";
  p.stdout.on("data", (d) => { out += d; });
  p.stderr.on("data", (d) => { out += d; });
  p.on("close", (code) => resolve({ code, out }));
});
const results = [];
function report(name, code, out) {
  const lines = out.split("\n");
  const pass = lines.filter((l) => /^(PASS|ok \d)/.test(l)).length, fail = lines.filter((l) => /^(FAIL|PAGEERROR|not ok)/.test(l));
  const ok = code === 0 && !fail.length;
  results.push({ name, ok });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}  (PASS ${pass}${fail.length ? `, FAIL ${fail.length}` : ""}${code ? `, exit ${code}` : ""})`);
  if (!ok) console.log((fail.length ? fail : lines.slice(-8)).slice(0, 6).map((l) => "     " + l.slice(0, 220)).join("\n"));
}

const browserTests = HEADLESS.some(want) || HTML.some(want);
if (browserTests) {
  if (!fs.existsSync(CHROME)) { console.error(`找不到 Chrome：${CHROME}（用 CHROME_PATH 指一下）`); process.exit(2); }
  if (!fs.existsSync(path.join(UI, "node_modules/puppeteer-core"))) { console.error("ui/ 下还没装依赖：cd ui && npm ci"); process.exit(2); }
  execFileSync("python3", ["test/build_inject_bundle.py"], { cwd: EXT, stdio: "ignore" });
  execFileSync("python3", ["test/build_fakex.py"], { cwd: EXT, stdio: "ignore" });
}
const servers = browserTests ? [await serve(path.join(EXT, "test"), FAKEX_PORT), await serve(EXT, STATIC_PORT)] : [];
const FAKEX = `http://localhost:${FAKEX_PORT}`, STATIC = `http://localhost:${STATIC_PORT}`;
try {
  for (const t of UNIT.filter(want)) { const r = await run("node", [path.join("test", t)]); report(t, r.code, r.out); }
  for (const t of HEADLESS.filter(want)) { const r = await run("node", [path.join("test", t), UI, FAKEX]); report(t, r.code, r.out); }
  const pages = HTML.filter(want);
  if (pages.length) {
    const puppeteer = createRequire(import.meta.url)(path.join(UI, "node_modules/puppeteer-core"));
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-first-run"] });
    for (const p of pages) {
      const page = await browser.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(`PAGEERROR ${e.message}`));
      await page.goto(`${STATIC}/test/${p}`, { waitUntil: "load" });
      // 页面自己跑完把结果写进 #out：等它不再变（最多 60 秒）
      let txt = "", same = 0;
      for (let i = 0; i < 120 && same < 6; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const t2 = await page.evaluate(() => (document.getElementById("out") || document.body).innerText);
        same = t2 === txt && !/running/.test(t2) && /PASS|FAIL/.test(t2) ? same + 1 : 0;
        txt = t2;
      }
      report(p, 0, [txt, ...errs].join("\n"));
      await page.close();
    }
    await browser.close();
  }
} finally {
  for (const s of servers) s.close();
}
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} 个测试文件通过${bad.length ? `；没过：${bad.map((r) => r.name).join("、")}` : ""}`);
process.exit(bad.length ? 1 : 0);
