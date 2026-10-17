// 连着的一串被折的合成一条（0.22.1，用户 10-16 截图：X 上 16 条折叠条一条接一条）：
// ① X 帖子 123：901 后面 7 条连着被折（垃圾 4、辱骂 2、色情 1）→ 一条，左边每一类一个标签带条数，中间"7 条"和出现最多的两种原因；
//    这 7 条自己的折叠条、原文都不显示；点开：合起来那条留在最上面换成收起，7 条折叠条都出来、每条还能单独展开；再点合上，单独展开的也合上；
//    弹窗照旧按条数报（7 条，按类别分）；
// ② X 帖子 135：两条连着被折，也合（0.27 起两条就合）；
// ③ Reddit 帖子：3 条连着被折（同一句话）→ 整条评论都藏起来（这里折的只藏正文，作者那一行还在），前面放合起来的那一条；点开以后一条条照旧。
// ④ 清理得多（0.27，用户 10-17 截图）：X 7005、Reddit post_heavy 上 7 条垃圾和正常回复一条隔一条，清理条超过 5 条——被清理的整条藏起来，
//    最上面一行"清理了 N 条：垃圾回复 7、「赞」「mark」这类 1 · 查看"；点查看一条条的清理条回来、这一行换成收起；再点又藏起来。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，起 ext-fakex（8767），然后
// node test/group_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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
  try {
    // ---------- X ----------
    let page = await open(`${BASE}/fakex/status/123/`);
    const xs = () => page.evaluate(() => {
      const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
      const gs = [...document.querySelectorAll(".ff-group")];
      const g = gs[0];
      const items = {};
      for (const a of document.querySelectorAll("article")) {
        const id = (a.querySelector('a[href*="/status/"]')?.getAttribute("href").match(/status\/(\d+)/) || [])[1];
        const bar = [...(a.parentElement?.children || [])].find((b) => b.classList.contains("ff-bar") && b.dataset.ffId === id);
        items[id] = { art: shown(a), bar: shown(bar) };
      }
      return { n: gs.length, tags: g ? [...g.querySelectorAll(".ff-tag")].map((t) => t.textContent) : [], count: g?.querySelector(".ff-reason")?.textContent || null,
        why: g?.querySelector(".ff-group-why")?.textContent || null, expanded: g?.getAttribute("aria-expanded") || null, btn: g?.querySelector(".ff-icon")?.getAttribute("aria-label") || null,
        before: g?.nextElementSibling?.tagName.toLowerCase() || null, items };
    });
    const members = ["902", "903", "904", "905", "906", "907", "908"];
    let s = await xs();
    ok("X：7 条连着被折的合成一条，每一类一个标签带条数", s.n === 1 && JSON.stringify(s.tags) === JSON.stringify(["疑似垃圾回复 4", "疑似辱骂 2", "疑似色情 1"]) && s.count === "7 条", JSON.stringify(s));
    ok("X：后面写出现最多的两种原因（去掉分数和账号）", !!s.why && s.why.split("、").length === 2 && !/\d\.\d\d|@/.test(s.why), JSON.stringify(s.why));
    ok("X：合着的时候这 7 条自己的折叠条和原文都不显示，901 照常", members.every((id) => !s.items[id].art && !s.items[id].bar) && s.items["901"].art && s.expanded === "false" && s.btn === "展开这 7 条", JSON.stringify(s.items));
    let sum = await page.evaluate(summary);
    ok("X：弹窗照旧按条数、按类别报", sum && sum.folds.spam === 4 && sum.folds.abuse === 2 && sum.folds.sexual === 1, JSON.stringify(sum));
    await page.click(".ff-group"); await wait(400);
    s = await xs();
    ok("X：点开：合起来那条留在最上面换成收起，7 条折叠条都出来，原文还收着", s.n === 1 && s.expanded === "true" && s.btn === "收起这 7 条" && members.every((id) => s.items[id].bar && !s.items[id].art), JSON.stringify(s));
    await page.evaluate(() => [...document.querySelectorAll(".ff-bar:not(.ff-group)")].find((b) => b.dataset.ffId === "903").click()); await wait(400);
    s = await xs();
    ok("X：点开以后每条还能单独展开", s.items["903"].art && !s.items["904"].art, JSON.stringify(s.items["903"]));
    await page.click(".ff-group"); await wait(400);
    s = await xs();
    ok("X：再点合上，单独展开的那条也合上", s.expanded === "false" && members.every((id) => !s.items[id].art && !s.items[id].bar), JSON.stringify(s.items));
    await page.close();

    page = await open(`${BASE}/fakex/status/135/`);
    const two = await page.evaluate(() => ({ groups: document.querySelectorAll(".ff-group").length, bars: [...document.querySelectorAll(".ff-bar")].filter((b) => getComputedStyle(b).display !== "none").length }));
    ok("X：两条连着被折的也合成一条（0.27）", two.groups === 1 && two.bars === 1, JSON.stringify(two));
    await page.close();

    // ---------- Reddit ----------
    page = await open(`${BASE}/fakex/reddit/post.html`);
    const rs = () => page.evaluate(() => {
      const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
      const g = document.querySelector(".ff-group");
      const ids = g ? (() => { const out = []; for (let e = g.nextElementSibling; e && e.tagName === "SHREDDIT-COMMENT"; e = e.nextElementSibling) out.push(e); return out; })() : [];
      const folded = [...document.querySelectorAll("shreddit-comment")].filter((c) => c.dataset.ffGrp);
      return { g: !!g, count: g?.querySelector(".ff-reason")?.textContent || null, tags: g ? [...g.querySelectorAll(".ff-tag")].map((t) => t.textContent) : [], next: g?.nextElementSibling?.tagName.toLowerCase() || null,
        hiddenWhole: folded.length, folded: folded.map((c) => shown(c)), memberBars: folded.map((c) => shown(c.querySelector(".ff-bar"))), slot: g ? g.getAttribute("slot") : null, expanded: g?.getAttribute("aria-expanded") || null };
    });
    let r = await rs();
    ok("Reddit：3 条连着被折的整条评论都藏起来，前面一条合起来的", r.g && r.count === "3 条" && JSON.stringify(r.tags) === JSON.stringify(["疑似垃圾回复 3"]) && r.next === "shreddit-comment" && r.hiddenWhole === 3 && r.folded.every((x) => !x), JSON.stringify(r));
    await page.click(".ff-group"); await wait(400);
    r = await page.evaluate(() => {
      const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
      const g = document.querySelector(".ff-group");
      const bars = [...document.querySelectorAll("shreddit-comment .ff-bar")].filter((b) => shown(b)).length;
      return { expanded: g?.getAttribute("aria-expanded"), grp: document.querySelectorAll("shreddit-comment[data-ff-grp]").length, bars };
    });
    ok("Reddit：点开以后评论回来，一条条的折叠条照旧", r.expanded === "true" && r.grp === 0 && r.bars >= 3, JSON.stringify(r));
    await page.close();

    // ---------- 清理得多：整条藏起来、最上面一行汇总 ----------
    const heavy = (sel) => page.evaluate((sel) => {
      const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
      const line = document.querySelector(".ff-fill-line");
      return { line: line?.querySelector(".ff-fill-text")?.textContent || null, act: line?.querySelector(".ff-fill-act")?.textContent || null,
        cells: [...document.querySelectorAll('[data-testid="cellInnerDiv"]')].filter((c) => getComputedStyle(c).display === "none").length,
        bars: [...document.querySelectorAll(".ff-bar")].filter(shown).length, spamShown: [...document.querySelectorAll(sel)].filter(shown).length };
    }, sel);
    page = await open(`${BASE}/fakex/status/7005/?jev=${encodeURIComponent(JSON.stringify({ "领福利": 0.9, "赞": { filler: 0.95 } }))}`);
    const XS = 'article[data-testid="tweet"]:has(a[href*="/status/75"])';
    let h = await heavy(XS);
    ok("X 清理得多：7 条垃圾整条藏起来、不放清理条，最上面一行汇总", h.spamShown === 0 && h.bars === 0 && h.line === "清理了 8 条：垃圾回复 7、「赞」「mark」这类 1" && h.act === "查看", JSON.stringify(h));
    ok("X：藏起来的连那一格一起藏（格子的下边框叠成灰条，用户 10-17 截图）", h.cells === 8, JSON.stringify(h));
    ok("X：看得见的回复不多（6 条），下面不再放一行（0.27）", !(await page.evaluate(() => !!document.querySelector(".ff-fill-bottom"))));
    await page.click(".ff-fill-line"); await wait(500);
    h = await heavy(XS);
    ok("X 清理得多：点查看，一条条的清理条回来（隔着正常回复，各自一条），这一行换成收起", h.bars === 7 && h.spamShown === 0 && /^清理掉的 8 条/.test(h.line || "") && h.act === "收起" && h.cells === 0, JSON.stringify(h));
    await page.click(".ff-fill-line"); await wait(500);
    h = await heavy(XS);
    ok("X 清理得多：再点又整条藏起来", h.bars === 0 && h.spamShown === 0 && h.act === "查看", JSON.stringify(h));
    await page.close();
    page = await open(`${BASE}/fakex/reddit/post_many.html?jev=${encodeURIComponent(JSON.stringify({ nice: { filler: 0.95 } }))}`);
    const many = await page.evaluate(() => { const b = document.querySelector(".ff-fill-bottom"), tree = document.querySelector("shreddit-comment-tree");
      return { has: !!b, afterTree: !!b && b.previousElementSibling === tree, text: b?.querySelector(".ff-fill-text")?.textContent || null,
        top: document.querySelector(".ff-fill-line:not(.ff-fill-bottom) .ff-fill-text")?.textContent || null };
    });
    ok("Reddit 评论区长（18 条看得见）：评论列表下面也放一行，和上面那一行一样（0.27）", many.has && many.afterTree && many.text === many.top && many.text === "清理了 2 条「赞」「mark」这类回复", JSON.stringify(many));
    await page.click(".ff-fill-bottom"); await wait(400);
    const many2 = await page.evaluate(() => [...document.querySelectorAll(".ff-fill-line")].map((l) => l.querySelector(".ff-fill-act").textContent));
    ok("Reddit：点下面那一行，两行一起变成收起", JSON.stringify(many2) === JSON.stringify(["收起", "收起"]), JSON.stringify(many2));
    await page.close();
    page = await open(`${BASE}/fakex/status/7006/?jev=${encodeURIComponent(JSON.stringify({ "领福利": 0.9 }))}`);
    const both = await page.evaluate(() => ({ banner: document.querySelector(".ff-banner")?.textContent || null, line: document.querySelector(".ff-fill-line .ff-fill-text")?.textContent || null }));
    ok("X：清理得多、整条藏起来时，不再另起一行\"大多是机器人\"，只留最上面那一行", !both.banner && /^清理了 12 条/.test(both.line || ""), JSON.stringify(both));
    await page.close();
    page = await open(`${BASE}/fakex/reddit/post_heavy.html?jev=${encodeURIComponent(JSON.stringify({ "领福利": 0.9 }))}`);
    const RS = 'shreddit-comment[thingid^="t1_h"]';
    h = await heavy(RS);
    ok("Reddit 清理得多：7 条垃圾评论整条藏起来，最上面一行汇总", h.spamShown === 0 && h.bars === 0 && h.line === "清理了 7 条：垃圾回复 7" && h.act === "查看", JSON.stringify(h));
    await page.click(".ff-fill-line"); await wait(500);
    h = await heavy(RS);
    ok("Reddit 清理得多：点查看，评论和一条条的清理条回来", h.spamShown === 7 && h.bars === 7 && h.act === "收起", JSON.stringify(h));
    await page.close();
  } finally {
    await browser.close();
  }
  console.log(out.join("\n"));
  process.exit(out.some((l) => l.startsWith("FAIL") || l.startsWith("PAGEERROR")) ? 1 : 0);
})();
