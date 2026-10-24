// 搜索结果（不调任何接口）：仿 X 搜索页 test/fakex/search.html（/search?q=idol，你自己是 @me_account）。
// 结果里的帖子都按垃圾 / 辱骂 / 色情交给 Jev 判；你自己发的不折、不发；"相关用户"那格和广告跳过；请求里说明是搜索结果、不带作者；
// 折掉的记给弹窗；弹窗问"这个页面"答得出；换个词搜是新的一页、同一条帖子的 Jev 结果复用；/hashtag/话题 也算搜索结果。
// 翻译：仿首页翻译页换成搜索结果的地址，X 翻过的帖子照样改进。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/search_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 0.22.1 起连着 3 条以上被折的合成一条：这里测的是一条条的折叠条，先把合起来的都点开（和用户点开一样）
const openGroups = async (pg) => { await pg.evaluate(() => document.querySelectorAll('.ff-group[aria-expanded="false"]').forEach((b) => b.click())); await new Promise((r) => setTimeout(r, 300)); };
const JEV = encodeURIComponent(JSON.stringify({ "加我微信": 0.9 }));
const bars = () => {
  const r = {};
  for (const a of document.querySelectorAll('article[data-testid="tweet"]')) {
    const link = a.querySelector('a[href*="/status/"]');
    if (!link) continue;
    const id = link.getAttribute("href").match(/status\/(\d+)/)[1];
    const b = a.previousElementSibling;
    r[id] = b && b.classList.contains("ff-bar") ? b.querySelector(".ff-reason").textContent : null;
  }
  return r;
};
const summary = () => new Promise((res) => {
  let done = false;
  for (const f of window.__ffOnMessage || []) f({ type: "pageSummary" }, {}, (r) => { if (!done) { done = true; res(r); } });
  setTimeout(() => { if (!done) res(null); }, 300);
});

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 800, height: 1600 });
    await page.goto(`${BASE}/fakex/search.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(2500);
    await openGroups(page);
    let b = await page.evaluate(bars);
    ok("搜索结果里骂人的按辱骂折、色情的按色情折、推广的按垃圾回复折", /辱骂/.test(b["6002"] || "") && /色情/.test(b["6004"] || "") && !!b["6003"] && !/辱骂|色情/.test(b["6003"]),
      JSON.stringify(b));
    ok("正常的不折；你自己发的（也带\"傻\"）不折", !b["6001"] && !b["6005"], JSON.stringify(b));
    // 搜索结果里的是帖子不是回复："在 @ 别人做推广""伪装成普通评论的广告"给高分也不折，只看"引流"
    await page.goto(`${BASE}/fakex/search.html?jev=${encodeURIComponent(JSON.stringify({ "加我微信": 0.9, "新歌太好听了": { promo_mention: 0.86, disguised: 0.82 } }))}`, { waitUntil: "load" });
    await wait(2500);
    await openGroups(page);
    const b2 = await page.evaluate(bars);
    ok("搜索结果：\"在 @ 别人做推广\"\"伪装成普通评论的广告\"给高分也不折，推广（引流）的照样折", !b2["6001"] && !!b2["6003"], JSON.stringify(b2));
    // 作者分享自己做的东西（0.29.13，own_work）：搜索结果里一样，引流高分也不折
    await page.goto(`${BASE}/fakex/search.html?jev=${encodeURIComponent(JSON.stringify({ "加我微信": 0.9, "新歌太好听了": { benefit: 0.9, own_work: 0.95 } }))}`, { waitUntil: "load" });
    await wait(2500);
    await openGroups(page);
    const b3 = await page.evaluate(bars);
    ok("搜索结果：作者分享自己做的东西（own_work 0.95）引流给 0.9 也不折，推加微信的照样折", !b3["6001"] && !!b3["6003"], JSON.stringify(b3));
    await page.goto(`${BASE}/fakex/search.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(2500);
    await openGroups(page);
    const jev = await page.evaluate(() => window.__ffLastJev);
    const sent = (jev?.replies || []).map((x) => x.id);
    ok("你自己的、广告不发 Jev", !sent.includes("6005") && sent.every((id) => /^600[1-4]$/.test(id)), JSON.stringify(sent));
    ok("请求里说明是搜索结果、不带作者；缓存不按搜的词分", /search results/.test(jev?.post || "") && !jev?.author && jev?.postId === "s:search", JSON.stringify([jev?.post, jev?.author, jev?.postId]));
    const ps = await page.evaluate(summary); // 0.28.5：清理掉的从弹窗那条查询里拿（不再发"最近清理"）
    ok("清理掉的（搜索结果、这一页按搜的词记成 s:idol）", JSON.stringify((ps?.folded || []).map((x) => x[0]).sort()) === '["6002","6003","6004"]' &&
      ps.kind === "search" && ps.key === "s:idol", JSON.stringify(ps));
    let s = await page.evaluate(summary);
    ok("弹窗问这个页面：搜索结果、三类各折 1 条", s && s.kind === "search" && s.folds && s.folds.spam === 1 && s.folds.abuse === 1 && s.folds.sexual === 1, JSON.stringify(s));

    const jevCount = await page.evaluate(() => (window.__ffLog || []).filter((t) => t === "jev").length);
    await page.evaluate(() => window.__search("另一个词"));
    await wait(2000);
    b = await page.evaluate(bars);
    s = await page.evaluate(summary);
    ok("换个词搜：新的一页，新结果照样判", /辱骂/.test(b["6011"] || "") && !b["6001"] && s && s.folds && s.folds.abuse === 1 && s.folds.spam === 0, JSON.stringify([b, s]));
    const sent2 = await page.evaluate(() => (window.__ffLastJev?.replies || []).map((x) => x.id));
    ok("两次都搜到的那条只判一次（第二页只问新出现的）", !sent2.includes("6001") || (await page.evaluate(() => (window.__ffLog || []).filter((t) => t === "jev").length)) === jevCount + 1,
      JSON.stringify(sent2));

    // 话题页也是搜索结果
    await page.evaluate(() => { // 和真 X 一样：换页同时换掉时间线（这里用"换个词"那页的内容，V 是仿页面里的全局）
      history.pushState({}, "", "/hashtag/%E5%81%B6%E5%83%8F?src=hashtag_click");
      document.getElementById("tl").innerHTML = V.other;
    });
    await wait(800);
    s = await page.evaluate(summary);
    ok("/hashtag/话题 也算搜索结果（新的一页，照样判）", s && s.kind === "search" && s.folds && s.folds.abuse === 1, JSON.stringify(s));

    // 翻译：仿首页翻译页换成搜索结果的地址，替身每条都"换上"
    await page.evaluateOnNewDocument(() => { window.__ffTxDemo = true; });
    await page.goto(`${BASE}/fakex/translate.html?path=${encodeURIComponent("/search?q=idol&f=top")}`, { waitUntil: "load" });
    await wait(4000);
    await openGroups(page);
    const tx = await page.evaluate(() => ({ path: location.pathname + location.search, blocks: document.querySelectorAll(".ff-tx").length }));
    ok("搜索结果里 X 翻过的帖子照样改进", tx.path.startsWith("/search?q=idol") && tx.blocks >= 3, JSON.stringify(tx));
  } catch (e) {
    out.push(`FAIL 运行出错 ${e.stack}`);
  }
  await browser.close();
  console.log(out.join("\n"));
  process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
})();
