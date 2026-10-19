// X 帖子页的几处零碎（0.28.9，review 第五批）。仿页面 thread.html?extra（build_fakex.py）：
// ① 楼主只嵌了一张引用卡片（3013）：不拿卡片里被引用那条的正文去补翻，也不去点卡片里的"显示更多"（那是链接，会跳走）。
// ② X 过 1.2 秒才挂出"显示翻译"（3014）：插件先等一等，替你点 X 的翻译，不自己付费翻。
// ③ 昵称写成"@thread_op"冒充楼主的（3015）：账号按链接认，不当成楼主——只 @ 了一个外人，M1 照样清理。
// ④ 主帖被 X 翻译了：问"是不是求推荐"时用的是原文（页面数据里的），不是 Grok 的译文。
// ⑤ "…"菜单：开过 A 的菜单、按 Esc 关掉或点了别处以后，再开别的菜单（分享、转发）不会多出"清理掉这条"。
// 用法：node test/x_thread_misc_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]（run_all.mjs 会起服务）
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
    await page.setViewport({ width: 800, height: 2400 });
    await page.goto(`${BASE}/fakex/thread.html?extra`, { waitUntil: "load" });
    await wait(5000);
    const s = await page.evaluate(() => new Promise((res) => {
      const fills = (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").map((m) => m.id);
      const card = document.querySelector('article[data-fid="3013"] .x-quote');
      let summary = null;
      for (const f of window.__ffOnMessage || []) f({ type: "pageSummary" }, {}, (r) => { summary = r; });
      setTimeout(() => res({ fills, cardMore: window.__cardMore, cardBlock: !!card.querySelector(".ff-tx"), demand: window.__demandClicks || {},
        folded: summary && summary.folded, rec: (window.__ffJevPost || []).map((m) => m.post) }), 50);
    }));
    ok("① 只嵌了引用卡片的：不补翻卡片里的正文、不点卡片里的显示更多", !s.fills.includes("3013") && s.cardMore === 0 && !s.cardBlock, JSON.stringify(s));
    ok("② X 晚一点才挂出显示翻译的：替你点了 X 的翻译，插件不另翻", !s.fills.includes("3014") && s.demand["3014"] === 1, JSON.stringify({ fills: s.fills, demand: s.demand }));
    ok("③ 昵称冒充楼主的：按链接认账号，M1 照样清理", (s.folded || []).some(([id, kind]) => id === "3015" && kind === "m1"), JSON.stringify(s.folded));
    ok("④ 问求推荐用的是主帖原文", s.rec.length === 1 && s.rec[0].startsWith("We shipped three things today"), JSON.stringify(s.rec));
    // ⑤ 菜单
    const caret = (id) => page.click(`article[data-fid="${id}"] [data-testid="caret"]`);
    const ours = () => page.evaluate(() => document.querySelectorAll("#layers .ff-menuitem").length);
    const shareMenu = () => page.evaluate(() => { // 仿 X 别的菜单（分享、转发）：#layers 里新挂一个 role=menu
      document.getElementById("layers").innerHTML = '<div role="menu" class="x-menu"><div><div data-testid="Dropdown"><div role="menuitem" tabindex="0" class="x-mi"><div class="x-tx"><span>复制链接</span></div></div></div></div></div>';
    });
    await caret("3005");
    await wait(300);
    const first = await ours();
    await page.keyboard.press("Escape");
    await wait(200);
    await shareMenu();
    await wait(300);
    const afterEsc = await ours();
    await caret("3005");
    await wait(300);
    await page.mouse.click(5, 5); // 点了别处
    await wait(200);
    await shareMenu();
    await wait(300);
    const afterClick = await ours();
    ok("⑤ 开 A 的菜单有清理这一项；按 Esc 或点了别处以后，再开的别的菜单里没有", first === 1 && afterEsc === 0 && afterClick === 0, JSON.stringify({ first, afterEsc, afterClick }));
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
