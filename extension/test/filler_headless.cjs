// 「赞」「mark」这类回复（0.22，设置里的 filler）：X、Reddit、YouTube、小红书的仿页面上（替身 Jev，?jev={"片段":{"filler":分}} 指定这一问的分）
// ① 只有很短（≤ 8 个汉字当量）、不带图不带链接的回复多问 filler（请求里这一条带 ask: ["filler"]），长的不问；
// ② 过了这个站点的门槛（X、YouTube、小红书 0.7，Reddit 0.8）整条藏起来、不放折叠条；没过的不动；辱骂之类照旧是折叠条（不按这一类藏）；
//    底下有回复的一级评论不藏（YouTube 的"Cardano!"下面有一条回复）；
// ③ 评论区最上面一行"清理了 N 条「赞」「mark」这类回复 查看"（X 在主帖下面，Reddit 在评论树前面，YouTube 在评论列表前面，小红书在"共 N 条评论"下面）；
//    点了全部显示、作者那一栏后面一个小标签"赞 / mark 类"，这一行变成"N 条… 收起"；再点又藏起来；弹窗答得出这一页藏了几条；
// ④ 设置里关掉这一项（sites.<网站>.filler = false）：放出来、那一行没了、以后也不再问。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，起 ext-fakex（8767），然后
// node test/filler_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const enc = (o) => encodeURIComponent(JSON.stringify(o));
// 页面里：那一行、请求里带 ask 的、弹窗问到的
const lineOf = () => {
  const l = document.querySelector(".ff-fill-line");
  return l ? { text: l.innerText.replace(/\s+/g, " ").trim(), prev: l.previousElementSibling?.tagName.toLowerCase() || null, next: l.nextElementSibling ? (l.nextElementSibling.id || l.nextElementSibling.className || l.nextElementSibling.tagName.toLowerCase()) : null } : null;
};
const askedIds = () => (window.__ffJevAll || []).flatMap((m) => m.replies.filter((x) => x.ask && x.ask.includes("filler")).map((x) => x.id));
const summary = () => new Promise((res) => { let done = false; for (const f of window.__ffOnMessage || []) f({ type: "pageSummary" }, {}, (r) => { if (!done) { done = true; res(r); } }); setTimeout(() => res(null), 300); });

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  const open = async (url) => {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 1280, height: 2400 });
    await page.goto(url, { waitUntil: "load" });
    await wait(3500);
    return page;
  };
  const click = async (page) => { await page.click(".ff-fill-line"); await wait(400); };
  const offSite = async (page, id) => { await page.evaluate((id) => chrome.storage.local.set({ ff_settings: { sites: { [id]: { filler: false } } } }), id); await wait(2000); };
  try {
    // ---------- X（帖子 7001：7104 "好可爱的猫" 很短；别的回复长） ----------
    let page = await open(`${BASE}/fakex/status/7001/?jev=${enc({ "好可爱的猫": { filler: 0.9 } })}`);
    const xs = () => page.evaluate(() => {
      const a = [...document.querySelectorAll("article")].find((x) => x.querySelector('a[href*="/status/7104"]'));
      return { hidden: getComputedStyle(a).display === "none", bar: !!a.previousElementSibling?.classList.contains("ff-bar"),
        tag: a.querySelector('[data-testid="User-Name"] > .ff-fill-tag')?.textContent || null, bars: document.querySelectorAll(".ff-bar").length };
    });
    let s = await xs(), L = await page.evaluate(lineOf);
    ok("X：只有很短的 7104 多问了 filler，长的不问", JSON.stringify([...new Set(await page.evaluate(askedIds))]) === JSON.stringify(["7104"]), JSON.stringify(await page.evaluate(askedIds)));
    ok("X：过了 0.7 整条藏起来，不放折叠条", s.hidden && !s.bar, JSON.stringify(s));
    ok("X：主帖下面一行写着清理了 1 条、查看", !!L && L.text === "清理了 1 条「赞」「mark」这类回复 查看" && L.prev === "article", JSON.stringify(L));
    let sum = await page.evaluate(summary);
    ok("X：弹窗答得出这一页藏了 1 条（不算进垃圾）", sum && sum.filler === 1 && sum.folds.spam === 0, JSON.stringify(sum));
    await click(page);
    s = await xs(); L = await page.evaluate(lineOf);
    ok("X：点了以后显示出来，作者那一栏后面一个小标签；那一行变成收起", !s.hidden && s.tag === "赞 / mark 类" && L.text === "1 条「赞」「mark」这类回复 收起", JSON.stringify({ s, L }));
    await click(page);
    s = await xs();
    ok("X：再点又藏起来，小标签撤掉", s.hidden && !s.tag, JSON.stringify(s));
    await offSite(page, "x");
    s = await xs(); L = await page.evaluate(lineOf);
    ok("X：设置里关掉这一项：放出来，那一行没了", !s.hidden && !L, JSON.stringify({ s, L }));
    await page.close();
    page = await open(`${BASE}/fakex/status/7001/?jev=${enc({ "好可爱的猫": { filler: 0.65 } })}`);
    s = await xs();
    ok("X：没过 0.7 的不动", !s.hidden && !(await page.evaluate(lineOf)), JSON.stringify(s));
    await page.close();

    // ---------- Reddit（英文帖：e5 日文一句很短、底下没回复；e4 骂人的也很短） ----------
    page = await open(`${BASE}/fakex/reddit/post_en.html?jev=${enc({ "とても面白い": { filler: 0.9 }, "傻 person": { filler: 0.95 } })}`);
    const rs = () => page.evaluate(() => {
      const c = (id) => document.querySelector(`shreddit-comment[thingid="${id}"]`);
      const e5 = c("t1_e5"), e4 = c("t1_e4");
      return { e5: getComputedStyle(e5).display === "none", e4: getComputedStyle(e4).display === "none", e4bar: e4.querySelector(".ff-bar .ff-tag")?.textContent || null,
        tag: [...e5.querySelectorAll('[slot="commentMeta"] > .ff-fill-tag')].map((t) => t.textContent) };
    });
    let r = await rs(); L = await page.evaluate(lineOf);
    const ra = await page.evaluate(askedIds);
    ok("Reddit：两条短的多问了 filler", ra.includes("t1_e4") && ra.includes("t1_e5"), JSON.stringify(ra));
    ok("Reddit：e5 过了 0.8 整条评论藏起来；骂人的 e4 照旧是辱骂的折叠条", r.e5 && !r.e4 && r.e4bar === "疑似辱骂", JSON.stringify(r));
    ok("Reddit：评论树前面一行", !!L && L.text === "清理了 1 条「赞」「mark」这类回复 查看" && L.next === "shreddit-comment-tree", JSON.stringify(L));
    await click(page);
    r = await rs();
    ok("Reddit：点了显示出来，作者那一栏有小标签", !r.e5 && JSON.stringify(r.tag) === JSON.stringify(["赞 / mark 类"]), JSON.stringify(r));
    await page.close();
    page = await open(`${BASE}/fakex/reddit/post_en.html?jev=${enc({ "とても面白い": { filler: 0.75 } })}`);
    r = await rs();
    ok("Reddit：门槛严一档（0.8），0.75 的不藏", !r.e5 && !(await page.evaluate(lineOf)), JSON.stringify(r));
    await page.close();

    // ---------- YouTube（视频页：Ugc01 下面的回复 R01 很短；Ugc14 "Cardano!" 很短、但下面有一条回复） ----------
    page = await open(`${BASE}/fakex/yt/watch.html?jev=${enc({ "Agreed, the second half": { filler: 0.9 }, "Cardano!": { filler: 0.9 } })}`);
    const ys = () => page.evaluate(() => {
      const vm = (id) => [...document.querySelectorAll("ytd-comment-view-model")].find((c) => (c.querySelector("#published-time-text a")?.getAttribute("href") || "").includes(`lc=${id}`));
      const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
      const r01 = vm("Ugc01.R01"), top1 = vm("Ugc01"), c14 = vm("Ugc14");
      return { r01: !shown(r01), top1: shown(top1), c14: shown(c14), c14thread: shown(c14?.closest("ytd-comment-thread-renderer")), tag: r01?.querySelector("#header-author > .ff-fill-tag")?.textContent || null };
    });
    let y = await ys(); L = await page.evaluate(lineOf);
    ok("YouTube：回复 R01 藏起来，它回的那条一级评论照常", y.r01 && y.top1, JSON.stringify(y));
    ok("YouTube：底下有回复的\"Cardano!\"不藏（分也过了）", y.c14 && y.c14thread, JSON.stringify(y));
    ok("YouTube：评论列表前面一行，只算藏了的 1 条", !!L && L.text === "清理了 1 条「赞」「mark」这类回复 查看" && L.next === "contents", JSON.stringify(L));
    await click(page);
    y = await ys();
    ok("YouTube：点了显示出来，作者那一栏有小标签", !y.r01 && y.tag === "赞 / mark 类", JSON.stringify(y));
    await page.close();

    // ---------- 小红书（笔记：c0005 一级评论很短、没回复；c0019 楼中楼"楼上说得对"） ----------
    page = await open(`${BASE}/fakex/xhs/note.html?jev=${enc({ "好好看，求链接": { filler: 0.9 }, "楼上说得对": { filler: 0.9 } })}`);
    const hs = () => page.evaluate(() => {
      const c = (id) => document.getElementById(`comment-${id}`);
      const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
      const c5 = c("6f10000000000000000c0005"), c19 = c("6f10000000000000000c0019");
      return { c5: !shown(c5), c5parent: getComputedStyle(c5.closest(".parent-comment")).display === "none", c19: !shown(c19),
        c19parent: shown(c19.closest(".parent-comment")?.querySelector(":scope > .comment-item")), tag: c5.querySelector(".author > .ff-fill-tag")?.textContent || null };
    });
    let h = await hs(); L = await page.evaluate(lineOf);
    ok("小红书：没回复的一级评论整个楼藏起来，楼中楼只藏它自己", h.c5 && h.c5parent && h.c19 && h.c19parent, JSON.stringify(h));
    ok("小红书：\"共 N 条评论\"下面一行，2 条", !!L && L.text === "清理了 2 条「赞」「mark」这类回复 查看" && L.next === "list-container", JSON.stringify(L));
    sum = await page.evaluate(summary);
    ok("小红书：弹窗答得出藏了 2 条", sum && sum.filler === 2, JSON.stringify(sum));
    await click(page);
    h = await hs();
    ok("小红书：点了显示出来，名字后面有小标签", !h.c5 && !h.c19 && h.tag === "赞 / mark 类", JSON.stringify(h));
    await offSite(page, "xhs");
    h = await hs();
    ok("小红书：设置里关掉：放出来、那一行没了", !h.c5 && !h.c19 && !(await page.evaluate(lineOf)) && !h.tag, JSON.stringify(h));
    await page.close();
  } finally {
    await browser.close();
  }
  console.log(out.join("\n"));
  process.exit(out.some((l) => l.startsWith("FAIL") || l.startsWith("PAGEERROR")) ? 1 : 0);
})();
