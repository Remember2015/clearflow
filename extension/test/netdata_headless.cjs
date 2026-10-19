// 页面数据从 X 的接口返回来（pagedata.js 旁听 XHR / fetch），不调任何外部接口：仿 X 首页 test/fakex/translate_net.html
// 先用 XHR 请求 /i/api/graphql/fake/HomeTimeline（返回格式照 X），拿到了才画帖子。查：
// 短帖用接口里的原文、不点"显示原文"；长帖不展开就拿到全文；接口里的译文和屏幕上对不上的退回点按钮；
// 回复开头的 @、结尾的图片 t.co 按 display_text_range 截掉；fetch 的返回也听得到；ff-pd-stats 报得出听到了多少；
// 同一条帖子又来一份不带译文、全文的，不冲掉先前记下的。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/netdata_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
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
    await page.goto(`${BASE}/fakex/translate_net.html`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__rendered, { timeout: 5000 });
    await wait(3500);
    const r = await page.evaluate(() => ({ msgs: Object.fromEntries((window.__ffTxMsgs || []).map((m) => [m.id, m])), toggles: window.__toggles, more: window.__moreClicks }));
    const m = (id) => r.msgs[id] || {};
    ok("短帖：原文用接口返回里的，不去点\"显示原文\"", m("5001").source === "Netflix just raised prices again, and honestly I'm done." && !r.toggles["5001"],
      JSON.stringify([m("5001"), r.toggles]));
    ok("长帖：不展开就按接口里的全文判（原文、X 的完整译文）", /all remote\.$/.test(m("5002").source || "") && /全部远程。$/.test(m("5002").xText || "") && !r.more && !r.toggles["5002"],
      JSON.stringify([m("5002"), r.more, r.toggles]));
    ok("接口里的译文和屏幕上的对不上：退回点按钮读原文", m("5003").source === "This update is a nice change." && r.toggles["5003"] >= 2, JSON.stringify([m("5003"), r.toggles]));
    ok("回复：开头的 @ 和结尾的图片 t.co 按 display_text_range 截掉", m("5004").source === "Great point about caching" && !r.toggles["5004"], JSON.stringify(m("5004")));
    // fetch 的返回也听得到：页面里自己 fetch 一份 TweetDetail，再问 pagedata.js 要里面那条（页面上没有这条）
    const f = await page.evaluate(async () => {
      await (await fetch("/i/api/graphql/fake/TweetDetail")).text();
      await new Promise((r) => setTimeout(r, 100));
      const ask = (id) => new Promise((res) => { const h = (e) => { const d = JSON.parse(e.detail); if (d.id === id) { document.removeEventListener("ff-tx-data", h); res(d); } };
        document.addEventListener("ff-tx-data", h); document.dispatchEvent(new CustomEvent("ff-tx-ask", { detail: id })); });
      const stats = await new Promise((res) => { document.addEventListener("ff-pd-stats-data", (e) => res(JSON.parse(e.detail)), { once: true }); document.dispatchEvent(new CustomEvent("ff-pd-stats")); });
      return { d: await ask("5005"), d1: await ask("5001"), stats };
    });
    ok("fetch 的返回也听得到（数据来自接口，不是组件数据）", f.d.src === "net" && f.d.source === "Fetched through fetch, not XHR." && f.d.translation === "这条是用 fetch 取的。", JSON.stringify(f.d));
    ok("ff-pd-stats：XHR 1 份、fetch 1 份、5 条帖子（用户对象不算帖子）", f.stats.xhr === 1 && f.stats.fetch === 1 && f.stats.tweets === 5 && f.stats.cached === 5 && f.stats.errors === 0,
      JSON.stringify(f.stats));
    ok("回答里带着来源和语言", f.d1.src === "net" && f.d1.srcLang === "en" && f.d1.dest === "zh" && f.d1.long === false, JSON.stringify(f.d1));
    // 同一条帖子又来一份、这次不带译文和长帖全文（有的接口就是这样）：先前记下的不能被冲掉
    const g = await page.evaluate(async () => {
      await new Promise((r) => { const x = new XMLHttpRequest(); x.open("GET", "/i/api/graphql/fake/TweetResultByRestId"); x.onloadend = r; x.send(); });
      const ask = (id) => new Promise((res) => { const h = (e) => { const d = JSON.parse(e.detail); if (d.id === id) { document.removeEventListener("ff-tx-data", h); res(d); } };
        document.addEventListener("ff-tx-data", h); document.dispatchEvent(new CustomEvent("ff-tx-ask", { detail: id })); });
      const stats = await new Promise((res) => { document.addEventListener("ff-pd-stats-data", (e) => res(JSON.parse(e.detail)), { once: true }); document.dispatchEvent(new CustomEvent("ff-pd-stats")); });
      return { d1: await ask("5001"), d2: await ask("5002"), stats };
    });
    ok("同一条帖子又来一份不带译文、全文的：先前记下的不被冲掉", g.d1.translation === "网飞又涨价了，说真的我受够了。" && g.d2.long === true && /all remote\.$/.test(g.d2.source) &&
      /全部远程。$/.test(g.d2.translation) && g.stats.xhr === 2 && g.stats.tweets === 7 && g.stats.cached === 5, JSON.stringify(g));
    // 0.28.9：正文里有 & <（full_text 里转义成 &amp; &lt;）：display_text_range 不管按还原后还是转义后的字算，都截对
    const amp = await page.evaluate(async () => {
      await (await fetch("/i/api/graphql/fake/TweetDetailAmp")).text();
      await new Promise((r) => setTimeout(r, 100));
      const ask = (id) => new Promise((res) => { const h = (e) => { const d = JSON.parse(e.detail); if (d.id === id) { document.removeEventListener("ff-tx-data", h); res(d); } };
        document.addEventListener("ff-tx-data", h); document.dispatchEvent(new CustomEvent("ff-tx-ask", { detail: id })); });
      return [(await ask("5006")).source, (await ask("5007")).source];
    });
    ok("正文里有 & <：下标按还原后、转义后的字算都截对", amp[0] === "Tom & Jerry are back <3" && amp[1] === "Tom & Jerry are back <3", JSON.stringify(amp));
  } catch (e) {
    out.push(`FAIL 运行出错 ${e.stack}`);
  }
  await browser.close();
  console.log(out.join("\n"));
  process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
})();
