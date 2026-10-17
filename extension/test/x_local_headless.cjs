// X 帖子页上的两条本地规则（0.19.1，rules.js）和 @ 外人降门槛（0.21.1）：近乎一样的模板（只换推的号 / 每条换个链接、改一个字）按"几个账号刷同一句话"收起，
// 字里塞了零宽字符的按"字里藏了看不见的字符"收起，正常的不动；一组里任意一条点"判错了"，整组都放出来（组的键是代表句，不一定是点的那条）。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，起 ext-fakex（8767），然后
// node test/x_local_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 0.22.1 起连着 3 条以上被折的合成一条：这里测的是一条条的折叠条，先把合起来的都点开（和用户点开一样）
const openGroups = async (pg) => { await pg.evaluate(() => document.querySelectorAll('.ff-group[aria-expanded="false"]').forEach((b) => b.click())); await new Promise((r) => setTimeout(r, 300)); };
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 1000, height: 2400 });
    await page.goto(`${BASE}/fakex/status/7002/`, { waitUntil: "load" });
    await wait(3000);
    await openGroups(page);
    const st = () => page.evaluate(() => {
      const r = {};
      for (const a of document.querySelectorAll("article")) {
        const id = (a.querySelector('a[href*="/status/"]')?.getAttribute("href").match(/status\/(\d+)/) || [])[1];
        const bar = a.previousElementSibling?.classList.contains("ff-bar") ? a.previousElementSibling : null;
        r[id] = { reason: bar ? bar.querySelector(".ff-reason").textContent : null, hidden: getComputedStyle(a).display === "none" };
      }
      return r;
    });
    let s = await st();
    const dup3 = (id) => s[id].hidden && /3 个账号发了同一句话/.test(s[id].reason || "");
    ok("长句模板只换推的号：3 个号都收起，理由是几个账号发了同一句话", ["7201", "7202", "7203"].every(dup3), JSON.stringify([s["7201"], s["7202"], s["7203"]]));
    ok("短句每条换个链接、改了一个字：3 个号都收起", ["7205", "7206", "7207"].every(dup3), JSON.stringify([s["7205"], s["7206"], s["7207"]]));
    ok("字里塞了零宽字符：收起，理由写明", s["7208"].hidden && /看不见的字符/.test(s["7208"].reason || ""), JSON.stringify(s["7208"]));
    ok("正常的两条不动", !s["7204"].reason && !s["7209"].reason && !s["7204"].hidden && !s["7209"].hidden, JSON.stringify([s["7204"], s["7209"]]));
    // 第二条不是组里的代表句（代表是第一条）：点它的"判错了"，整组都放出来
    await page.evaluate(() => [...document.querySelectorAll(".ff-bar")].find((b) => b.dataset.ffId === "7202").click());
    await wait(250);
    await page.evaluate(() => [...document.querySelectorAll(".ff-bar")].find((b) => b.dataset.ffId === "7202").querySelector('button[aria-label^="判错了"]').click());
    await wait(900);
    s = await st();
    ok("模板组里点一条判错了：整组三条都放出来", ["7201", "7202", "7203"].every((id) => !s[id].reason && !s[id].hidden), JSON.stringify([s["7201"], s["7202"], s["7203"]]));
    ok("别的组不受影响", ["7205", "7206", "7207", "7208"].every((id) => s[id].hidden), JSON.stringify([s["7205"], s["7208"]]));
    // 0.21.1：@ 了帖子外的号、不超过 20 个字的，引流 / 推广两问的门槛降 0.1（rules.js 的 mentionNudge）。替身给这几条引流 0.55
    await page.goto(`${BASE}/fakex/status/7003/?jev=${encodeURIComponent(JSON.stringify({ "比我高的跑不过我": 0.55, "今天的晚霞": 0.55, "楼主这组照片": 0.55, "越看越有味道": 0.55 }))}`, { waitUntil: "load" });
    await wait(3000);
    await openGroups(page);
    s = await st();
    ok("@ 了帖子外的号、16 个字、引流 0.55：收起（门槛 0.6 降到 0.5），理由是 Jev 那一问（不是 M1）", s["7301"].hidden && /拉人/.test(s["7301"].reason || ""), JSON.stringify(s["7301"]));
    ok("不带 @ 的：0.55 不到 0.6，不收起", !s["7302"].hidden && !s["7302"].reason, JSON.stringify(s["7302"]));
    ok("@ 的是楼主：不算外人，不收起", !s["7303"].hidden && !s["7303"].reason, JSON.stringify(s["7303"]));
    ok("超过 20 个字的：不降门槛，不收起", !s["7304"].hidden && !s["7304"].reason, JSON.stringify(s["7304"]));
    await page.evaluate(() => chrome.storage.local.set({ ff_settings: { ...(chrome.storage.local._d.ff_settings || {}), m1: false } }));
    await wait(1500);
    s = await st();
    ok("关掉\"只 @ 了陌生账号的短回复\"：这条也不降门槛", !s["7301"].hidden, JSON.stringify(s["7301"]));
  } catch (e) {
    out.push(`FAIL 运行出错 ${e.stack}`);
  } finally {
    await browser.close();
  }
  console.log(out.join("\n"));
  const fails = out.filter((l) => !l.startsWith("PASS")).length;
  console.log(fails ? `${fails} 项没过` : `全过（${out.length} 项）`);
  process.exit(fails ? 1 : 0);
})();
