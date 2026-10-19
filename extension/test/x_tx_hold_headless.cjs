// X 上翻译等评论区判完（0.28.7，review B13）：评论区（content.js）还在问 Jev 的回复，翻译那边（translate.js）先不补翻 / 不改进，
// 判出来要清理的就不付这笔翻译费；Jev 一直不回，最多等 6 秒照常翻。
// 仿帖子页 thread.html（主帖被 X 翻译了，楼主的英文回复 3002、3003、3012 会补翻），替身 Jev 晚 window.__ffJevDelay 毫秒回。
// ① Jev 晚 2.5 秒回、判 3002 是辱骂（短回复的垃圾分有短文本豁免，辱骂没有）：3002 不补翻，别的照常补翻，而且是 Jev 回来以后才发。
// ② Jev 晚 20 秒回：等满 6 秒照常补翻。
// 用法：node test/x_tx_hold_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]（run_all.mjs 会起服务）
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  const open = async (q, jevDelay) => {
    const pg = await browser.newPage();
    pg.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await pg.setViewport({ width: 800, height: 2000 });
    await pg.evaluateOnNewDocument((d) => {
      window.__ffJevDelay = d;
      window.__t0 = performance.now();
      // 每发一个补翻请求记下时间（离页面打开多少毫秒）
      const arr = (window.__ffTxMsgs = []);
      const push = arr.push.bind(arr);
      arr.push = (...ms) => { for (const m of ms) if (m && m.type === "translateFill") m.at = Math.round(performance.now() - window.__t0); return push(...ms); };
    }, jevDelay);
    await pg.goto(`${BASE}/fakex/thread.html${q}`, { waitUntil: "load" });
    return pg;
  };
  const fills = (pg) => pg.evaluate(() => window.__ffTxMsgs.filter((m) => m.type === "translateFill").map((m) => ({ id: m.id, at: m.at })));
  try {
    // ①
    let pg = await open(`?jev=${encodeURIComponent(JSON.stringify({ "old plan": { abuse: 0.95 } }))}`, 2500);
    await wait(1800);
    let f = await fills(pg);
    ok("① Jev 还没回：楼主的回复先不补翻", f.length === 0, JSON.stringify(f));
    await wait(4000);
    f = await fills(pg);
    const folded = await pg.evaluate(() => document.querySelector('article[data-fid="3002"]').style.display === "none");
    ok("① Jev 判 3002 是辱骂、清理了：不给它补翻", folded && !f.some((m) => m.id === "3002"), JSON.stringify({ folded, f }));
    ok("① 别的照常补翻，而且是 Jev 回来以后才发", ["3003", "3012"].every((id) => f.some((m) => m.id === id)) && f.every((m) => m.at >= 2500), JSON.stringify(f));
    await pg.close();
    // ②
    pg = await open("", 20000);
    await wait(3500);
    f = await fills(pg);
    ok("② Jev 一直不回：头几秒先等", f.length === 0, JSON.stringify(f));
    await wait(5000);
    f = await fills(pg);
    ok("② 等满 6 秒照常补翻（3012 要先替你点开显示更多，晚一点）", ["3002", "3003"].every((id) => f.some((m) => m.id === id)) && f.every((m) => m.at >= 5500), JSON.stringify(f));
    await pg.close();
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
