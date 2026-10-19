// X 上认广告（0.28.6，review）：仿页面 status/7008：回复正文里单独一行"广告"（7801）、昵称就叫"Ad"（7802）的不是广告，照样发 Jev 判；
// 真广告（作者那一栏旁边一个"广告"，7804）不判。以前拿整条帖子的 innerText 认，前两条都被当广告跳过（不判、也不能手动清理）。
// 用法：node test/x_ad_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]（run_all.mjs 会起服务）
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
    await page.setViewport({ width: 800, height: 1400 });
    await page.goto(`${BASE}/fakex/status/7008/`, { waitUntil: "load" });
    await wait(3000);
    const sent = await page.evaluate(() => [...new Set((window.__ffJevAll || []).flatMap((m) => (m.replies || []).map((x) => x.id)))].sort());
    ok("正文里单独一行\"广告\"的回复照样判", sent.includes("7801"), JSON.stringify(sent));
    ok("昵称就叫\"Ad\"的回复照样判", sent.includes("7802"), JSON.stringify(sent));
    ok("正常回复照样判", sent.includes("7803"), JSON.stringify(sent));
    ok("真广告（作者那一栏旁边一个\"广告\"）不判", !sent.includes("7804"), JSON.stringify(sent));
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
