// 一页先判多少条（0.27，用户 10-17：抽奖帖首屏就一直加载、清理了 340 条，太费 API）：X 帖子 7007 上 70 条很短的"DONE"式回复，
// 替身给「赞」「mark」这类的分（判了就整条藏起来）。打开时只判前 40 条（发给 Jev 的只有这 40 条），后面的照常显示、不判；
// 往下滚 0.8 屏多判 20 条；没滚就不再多判。
// 用法：node test/budget_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]（run_all.mjs 会起服务）
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
    await page.setViewport({ width: 900, height: 800 });
    await page.goto(`${BASE}/fakex/status/7007/?jev=${encodeURIComponent(JSON.stringify({ DONE: { filler: 0.95 } }))}`, { waitUntil: "load" });
    await wait(3000);
    const b0 = await page.evaluate(() => { const b = document.querySelector(".ff-fill-bottom"), top = document.querySelector(".ff-fill-line:not(.ff-fill-bottom)");
      return { has: !!b, same: !!b && !!top && b.querySelector(".ff-fill-text").textContent === top.querySelector(".ff-fill-text").textContent,
        // 在最后一条看得见的回复那一格里、回复那块的外面（0.27.2：放进回复那块里像是那条回复的一部分）
        afterVisible: !!b && b.parentElement?.matches('[data-testid="cellInnerDiv"]') && !b.previousElementSibling?.matches("article") && !!b.previousElementSibling?.querySelector("article"),
        last: b?.previousElementSibling?.querySelector('article a[href*="/status/"]')?.getAttribute("href") || null };
    });
    ok("评论区长（看得见的 30 条）：最后一条看得见的回复下面也放一行，和上面那一行一样（0.27）", b0.has && b0.same && b0.afterVisible && /\/status\/8069$/.test(b0.last || ""), JSON.stringify(b0));
    const st = () => page.evaluate(() => {
      const asked = new Set((window.__ffJevAll || []).flatMap((m) => m.replies.map((r) => r.id)));
      const arts = [...document.querySelectorAll('article[data-testid="tweet"]')].filter((a) => !a.querySelector('a[href*="/status/7007"]'));
      return { asked: asked.size, requests: (window.__ffJevAll || []).length, shown: arts.filter((a) => getComputedStyle(a).display !== "none").length,
        line: document.querySelector(".ff-fill-line .ff-fill-text")?.textContent || null };
    });
    let s = await st();
    ok("打开时只判前 40 条（4 个请求），后面 30 条照常显示、不判", s.asked === 40 && s.requests === 4 && s.shown === 30 && s.line === "清理了 40 条「赞」「mark」这类回复", JSON.stringify(s));
    await wait(1500);
    s = await st();
    ok("没往下滚就不再多判（藏起来、页面变短也不算往下滚）", s.asked === 40, JSON.stringify(s));
    await page.evaluate(() => window.scrollBy(0, innerHeight * 0.8));
    await wait(1500);
    s = await st();
    ok("往下滚 0.8 屏：多判 20 条", s.asked === 60 && s.shown === 10, JSON.stringify(s));
    // 评论区长（看得见的 ≥ 15）时最后一条看得见的回复下面也有一行（0.27）：现在看得见的只剩 10 条，不放；回到刚打开时那样（30 条看得见）要放
    const bottom = () => page.evaluate(() => { const b = document.querySelector(".ff-fill-bottom"); const top = document.querySelector(".ff-fill-line:not(.ff-fill-bottom)");
      return { has: !!b, same: !!b && !!top && b.querySelector(".ff-fill-text").textContent === top.querySelector(".ff-fill-text").textContent,
        afterLast: !!b && b.previousElementSibling?.matches('article[data-testid="tweet"]') && getComputedStyle(b.previousElementSibling).display !== "none" };
    });
    ok("看得见的只剩 10 条：下面不放那一行", !(await bottom()).has, JSON.stringify(await bottom()));
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
