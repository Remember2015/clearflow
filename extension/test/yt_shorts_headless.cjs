// YouTube Shorts 的评论面板（0.28.14，用户 10-19 截图）：仿页面 yt/shorts.html（build_fakex.py）——标题、输入框不动，中间的列表自己滚，评论往里缩 16px。
// 18 条评论里 3 条很短的表态（?jev 给 filler 0.9）藏起来：
// ① "清理了 3 条「赞」「mark」这类回复"只有最上面一行（列表自己在滚，这一行一直看得见；以前列表下面还有一行，两行一起露着）。
// ② 那一行和评论的头像左边对齐（以前贴着面板边）。
// 用法：node test/yt_shorts_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]（run_all.mjs 会起服务）
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const enc = (o) => encodeURIComponent(JSON.stringify(o));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 900, height: 900 });
    await page.goto(`${BASE}/fakex/yt/shorts.html?jev=${enc({ "so cute": { filler: 0.9 }, "love it": { filler: 0.9 }, "wow nice": { filler: 0.9 } })}`, { waitUntil: "load" });
    await wait(4500);
    const s = await page.evaluate(() => {
      const lines = [...document.querySelectorAll(".ff-fill-line")];
      const av = [...document.querySelectorAll("#author-thumbnail")].find((a) => a.getBoundingClientRect().width);
      const panel = document.querySelector(".panel").getBoundingClientRect();
      return { n: lines.length, bottom: !!document.querySelector(".ff-fill-bottom"), text: lines[0]?.querySelector(".ff-fill-text")?.textContent || null,
        left: lines[0] ? Math.round(lines[0].getBoundingClientRect().left) : null, avLeft: av ? Math.round(av.getBoundingClientRect().left) : null, panelLeft: Math.round(panel.left),
        visible: document.querySelectorAll("ytd-comment-thread-renderer:not([style*='display: none'])").length };
    });
    ok("① 只有最上面一行，列表下面不再放一行", s.n === 1 && !s.bottom && /3/.test(s.text || "") && s.visible >= 15, JSON.stringify(s));
    ok("② 那一行和评论的头像左边对齐（不贴面板边）", s.left != null && Math.abs(s.left - s.avLeft) <= 1 && s.left - s.panelLeft >= 10, JSON.stringify(s));
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
