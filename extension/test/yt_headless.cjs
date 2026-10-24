// YouTube（不调任何接口；替身把翻译回成"【替身补翻】"加原文，Jev 带"傻"的给辱骂 0.9，?jev 按片段给分）：仿 YouTube 的视频页和搜索结果
// （test/fakex/yt/，结构照真页面：ytd-comment-view-model、yt-attributed-string#content-text 里一个 span、时间链接带 &lc=；标题是链接里夹着一段字）。
// 评论数据像真页面一样先从 youtubei/v1/next 回来（ytdata.js 旁听：谁是频道主），再画出来。
// ① 视频页：标题换上译文、后面一个 ✦；收起时的简介换上译文、上面一行说明；推荐里的英文标题换、最前面一个 ✦，中文的不翻；
//    评论带格式换（时间戳链接、外链、表情图片留着），回复（id 里有点）也翻，中文的不翻；
//    折叠：冒充频道主的折（"冒充频道主（频道名）"），三个号吹同一个币整群折，骂人的折，喊刷播放量的（"伪装的推广"0.9）不折（YouTube 只看引流），
//    频道主自己的照样发给 Jev 判（0.21.3）；折的只藏正文和点赞那一排；YouTube 换着用同一个元素显示别的评论时，旧的译文和折叠条跟着撤掉；弹窗答得出。
//    0.15.1/0.15.2：一串回复里一唱一和的几个号（西班牙语，"引流"都不高、setup 高；开头那条是其中一个号发的）一起折、只问了一句的不折；
//    英文、中文的"晒收益"开头按 setup 折；只贴一个链接的折；一个词报币名的（"引流"0.7）不折；同一个号把同一句话回了三遍的三条都折；
//    发给 Jev 的请求里多问 setup。
// ② 搜索结果：标题换上译文、最前面一个 ✦，下面的简介摘要也换，链接的行数限制不变；中文的不翻；弹窗答"只翻标题、不折叠"。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/yt_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 0.22.1 起连着 3 条以上被折的合成一条：这里测的是一条条的折叠条，先把合起来的都点开（和用户点开一样）
// 清理得多的页面（0.27）整条藏起来了：先点开最上面那一行，再点开合起来的串
const openGroups = async (pg) => {
  await pg.evaluate(() => { const l = document.querySelector(".ff-fill-line"); if (l && /：/.test(l.textContent) && /查看/.test(l.textContent)) l.click(); }); // 清理得多（0.26）：先让一条条的清理条回来
  await new Promise((r) => setTimeout(r, 400));
  await pg.evaluate(() => document.querySelectorAll('.ff-group[aria-expanded="false"]').forEach((b) => b.click())); // 连着的一串（0.27 起两条就合）点开
  await new Promise((r) => setTimeout(r, 300));
};
const summary = () => new Promise((res) => { let done = false; for (const f of window.__ffOnMessage || []) f({ type: "pageSummary" }, {}, (r) => { if (!done) { done = true; res(r); } }); setTimeout(() => res(null), 300); });
const JEV = encodeURIComponent(JSON.stringify({ "Glad I found Zentrocoin": 0.5, "presale is almost over": 0.55, "hits 100x": 0.62, "stream more": { disguised: 0.9 }, "Telegram @synthgift": { benefit: 0.2, setup: 0.6 },
  "Valeria Ostin": { benefit: 0.4, setup: 0.85 }, "cambió mi vida": { disguised: 0.7, setup: 0.66 }, "sobre todo en Telegram": { benefit: 0.3, setup: 0.8 },
  "I started with $3,000": { setup: 0.85 }, "二十一万": { setup: 0.82 }, "Cardano!": 0.7 }));
