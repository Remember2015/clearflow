// 用户主页（不调任何接口）：仿 X 用户主页 test/fakex/profile.html（/prof_user，你自己是 @me_account）。
// 时间线上的帖子都按垃圾 / 辱骂 / 色情交给 Jev 判，主人自己的也判；M1 这类按回复设计的本地规则不用；广告不判；
// 请求里告诉 Jev 这是谁的主页；每折一条记给弹窗"判对了吗"；弹窗问"这个页面"答得出折了几条；换到"回复"标签照样判；
// 你自己的主页不判。翻译：同样的仿首页翻译页换成用户主页的地址，X 翻过的帖子照样改进。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/profile_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const JEV = encodeURIComponent(JSON.stringify({ "加我微信": 0.9 }));
// 每条帖子前面有没有折叠条、写的是什么理由
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
  const fs = window.__ffOnMessage || [];
  let done = false;
  for (const f of fs) f({ type: "pageSummary" }, {}, (r) => { if (!done) { done = true; res(r); } });
  setTimeout(() => { if (!done) res(null); }, 300);
});

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 800, height: 1400 });

    await page.goto(`${BASE}/fakex/profile.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(2500);
    let b = await page.evaluate(bars);
    ok("主人自己骂人的帖子按辱骂折", /辱骂/.test(b["2002"] || ""), JSON.stringify(b));
    ok("别人的转帖按色情折", /色情/.test(b["2003"] || ""), JSON.stringify(b));
    ok("主人自己的推广帖也按垃圾回复判、过线就折（用户定的）", !!b["2005"] && !/辱骂|色情/.test(b["2005"]), JSON.stringify(b));
    ok("正常帖子、主页上不用的 M1（\"@某人 好\"）不折", !b["2001"] && !b["2004"], JSON.stringify(b));
    // X 自动翻译了的帖子：判的是作者写的原文（从页面数据里取），不是页面上 X 的译文；页面数据里没有的，等 0.8 秒照页面上的判
    await wait(1200);
    const sentTx = await page.evaluate(() => Object.fromEntries((window.__ffJevAll || []).flatMap((m) => m.replies).filter((x) => ["2007", "2008"].includes(x.id)).map((x) => [x.id, x.text])));
    ok("X 翻译过的帖子：发给 Jev 的是原文（英文），不是页面上的中文译文", sentTx["2007"] === "The Milky Way over Madagascar, shot together with @photo_friend.", JSON.stringify(sentTx));
    ok("页面数据里没有原文的：等一会儿照页面上的判（不卡住）", /^第二条翻译过的合成帖子/.test(sentTx["2008"] || ""), JSON.stringify(sentTx));
    ok("翻译过的这两条正常帖子不折", !b["2007"] && !b["2008"], JSON.stringify(b));
    const jev = await page.evaluate(() => window.__ffLastJev);
    const sent = (jev?.replies || []).map((x) => x.id);
    ok("请求里告诉 Jev 这是谁的主页", /profile page of @prof_user/.test(jev?.post || "") && jev?.author?.handle === "@prof_user" && jev?.author?.name === "Prof User",
      JSON.stringify([jev?.post, jev?.author]));
    ok("广告不判", !(await page.evaluate(() => (window.__ffLog || []).length && [...document.querySelectorAll(".ff-bar")].some((x) => x.nextElementSibling?.textContent.includes("买它")))) &&
      !sent.includes("2006"), JSON.stringify(sent));
    const folded = await page.evaluate(() => window.__ffFolded || []);
    ok("折掉的记给弹窗核对（主页上的、带正文）", JSON.stringify(folded.map((x) => x.id).sort()) === '["2002","2003","2005"]' &&
      folded.every((x) => x.page === "profile" && x.postId === "u:prof_user" && x.text), JSON.stringify(folded));
    let s = await page.evaluate(summary);
    ok("弹窗问这个页面：用户主页、三类各折 1 条", s && s.kind === "profile" && s.folds && s.folds.spam === 1 && s.folds.abuse === 1 && s.folds.sexual === 1 && s.owner === "prof_user",
      JSON.stringify(s));

    // 主人自己的帖子提到别人、被问"在 @ 别人做推广""伪装成普通评论的广告"给了高分（实测：宇航员感谢合作的摄影师、提到 @SpaceX）：
    // 主页上的是帖子不是回复，这两问不算，只看"引流"那一问
    await page.goto(`${BASE}/fakex/profile.html?jev=${encodeURIComponent(JSON.stringify({ "加我微信": 0.9, "今天发了新视频": { promo_mention: 0.86, disguised: 0.8 } }))}`, { waitUntil: "load" });
    await wait(2500);
    b = await page.evaluate(bars);
    ok("主页上主人的帖子：\"在 @ 别人做推广\"\"伪装成普通评论的广告\"给高分也不折（只看\"引流\"），真拉人的照样折", !b["2001"] && !!b["2005"], JSON.stringify(b));

    await page.evaluate(() => window.__tab("with_replies"));
    await wait(1500);
    b = await page.evaluate(bars);
    ok("换到\"回复\"标签照样判：他回复的那条骂人的折，他自己的回复不折", /辱骂/.test(b["2011"] || "") && !b["2012"], JSON.stringify(b));

    await page.goto(`${BASE}/fakex/profile.html?self=prof_user&jev=${JEV}`, { waitUntil: "load" });
    await wait(2000);
    b = await page.evaluate(bars);
    s = await page.evaluate(summary);
    ok("你自己的主页不判、不折", Object.values(b).every((x) => !x) && !(await page.evaluate(() => window.__ffLastJev)) && s && s.own === true && !s.folds,
      JSON.stringify([b, s]));

    // 翻译：仿首页翻译页换成用户主页的地址，替身每条都"换上"
    await page.evaluateOnNewDocument(() => { window.__ffTxDemo = true; });
    await page.goto(`${BASE}/fakex/translate.html?path=/prof_user`, { waitUntil: "load" });
    await wait(4000);
    const tx = await page.evaluate(() => ({ path: location.pathname, blocks: document.querySelectorAll(".ff-tx").length,
      sum: globalThis.FFTxSummary ? null : "no-global" }));
    s = await page.evaluate(summary);
    ok("用户主页上 X 翻过的帖子照样改进", tx.path === "/prof_user" && tx.blocks >= 3, JSON.stringify(tx));
    ok("弹窗问这个页面：报得出改进了几条翻译", s && s.tx && s.tx.improved >= 3, JSON.stringify(s));
  } catch (e) {
    out.push(`FAIL 运行出错 ${e.stack}`);
  }
  await browser.close();
  console.log(out.join("\n"));
  process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
})();
