// 小红书（不调任何接口；替身把翻译回成"【替身补翻】"加原文，Jev 带"傻"的给辱骂 0.9、带"露骨"的给色情 0.95，?jev 按片段给分）：
// 仿小红书的笔记页、首页列表（点开笔记是浮层）、搜索结果（test/fakex/xhs/，结构照 2026-10-15 登录后看的真页面，见 build_fakex.py）。
// ① 笔记页（整页打开）：标题（h1 浅克隆）和正文（带格式：#话题、表情图片留着）换上译文、标题上面一行说明；
//    评论英文、日文的原位置换，说明在作者那一行后面；楼中楼的"回复 某某："不算正文、不发去翻；中文的不翻；
//    折叠：骂人的、引流的（?jev 给 0.9，评论配图一起藏）、色情的楼中楼折，只藏正文和配图，作者那一行、时间赞回复那一行留着；
//    笔记作者自己的照样发给 Jev 判（0.21.3）；只有表情图片的不判；发给 Jev 的主帖是标题加正文、楼主是笔记作者；弹窗答得出。
// ② 首页列表：英文标题换上译文、最前面一个 ✦，中文的不翻；弹窗答"只翻标题、不折叠"。点开笔记浮层（网址变成 /explore/<笔记 id>）：
//    按笔记页判和翻；关掉浮层回到列表：折叠条都撤掉、弹窗又答列表。
// ③ 搜索结果：标题照样翻。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/xhs_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const summary = () => new Promise((res) => { let done = false; for (const f of window.__ffOnMessage || []) f({ type: "pageSummary" }, {}, (r) => { if (!done) { done = true; res(r); } }); setTimeout(() => res(null), 300); });
const JEV = encodeURIComponent(JSON.stringify({ "同款低价": 0.9, "快看这个": 0.9 }));
// 后台存"最近折叠"时认的 id、页面键（background.js 的 SITE_ID 和 cleanFold）
const SITE_ID = /^(\d{1,25}|t[13]_[a-z0-9]{1,13}|[a-z]{2}_[\w.-]{1,100})$/;
const POST_ID = /^(\d{1,25}|u:[a-z0-9_]{1,15}|s:[\w%.~!*'()-]{1,80}|r:t3_[a-z0-9]{1,13}|r[fs]:[\w%.~!*'()-]{1,90}|[a-z]{2}:[a-z]:[\w%.~!*'()-]{1,90})$/;
const state = async () => {
  const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
  const r = { c: {} };
  for (const c of document.querySelectorAll(".comment-item")) {
    const id = c.id.slice(-4);
    const right = c.querySelector(":scope > .comment-inner-container > .right");
    const content = right.querySelector(":scope > .content"), pic = right.querySelector(":scope > .comment-picture");
    const bar = content.previousElementSibling?.classList.contains("ff-bar") ? content.previousElementSibling : null;
    const orig = content.querySelector(":scope > .note-text:not(.ff-own)"), cl = content.querySelector(":scope > .ff-rtx-whole");
    r.c[id] = { bar: bar ? bar.querySelector(".ff-reason")?.textContent || "" : null, hidden: !shown(content), picHidden: pic ? !shown(pic) : null,
      infoShown: shown(right.querySelector(":scope > .info")), headShown: shown(right.querySelector(":scope > .author-wrapper")),
      tx: cl ? cl.textContent.replace(/\s+/g, " ").trim() : null, txShown: shown(cl), origShown: shown(orig),
      note: right.querySelector(".author > .ff-xhs-hnote .ff-tx-label")?.textContent || null, noteShown: shown(right.querySelector(".author > .ff-xhs-hnote")),
      imgs: cl ? cl.querySelectorAll("img").length : 0, bars: c.querySelectorAll(".ff-bar").length };
  }
  const t = document.querySelector("#detail-title"), tc = t?.parentElement.querySelector(":scope > .ff-rtx-title");
  const d = document.querySelector("#detail-desc"), dOrig = d?.querySelector(":scope > .note-text:not(.ff-own)"), dc = d?.querySelector(":scope > .ff-rtx-whole");
  const nn = t?.parentElement.querySelector(":scope > .ff-rtx-note");
  r.note = t ? { title: tc?.textContent || null, titleTag: tc?.tagName || null, titleCls: tc ? tc.classList.contains("title") : false, titleId: tc?.id || "", titleShown: shown(tc), titleOrig: shown(t),
    desc: dc ? dc.textContent.replace(/\s+/g, " ").trim() : null, descShown: shown(dc), descOrig: shown(dOrig), tags: dc ? [...dc.querySelectorAll("a.tag")].map((a) => a.textContent) : [],
    imgs: dc ? dc.querySelectorAll("img").length : 0, line: nn?.querySelector(".ff-tx-label")?.textContent || null, lineBeforeTitle: !!nn && nn.nextElementSibling === t } : null;
  r.cards = [...document.querySelectorAll("section.note-item")].map((card) => {
    const a = card.querySelector(".footer a.title"), o = a.querySelector(":scope > span:not(.ff-own)"), c = a.querySelector(":scope > .ff-rtx-title"), icon = a.querySelector(":scope > .ff-tx-inote");
    return { tx: c?.textContent || null, txShown: shown(c), origShown: shown(o), iconFirst: !!icon && a.firstElementChild === icon, tip: icon?.title || "" };
  });
  r.bars = document.querySelectorAll(".ff-bar").length;
  r.jev = (window.__ffJevAll || []).map((m) => ({ post: m.post, author: m.author, ids: m.replies.map((x) => x.id), texts: m.replies.map((x) => x.text), extra: m.extra || null }));
  r.txSrc = (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").map((m) => ({ id: m.id, source: m.source }));
  { const s = await new Promise((res) => { let done = false; for (const f of window.__ffOnMessage || []) f({ type: "pageSummary" }, {}, (s) => { if (!done) { done = true; res(s || {}); } }); setTimeout(() => { if (!done) res({}); }, 300); }); r.folded = (s.folded || []).map(([id, kind]) => ({ id, postId: s.key, kind, page: "status" })); } // 0.28.5：从弹窗那条查询里拿
  return r;
};

// 清理得多的页面（0.27）整条藏起来了：先点开最上面那一行，再点开合起来的串（两条就合）
const openAll = async (pg) => {
  await pg.evaluate(() => { const l = document.querySelector(".ff-fill-line"); if (l && /：/.test(l.textContent) && /查看/.test(l.textContent)) l.click(); }); // 清理得多（0.26）：先让一条条的清理条回来
  await new Promise((r) => setTimeout(r, 400));
  await pg.evaluate(() => document.querySelectorAll('.ff-group[aria-expanded="false"]').forEach((b) => b.click())); // 连着的一串（0.27 起两条就合）点开
  await new Promise((r) => setTimeout(r, 300));
};
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 1280, height: 2400 });

    // ① 笔记页
    await page.goto(`${BASE}/fakex/xhs/note.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(4000);
    await openAll(page);
    let s = await page.evaluate(state);
    ok("小红书笔记：标题换上译文（h1 浅克隆，留着 class、去掉 id）、正文带格式换（#话题、表情图片留着），标题上面一行说明",
      s.note.title === "【替身补翻】Autumn outfit ideas for rainy days" && s.note.titleTag === "H1" && s.note.titleCls && !s.note.titleId && s.note.titleShown && !s.note.titleOrig &&
      /^【替身补翻】Three looks I wear every week/.test(s.note.desc || "") && s.note.descShown && !s.note.descOrig && JSON.stringify(s.note.tags) === '["#ootd"]' && s.note.imgs === 1 &&
      s.note.line === "翻译自英语" && s.note.lineBeforeTitle, JSON.stringify(s.note));
    ok("小红书评论：英文、日文的原位置换，说明在作者那一行后面；中文的不翻", /^【替身补翻】This color looks amazing/.test(s.c["0001"].tx || "") && s.c["0001"].txShown && !s.c["0001"].origShown &&
      s.c["0001"].note === "翻译自英语" && s.c["0001"].noteShown && /^【替身补翻】この色/.test(s.c["0006"].tx || "") && s.c["0006"].note === "翻译自日语" &&
      !s.c["0005"].tx && s.c["0005"].origShown, JSON.stringify([s.c["0001"], s.c["0006"], s.c["0005"]]));
    const r11 = s.txSrc.find((m) => m.id === "xh_6f10000000000000000c0011");
    ok("小红书楼中楼：\"回复 Mia：\"不算正文、不发去翻，正文换上译文", /^【替身补翻】Same question/.test(s.c["0011"].tx || "") && !!r11 && !/回复|Mia/.test(r11.source), JSON.stringify([s.c["0011"], r11]));
    ok("小红书折叠：骂人的折，只藏正文；作者那一行、时间赞回复那一行留着", /辱骂/.test(s.c["0003"].bar || "") && s.c["0003"].hidden && s.c["0003"].headShown && s.c["0003"].infoShown,
      JSON.stringify(s.c["0003"]));
    ok("小红书折叠：引流的（?jev 0.9）折，评论配图一起藏；色情的楼中楼折", /拉人/.test(s.c["0004"].bar || "") && s.c["0004"].hidden && s.c["0004"].picHidden === true &&
      /色情/.test(s.c["0012"].bar || "") && s.c["0012"].hidden, JSON.stringify([s.c["0004"], s.c["0012"]]));
    const sent = s.jev.flatMap((m) => m.ids);
    ok("小红书：笔记作者自己的照样发给 Jev 判（0.21.3），这句没问题、不折；只有表情图片的不判；中文的、没问题的不折", !s.c["0002"].bar && !s.c["0002"].hidden && sent.includes("xh_6f10000000000000000c0002") &&
      !sent.includes("xh_6f10000000000000000c0007") && !s.c["0007"].bar && !s.c["0005"].bar && !s.c["0001"].bar, JSON.stringify({ sent, c2: s.c["0002"], c7: s.c["0007"] }));
    ok("小红书：只 @ 了朋友的（引流 0.9）不按垃圾折；三条\"原评论已删除\"不判、不当同帖复读，下面的回复照判",
      !s.c["0008"].bar && !s.c["0008"].hidden && sent.includes("xh_6f10000000000000000c0008") && ["0009", "000a", "000b"].every((k) => !s.c[k].bar && !sent.includes("xh_6f10000000000000000c" + k)) &&
      sent.includes("xh_6f10000000000000000c0019"), JSON.stringify({ c8: s.c["0008"], c9: s.c["0009"], sent }));
    ok("小红书：发给 Jev 的主帖是标题加正文、楼主是笔记作者，评论按原文发（不是译文），不多问 setup",
      s.jev.length > 0 && s.jev.every((m) => /^Autumn outfit ideas for rainy days\nThree looks I wear/.test(m.post) && m.author && m.author.name === "合成作者小蓝" && !m.extra) &&
      s.jev.flatMap((m) => m.texts).every((x) => !/替身/.test(x)), JSON.stringify(s.jev.map((m) => ({ post: m.post.slice(0, 50), author: m.author, extra: m.extra }))));
    ok("小红书：清理掉的 id、页面键后台认得", s.folded.length >= 3 && s.folded.every((e) => SITE_ID.test(e.id) && e.id.startsWith("xh_") && POST_ID.test(e.postId) && e.postId === "xh:n:6f00000000000000000a0001" && e.page === "status"),
      JSON.stringify(s.folded));
    let sum = await page.evaluate(summary);
    ok("小红书笔记：弹窗答得出这个笔记折了几条", sum && sum.site === "xhs" && sum.kind === "status" && sum.folds.spam === 1 && sum.folds.abuse === 1 && sum.folds.sexual === 1, JSON.stringify(sum));

    // ② 首页列表 → 点开浮层 → 关掉
    await page.goto(`${BASE}/fakex/xhs/explore.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(3000);
    s = await page.evaluate(state);
    ok("小红书首页：英文标题换上译文、最前面一个 ✦（鼠标停上去写着翻译自英语），中文的不翻", s.cards[0].tx === "【替身补翻】Autumn outfit ideas for rainy days" && s.cards[0].txShown && !s.cards[0].origShown &&
      s.cards[0].iconFirst && /^翻译自英语 · /.test(s.cards[0].tip) && !s.cards[1].tx && s.cards[1].origShown && s.cards[2].tx === "【替身补翻】Weekend hiking trip in the hills", JSON.stringify(s.cards));
    sum = await page.evaluate(summary);
    ok("小红书首页：弹窗答只翻标题、不折叠", sum && sum.site === "xhs" && sum.kind === "list" && !sum.folds, JSON.stringify(sum));
    await page.evaluate(() => window.__openNote());
    await wait(3500);
    s = await page.evaluate(state);
    sum = await page.evaluate(summary);
    ok("小红书浮层：网址变成笔记的，按笔记页判（骂人的、引流的、色情的折）和翻（标题、评论）", s.note && s.note.title === "【替身补翻】Autumn outfit ideas for rainy days" &&
      /辱骂/.test(s.c["0003"].bar || "") && /拉人/.test(s.c["0004"].bar || "") && /色情/.test(s.c["0012"].bar || "") && /^【替身补翻】This color/.test(s.c["0001"].tx || "") &&
      sum && sum.kind === "status" && sum.folds.spam === 1 && sum.folds.abuse === 1, JSON.stringify({ note: s.note && s.note.title, c3: s.c["0003"], sum }));
    await page.evaluate(() => window.__closeNote());
    await wait(1500);
    s = await page.evaluate(state);
    sum = await page.evaluate(summary);
    ok("小红书浮层关掉：回到列表，折叠条都撤掉，弹窗又答列表，卡片的译文还在", s.bars === 0 && sum && sum.kind === "list" && s.cards[0].txShown, JSON.stringify({ bars: s.bars, sum, card: s.cards[0] }));

    // ③ 搜索结果
    await page.goto(`${BASE}/fakex/xhs/search.html`, { waitUntil: "load" });
    await wait(3000);
    s = await page.evaluate(state);
    ok("小红书搜索结果：英文标题照样翻、中文的不翻", s.cards[0].tx === "【替身补翻】Autumn outfit ideas for rainy days" && !s.cards[1].tx && s.cards[2].txShown, JSON.stringify(s.cards));
  } finally {
    await browser.close();
  }
  console.log(out.join("\n"));
  const fails = out.filter((l) => !l.startsWith("PASS")).length;
  console.log(fails ? `${fails} 项没过` : `全过（${out.length} 项）`);
  process.exit(fails ? 1 : 0);
})();