const state = () => {
  const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
  const r = {};
  for (const c of document.querySelectorAll("ytd-comment-view-model")) {
    const id = (c.querySelector("#published-time-text a")?.getAttribute("href").match(/lc=([\w.-]+)/) || [])[1];
    const ex = c.querySelector("#expander"), bar = ex.previousElementSibling?.classList.contains("ff-bar") ? ex.previousElementSibling : null;
    const host = c.querySelector("#content-text"), orig = host.querySelector(":scope > span:not(.ff-own)"), cl = host.querySelector(":scope > .ff-rtx-whole");
    r[id] = { bar: bar ? bar.querySelector(".ff-reason").textContent : null, hidden: !shown(ex), toolbarHidden: !shown(c.querySelector("#action-buttons")), headShown: shown(c.querySelector("#header-author")),
      tx: cl ? cl.textContent.replace(/\s+/g, " ").trim() : null, txShown: shown(cl), origShown: shown(orig), note: c.querySelector("#header-author > .ff-yt-hnote .ff-tx-label")?.textContent || null,
      noteShown: shown(c.querySelector("#header-author > .ff-yt-hnote")), noteInExpander: !!ex.querySelector(".ff-tx-note"),
      links: cl ? [...cl.querySelectorAll("a")].map((a) => a.getAttribute("href")) : [], imgs: cl ? cl.querySelectorAll("img").length : 0, bars: c.querySelectorAll(".ff-bar").length };
  }
  const h1 = document.querySelector("ytd-watch-metadata h1"), tOrig = h1?.querySelector("yt-formatted-string"), tc = h1?.querySelector(".ff-rtx-title");
  const sn = document.querySelector("#attributed-snippet-text"), snOrig = sn?.querySelector(":scope > span:not(.ff-own)"), snc = sn?.querySelector(":scope > .ff-rtx-snip");
  r.watch = h1 ? { title: tc?.textContent || null, titleShown: shown(tc), titleTag: tc?.tagName, origShown: shown(tOrig), icon: tc?.nextElementSibling?.classList.contains("ff-tx-inote") || false,
    desc: snc?.textContent || null, descShown: shown(snc), descOrig: shown(snOrig), descNote: document.querySelector("#description-inner > .ff-rtx-note .ff-tx-label")?.textContent || null } : null;
  r.related = [...document.querySelectorAll("yt-lockup-view-model a.ytLockupMetadataViewModelTitle, ytd-video-renderer a#video-title")].map((a) => {
    const o = a.querySelector(":scope > span:not(.ff-own), :scope > yt-formatted-string"), c = a.querySelector(":scope > .ff-rtx-title");
    const card = a.closest("ytd-video-renderer"), sp = card?.querySelector(".metadata-snippet-container"), spo = sp?.querySelector("yt-formatted-string:not(.ff-own)"), spc = sp?.querySelector(".ff-rtx-snip");
    const icon = a.querySelector(":scope > .ff-tx-inote"), before = icon ? [...a.children].slice(0, [...a.children].indexOf(icon)) : [];
    return { href: a.getAttribute("href"), tx: c?.textContent || null, txShown: shown(c), origShown: shown(o), iconFirst: !!icon && before.every((e) => !shown(e)), // 前面只有藏着的（yt-icon）
      tip: a.querySelector(".ff-tx-inote")?.title || "", maxH: getComputedStyle(a).maxHeight, snip: spc?.textContent || null, snipShown: shown(spc), snipOrig: shown(spo) };
  });
  r.jev = (window.__ffJevAll || []).map((m) => ({ post: m.post, author: m.author, ids: m.replies.map((x) => x.id), extra: m.extra || null, keys: m.keys || null }));
  return r;
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 1280, height: 1800 });

    // ① 视频页
    await page.goto(`${BASE}/fakex/yt/watch.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(4000);
    await openGroups(page);
    let s = await page.evaluate(state);
    ok("YouTube 视频页：标题换上译文（插件自己的 span，不克隆 YouTube 的组件）、后面一个 ✦；收起时的简介换上译文、上面一行说明",
      s.watch.title === "【替身补翻】How Synthetic Engines Work, Explained" && s.watch.titleShown && s.watch.titleTag === "SPAN" && !s.watch.origShown && s.watch.icon &&
      /^【替身补翻】In this video/.test(s.watch.desc || "") && s.watch.descShown && !s.watch.descOrig && s.watch.descNote === "翻译自英语", JSON.stringify(s.watch));
    ok("YouTube 推荐：英文标题在链接里换上译文、最前面一个 ✦，中文的不翻", s.related[0].tx === "【替身补翻】Synthetic engines, part two" && s.related[0].txShown && !s.related[0].origShown &&
      s.related[0].iconFirst && /^翻译自英语 · /.test(s.related[0].tip) && !s.related[1].tx && s.related[1].origShown && !s.related[1].iconFirst, JSON.stringify(s.related));
    ok("YouTube 评论：英文的原位置换，说明在作者那一行后面（不进正文那一格，免得 YouTube 的\"展开\"以为内容变长）；回复（id 里有点）也翻；中文的不翻",
      /^【替身补翻】This explanation/.test(s.Ugc01.tx || "") && s.Ugc01.txShown && !s.Ugc01.origShown && s.Ugc01.note === "翻译自英语" && s.Ugc01.noteShown && !s.Ugc01.noteInExpander &&
      /^【替身补翻】Agreed/.test(s["Ugc01.R01"].tx || "") && !s.Ugc09.tx && s.Ugc09.origShown, JSON.stringify([s.Ugc01, s["Ugc01.R01"], s.Ugc09]));
    ok("YouTube 评论带格式换：时间戳链接、外链、表情图片留着", JSON.stringify(s.Ugc10.links) === JSON.stringify(["/watch?v=SYNTHVID001&t=95s", "https://www.youtube.com/redirect?q=https%3A%2F%2Fexample.com"]) &&
      s.Ugc10.imgs === 1, JSON.stringify(s.Ugc10));
    ok("YouTube 折叠：冒充频道主的折、写着冒充的是谁；折起来的评论作者那一行不显示翻译说明", s.Ugc03.bar === "冒充频道主（Synthetic Channel）" && s.Ugc03.hidden && s.Ugc03.toolbarHidden &&
      s.Ugc03.headShown && !!s.Ugc03.note && !s.Ugc03.noteShown, JSON.stringify(s.Ugc03));
    ok("YouTube 折叠：三个号吹同一个币，单看只有一条够分，整群都折", ["Ugc04", "Ugc05", "Ugc06"].every((k) => s[k].bar === "3 个账号在吹「Zentrocoin」" && s[k].hidden),
      JSON.stringify(["Ugc04", "Ugc05", "Ugc06"].map((k) => s[k].bar)));
    ok("YouTube 折叠：骂人的折；喊刷播放量的（\"伪装的推广\"0.9）不折；频道主自己的照样判、这句没问题不折", /辱骂/.test(s.Ugc08.bar || "") && s.Ugc08.hidden && !s.Ugc07.bar && !s.Ugc07.hidden && !s.Ugc02.bar,
      JSON.stringify([s.Ugc07, s.Ugc08, s.Ugc02].map((x) => x.bar)));
    const thr = ["Ugc11", "Ugc11.R02", "Ugc11.R03", "Ugc11.R04"];
    ok("YouTube 折叠：一串西班牙语的一唱一和（引流都不高、setup 高）——报全名的、跟着夸的、说去 Telegram 找的（也是开头那个号）连同开头一起折，只问了一句的不折",
      thr.every((k) => s[k].bar === "这串回复里 3 个账号一唱一和" && s[k].hidden) && !s["Ugc11.R01"].bar && !s["Ugc11.R01"].hidden, JSON.stringify([...thr, "Ugc11.R01"].map((k) => s[k].bar)));
    ok("YouTube 折叠：英文、中文的晒收益开头按 setup 折（不靠话术）；只贴一个链接的折；一个词报币名的（引流 0.7）不折",
      s.Ugc12.bar === "像是骗局的套路" && s.Ugc12.hidden && s.Ugc15.bar === "像是骗局的套路" && s.Ugc15.hidden &&
      s.Ugc13.bar === "只贴了一个链接" && s.Ugc13.hidden && !s.Ugc14.bar && !s.Ugc14.hidden, JSON.stringify([s.Ugc12, s.Ugc15, s.Ugc13, s.Ugc14].map((x) => x.bar)));
    ok("YouTube 折叠：同一个号把同一句话回了三遍，三条都折", ["Ugc12.R01", "Ugc13.R01", "Ugc14.R01"].every((k) => s[k].bar === "同一个账号发了 3 遍" && s[k].hidden),
      JSON.stringify(["Ugc12.R01", "Ugc13.R01", "Ugc14.R01"].map((k) => s[k].bar)));
    ok("只问用得上的（0.29.14）：YouTube 不问\"伪装\"\"@ 推广\"", s.jev.length > 0 && s.jev.every((m) => JSON.stringify(m.keys) === JSON.stringify(["benefit", "abuse", "sexual"])), JSON.stringify(s.jev.map((m) => m.keys)));
    const sent = s.jev.flatMap((m) => m.ids);
    ok("发给 Jev 的：主帖是视频标题和频道、带频道主、多问 setup；频道主自己的评论也发（0.21.3）", s.jev.length >= 1 && s.jev.every((m) => m.post === "How Synthetic Engines Work, Explained\n(channel: Synthetic Channel)" &&
      m.author?.name === "Synthetic Channel" && JSON.stringify(m.extra) === '["setup"]') && sent.includes("yt_Ugc02") && sent.includes("yt_Ugc01.R01"), JSON.stringify(s.jev));
    let sum = await page.evaluate(summary);
    ok("YouTube 视频页：弹窗问这个页面——折了垃圾 14 条（冒充 1、托儿 3、一唱一和 4、骗局套路 2、只贴链接 1、发三遍的 3）、辱骂 1 条，翻了的也报", sum && sum.site === "yt" && sum.kind === "status" && sum.folds && sum.folds.spam === 14 &&
      sum.folds.abuse === 1 && sum.tx && sum.tx.filled >= 10, JSON.stringify(sum));
    // YouTube 换着用同一个元素显示别的评论：把 c01 的元素改成一条中文评论、c08（折了的）改成一条正常的中文评论
    await page.evaluate(() => {
      const swap = (from, to, text) => { const c = [...document.querySelectorAll("ytd-comment-view-model")].find((x) => x.querySelector(`#published-time-text a[href*="lc=${from}"]`));
        c.querySelector("#published-time-text a").setAttribute("href", `/watch?v=SYNTHVID001&lc=${to}`); c.querySelector("#content-text > span:not(.ff-own)").textContent = text; };
      swap("Ugc01", "Ugc91", "这条是换上来的中文评论。");
      swap("Ugc08", "Ugc98", "另一条换上来的正常中文评论。");
    });
    await wait(1500);
    s = await page.evaluate(state);
    ok("YouTube 换着用同一个元素：旧评论的译文撤掉、原文露出来；折叠条撤掉、正文露出来", !s.Ugc91.tx && s.Ugc91.origShown && !s.Ugc98.bar && !s.Ugc98.hidden && s.Ugc98.bars === 0,
      JSON.stringify([s.Ugc91, s.Ugc98]));

    // ② 搜索结果
    await page.goto(`${BASE}/fakex/yt/results.html`, { waitUntil: "load" });
    await wait(2500);
    await openGroups(page);
    s = await page.evaluate(state);
    const [r1, r2] = s.related;
    ok("YouTube 搜索结果：标题在链接里换上译文、最前面一个 ✦，链接的两行限制还在；下面的简介摘要也换；中文的不翻",
      r1.tx === "【替身补翻】Why synthetic engines are quieter than you think" && r1.txShown && !r1.origShown && r1.iconFirst && r1.maxH === "52px" &&
      /^【替身补翻】A long look/.test(r1.snip || "") && r1.snipShown && !r1.snipOrig && !r2.tx && r2.origShown && !r2.snip, JSON.stringify([r1, r2]));
    await page.evaluate(() => document.querySelector("ytd-video-renderer .ff-tx-inote").click());
    await wait(200);
    s = await page.evaluate(state);
    ok("YouTube 搜索结果：点 ✦ 看原文，标题和简介摘要一起换回原文；点 ✦ 不会跳到视频", s.related[0].origShown && !s.related[0].txShown && s.related[0].snipOrig && !s.related[0].snipShown &&
      (await page.evaluate(() => location.pathname)) === "/results", JSON.stringify(s.related[0]));
    sum = await page.evaluate(summary);
    ok("YouTube 搜索结果：弹窗答只翻标题、不折叠", sum && sum.site === "yt" && sum.kind === "list" && !sum.folds && sum.tx && sum.tx.filled === 1, JSON.stringify(sum));

    // ③ 0.28.6（review）：页面数据没到（拦掉 ytdata 发来的消息）时不判"冒充频道主"——频道主自己带推广意味的评论（替身给推广分 0.5）
    //    以前因为不知道是不是频道主就当不是，handle 和频道一样，被当冒充者清理
    {
      const p2 = await browser.newPage();
      p2.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
      await p2.evaluateOnNewDocument(() => window.addEventListener("message", (e) => { if (e.data && e.data.source === "ff-yt") e.stopImmediatePropagation(); }, true));
      await p2.setViewport({ width: 1280, height: 1800 });
      await p2.goto(`${BASE}/fakex/yt/watch.html?jev=${encodeURIComponent(JSON.stringify({ "New video next week": { benefit: 0.5 } }))}`, { waitUntil: "load" });
      await wait(4000);
      await openGroups(p2);
      const st = await p2.evaluate(state);
      ok("YouTube：页面数据没到时，频道主自己的推广评论不判成冒充频道主", !/冒充/.test(st.Ugc02.bar || ""), JSON.stringify(st.Ugc02));
      await p2.close();
    }
  } catch (e) {
    out.push(`FAIL 运行出错 ${e.stack}`);
  }
  await browser.close();
  console.log(out.join("\n"));
  process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
})();
