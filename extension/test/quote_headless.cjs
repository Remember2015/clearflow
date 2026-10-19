// 引用卡片（不调任何接口）：仿 X 帖子页 test/fakex/status/135/。只引用了自己另一条帖子的回复（没写字 / 只写了"看我这条👇"）
// 折叠成"只贴了自己的另一条帖子"、不发 Jev；引用别人的、引用自己但认真写了一段的、楼主引用自己的、正常回复不按这条折。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/quote_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
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
    await page.goto(`${BASE}/fakex/status/135/`, { waitUntil: "load" });
    await wait(2500);
    await page.evaluate(() => document.querySelectorAll('.ff-group[aria-expanded="false"]').forEach((b) => b.click())); // 连着两条（0.27 起两条就合）：点开看每条
    await wait(300);
    const r = await page.evaluate(async () => {
      const bars = {};
      for (const a of document.querySelectorAll('article[data-testid="tweet"]')) {
        const id = a.querySelector('a[href*="/status/"]').getAttribute("href").match(/status\/(\d+)/)[1];
        const b = document.querySelector(`.ff-bar[data-ff-id="${id}"]`);
        bars[id] = b ? b.querySelector(".ff-reason").textContent : null;
      }
      const sent = (window.__ffLastJev?.replies || []).map((x) => [x.id, x.text]);
      const s = await new Promise((res) => { let done = false; for (const f of window.__ffOnMessage || []) f({ type: "pageSummary" }, {}, (s) => { if (!done) { done = true; res(s || {}); } }); setTimeout(() => { if (!done) res({}); }, 300); }); // 0.28.5：清理掉的从弹窗那条查询里拿（不再发"最近清理"）
      return { bars, sent, folded: (s.folded || []).map(([id, kind]) => [id, s.kind, s.key, kind]) };
    });
    const SELF = "只贴了自己的另一条帖子";
    ok("没写字、只引用自己另一条帖子的回复折叠", r.bars["941"] === SELF, JSON.stringify(r.bars));
    ok("只写了\"看我这条👇\"、引用自己的也折", r.bars["942"] === SELF, JSON.stringify(r.bars));
    ok("引用别人帖子的、引用自己但认真写了一段的、正常回复都不按这条折", !r.bars["943"] && !r.bars["944"] && !r.bars["945"], JSON.stringify(r.bars));
    ok("楼主引用自己的帖子不按这条折（0.21.2 起楼主的回复照样判，只是\"只贴自己的另一条帖子\"不管楼主）", !r.bars["946"], JSON.stringify(r.bars));
    const ids = r.sent.map((x) => x[0]);
    ok("折掉的两条不发 Jev，别的照常发", !ids.includes("941") && !ids.includes("942") && ["943", "944", "945"].every((i) => ids.includes(i)), JSON.stringify(ids));
    ok("清理掉的两条（帖子页、这一页记成 135）", JSON.stringify(r.folded.filter((x) => ["941", "942"].includes(x[0])).sort()) ===
      JSON.stringify([["941", "status", "135", "selfquote"], ["942", "status", "135", "selfquote"]]), JSON.stringify(r.folded));
    ok("回复自己写了的话照常按自己的话判（不混进引用的那条）", r.sent.find((x) => x[0] === "944")?.[1].startsWith("我之前专门算过一笔账"), JSON.stringify(r.sent));
    // 帖子页的回复：三问都照常用（"在 @ 别人做推广"就是冲着回复问的）
    await page.goto(`${BASE}/fakex/status/135/?jev=${encodeURIComponent(JSON.stringify({ "医保很重要": { promo_mention: 0.86 } }))}`, { waitUntil: "load" });
    await wait(2500);
    await page.evaluate(() => document.querySelectorAll('.ff-group[aria-expanded="false"]').forEach((b) => b.click()));
    await wait(300);
    const r2 = await page.evaluate(() => document.querySelector('.ff-bar[data-ff-id="945"] .ff-reason')?.textContent || null);
    ok("帖子页的回复：\"在 @ 别人做推广\"给高分照样折", /在 @ 别人做推广/.test(r2 || ""), String(r2));
  } catch (e) {
    out.push(`FAIL 运行出错 ${e.stack}`);
  }
  await browser.close();
  console.log(out.join("\n"));
  process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
})();
