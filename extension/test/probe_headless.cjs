// X 页面探针（test/x_probe.js）自己的测试（不调任何接口）：在仿 X 页面上跑一遍，看它认得出该认的、报得出该报的。
// 探针真正的用处在真 X 上（见 README"X 改版"一节）；这里只防探针自己写错。
// translate_net.html（首页、装着测试包、页面数据从仿 X 接口来）：帖子各项正常；页面数据 3 条对得上、5003 故意对不上；
// thread.html（帖子页）：认出主帖、"发现更多"之前的回复和之后不算的那条；status/135（帖子页、带引用卡片）：引用卡片都认出来。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py && python3 test/build_probe.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/probe_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const fs = require("fs");
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const PROBE = fs.readFileSync(path.join(__dirname, "x_probe.js"), "utf8");
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const row = (r, check) => r.rows.find((x) => x.检查.startsWith(check)) || {};
// 仿页面本来就没做的东西（作者链接、"…"按钮、点赞按钮、React 组件数据……）探针报失效是对的，不算
const failed = (r, gaps = []) => r.rows.filter((x) => x.结果 === "失效" && !gaps.some((g) => x.检查.startsWith(g))).map((x) => x.检查);

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 800, height: 1400 });

    await page.goto(`${BASE}/fakex/translate_net.html`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__rendered, { timeout: 5000 });
    await wait(3000); // 等插件把 5003 的"显示原文"点回来
    let r = await page.evaluate(PROBE);
    const homeGaps = ["作者链接", "右上角的「…」按钮", "点赞按钮", "React 组件数据"];
    ok("首页：除了仿页面没做的，没有失效的项", !failed(r, homeGaps).length, JSON.stringify(failed(r, homeGaps)));
    ok("首页：认出 4 条帖子、链接和作者都齐", /^4 条/.test(row(r, "帖子 article").说明) && row(r, "帖子链接").说明 === "4/4（不算广告）" && row(r, "作者那一栏里按行认出").结果 === "正常",
      JSON.stringify(r.rows.slice(4, 9)));
    ok("首页：认出 X 自动翻了的 4 条", /^X 自动翻了的 4、/.test(row(r, "翻译那一行").说明), row(r, "翻译那一行").说明);
    ok("首页：旁听接口正常（XHR 1 份、4 条帖子）", row(r, "旁听 X 的接口返回").结果 === "正常" && /XHR 1、fetch 0）.*4 条帖子/.test(row(r, "旁听 X 的接口返回").说明),
      row(r, "旁听 X 的接口返回").说明);
    const pd = row(r, "X 翻译了的帖子");
    ok("首页：页面数据 3 条对得上、5003 故意对不上 → 注意", pd.结果 === "注意" && /来自接口 3、来自组件数据 0、没有 0、对不上 1（5003）/.test(pd.说明), JSON.stringify(pd));
    ok("首页：不在帖子页时不查评论区", !r.rows.some((x) => x.区域 === "评论区"), "");
    // 模拟 X 改版：正文换了标记、作者栏没了 → 这两项报失效，总结里说 X 可能改版了
    r = await page.evaluate(`document.querySelectorAll('[data-testid="tweetText"]').forEach((e) => e.setAttribute("data-testid", "postText"));
      document.querySelectorAll('[data-testid="User-Name"]').forEach((e) => e.removeAttribute("data-testid"));` + PROBE);
    ok("X 改了正文和作者栏的标记：探针报失效", row(r, "正文 tweetText").结果 === "失效" && row(r, "作者那一栏 User-Name").结果 === "失效" && /失效.*X 可能改版了/.test(r.summary),
      JSON.stringify([row(r, "正文 tweetText"), row(r, "作者那一栏 User-Name"), r.summary]));

    await page.goto(`${BASE}/fakex/thread.html`, { waitUntil: "load" });
    await wait(2500);
    r = await page.evaluate(PROBE);
    const threadGaps = ["React 组件数据"];
    ok("帖子页：除了仿页面没做的，没有失效的项", !failed(r, threadGaps).length, JSON.stringify(failed(r, threadGaps)));
    ok("帖子页：认出主帖", row(r, "主帖").结果 === "正常", JSON.stringify(row(r, "主帖")));
    const rep = row(r, "回复（主帖后面"), hdr = row(r, "分段标题");
    ok("帖子页：\"发现更多\"之前的回复都算、之后那条不算", rep.结果 === "正常" && /^\d+ 条/.test(rep.说明) && /「发现更多」，后面还有 1 条帖子不算/.test(hdr.说明),
      JSON.stringify([rep, hdr]));
    const tr = row(r, "X 翻译了的帖子"), ear = row(r, "旁听 X 的接口返回");
    ok("帖子页：插件在、但一份接口返回都没听到 → 提示刷新，数据那项不判失效", ear.结果 === "注意" && /刷新一下/.test(ear.说明) && tr.结果 === "注意" && /没有 1/.test(tr.说明),
      JSON.stringify([ear, tr]));

    await page.goto(`${BASE}/fakex/status/135/`, { waitUntil: "load" });
    await wait(2500);
    r = await page.evaluate(PROBE);
    const quoteGaps = ["中间那栏", "作者链接", "正文的 lang", "React 组件数据"];
    ok("带引用的帖子页：除了仿页面没做的，没有失效的项", !failed(r, quoteGaps).length, JSON.stringify(failed(r, quoteGaps)));
    ok("带引用的帖子页：引用卡片都认出来", row(r, "引用卡片").结果 === "正常", JSON.stringify(row(r, "引用卡片")));
  } catch (e) {
    out.push(`FAIL 运行出错 ${e.stack}`);
  }
  await browser.close();
  console.log(out.join("\n"));
  process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
})();
