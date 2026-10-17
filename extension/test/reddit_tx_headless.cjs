// Reddit 上的翻译（不调任何接口；替身把"补翻"回成"【替身补翻】"加原文）：仿新版 Reddit 的页面（test/fakex/reddit/，界面是中文，
// <shreddit-post> 和真的一样有 shadow DOM、只有带名字的 slot：放进去的东西不带 slot 就不显示）。都是原位置换、上面一行说明：
// ① 英文帖子页 post_en.html：主帖标题原位置换（克隆的标题在 title 这个 slot 里显示、原来的藏起来，说明在标题上面），正文在正文那一格里换，
//    标题和正文分开翻；英文、日文、西班牙文评论原位置换（说明里的语言按浏览器认的，不照帖子标的），中文的不翻；被折叠的评论译文跟着藏；"看原文"切回（主帖标题、正文一起）；
//    换成译文以后再扫一遍，发给 Jev 的还是原文（不能把译文和说明当原文再判一次）；弹窗问"这个页面"报得出翻了几条。
// ② 帖子列表 feed_en.html：英文、日文标题和正文摘要原位置换（摘要很长时只翻够 4 行的——拉丁字母前 360 字左右、中日韩 160 字——告诉后台截断了，显示最多 4 行），
//    中文的、广告不翻；换上的标题还是那个链接；卡片上盖着透明链接，
//    "看原文"按钮点得到、说明那一行的字点下去还是进帖子。③ 搜索结果 search_en.html：英文标题原位置换，中文的不翻；
//    带正文摘要的那种（没有 data-thingid，0.13.12 以前不认）标题、摘要都原位置换，只有摘要是外文时说明放在摘要上面。
//    ③b "媒体"那一栏 search_media.html（瀑布流，载入时量一次高度）：英文标题原位置换，说明挤在版块那一行右边，格子不变高、不压住下面那格。
// ④ 很长的帖子 post_long.html：正文、长评论切块翻（第 0 块 ≤300 字、别的 ≤800 字、拼起来就是原文、同时最多 8 条），
//    第一块先换上、别的照原文淡着，说明写"翻译中…"，一块块换完；块和块之间照原来的分隔。
// ⑤ 带格式的 post_fmt.html：链接（网址本身的、带字的）、加粗、列表、代码、u/账号、引用、斜体照原来的元素拼回去；模型把标记弄丢时
//    换后备模型再翻一次，还丢就退回纯文字、网址照样留着；克隆里没有重复的 id。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/reddit_tx_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const summary = () => new Promise((res) => { let done = false; for (const f of window.__ffOnMessage || []) f({ type: "pageSummary" }, {}, (r) => { if (!done) { done = true; res(r); } }); setTimeout(() => res(null), 300); });
// 一个标题（帖子、卡片、搜索结果）现在什么样：克隆的译文、原来的、说明各自显示没有
const titleState = (orig) => {
  const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
  const clone = orig.nextElementSibling?.classList.contains("ff-rtx-title") ? orig.nextElementSibling : null;
  const note = orig.previousElementSibling?.classList.contains("ff-rtx-note") ? orig.previousElementSibling : null;
  return { tx: clone?.textContent || null, txShown: shown(clone), txSlot: clone?.assignedSlot?.name || null,
    txTag: clone?.tagName || null, txId: clone?.id || null, txHref: clone?.getAttribute("href") || null, origShown: shown(orig), origHref: orig.getAttribute("href"),
    note: note?.querySelector(".ff-tx-label")?.textContent || null, noteShown: shown(note), noteSlot: note ? note.assignedSlot?.name || null : null };
};

// 一格内容（评论正文、主帖正文）现在什么样：带格式翻的是克隆（.ff-rtx-clone），纯文字翻的是一块 .ff-rtx / .ff-rtx-body
const boxState = (box) => {
  const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
  const kids = [...box.children], clones = kids.filter((k) => k.classList.contains("ff-rtx-clone"));
  const plain = kids.find((k) => k.classList.contains("ff-rtx") || k.classList.contains("ff-rtx-body"));
  const orig = kids.find((k) => !k.classList.contains("ff-own") && !k.classList.contains("ff-bar"));
  const note = box.querySelector(":scope > .ff-rtx-bnote") || plain?.querySelector(".ff-tx-note");
  const norm = (x) => (x || "").replace(/\s+/g, " ").trim();
  const txEl = clones.length ? clones : plain ? [plain.querySelector(".ff-tx-text")] : [];
  const pend = clones.flatMap((c) => [...c.querySelectorAll(".ff-rtx-pending")]);
  return { tx: txEl.length ? norm(txEl.map((e) => e.textContent).join(" ")) || null : null, txShown: txEl.some(shown), rich: clones.length > 0,
    label: note?.querySelector(".ff-tx-label")?.textContent || null, busy: note?.querySelector(".ff-tx-busy")?.textContent || null, noteFirst: !!note && kids[0] === note,
    origShown: shown(orig), wrapCls: (clones[0] || plain)?.className || "", hasMd: !!(clones[0] || plain)?.querySelector(".md"), paras: clones.reduce((n, c) => n + c.querySelectorAll("p").length, 0),
    pending: pend.length, pendingOpacity: pend[0] ? getComputedStyle(pend[0]).opacity : null };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 900, height: 1600 });

    // ① 帖子页
    await page.goto(`${BASE}/fakex/reddit/post_en.html`, { waitUntil: "load" });
    await wait(4500);
    const st = () => page.evaluate((ts, bs) => {
      const titleState = eval(ts), boxState = eval(bs);
      const r = {};
      for (const c of document.querySelectorAll("shreddit-comment")) {
        const body = [...c.querySelectorAll('[slot="comment"]')].find((e) => e.closest("shreddit-comment") === c);
        r[c.getAttribute("thingid")] = { ...boxState(body), folded: !!body.previousElementSibling?.classList.contains("ff-bar") };
      }
      const p = document.querySelector("shreddit-post"), h1 = p.querySelector(':scope > h1[slot="title"]:not(.ff-own)');
      return { comments: r, title: titleState(h1), body: boxState(p.querySelector('shreddit-post-text-body > [slot="text-body"]')),
        after: !!(p.nextElementSibling && /ff-/.test(p.nextElementSibling.className)) };
    }, `(${titleState})`, `(${boxState})`);
    let s = await st();
    ok("主帖标题原位置换：克隆的 h1 在 title 这个 slot 里显示，原来的藏起来，不带重复的 id",
      s.title.tx === "【替身补翻】How do you keep your notes organized?" && s.title.txShown && s.title.txSlot === "title" && s.title.txTag === "H1" && !s.title.txId && !s.title.origShown,
      JSON.stringify(s.title));
    ok("说明在标题上面（也在 title 这个 slot 里），写着\"翻译自英语\"（不带\"插件\"）", s.title.noteShown && s.title.noteSlot === "title" && s.title.note === "翻译自英语", JSON.stringify(s.title));
    ok("主帖正文在正文那一格里原位置换（克隆原来那一层，Reddit 的边距、字号 class 都在），原来的藏起来；说明只在标题上面一份；帖子下面不再多一块",
      s.body.tx === "【替身补翻】I keep losing track of things. Any tips?" && s.body.txShown && s.body.rich && !s.body.origShown && !s.body.label &&
      /\bmb-xs\b/.test(s.body.wrapCls) && s.body.hasMd && !s.after, JSON.stringify([s.body, s.after]));
    ok("英文评论原位置换成译文，原文藏起来", /^【替身补翻】This is the best/.test(s.comments.t1_e1.tx || "") && s.comments.t1_e1.txShown && !s.comments.t1_e1.origShown &&
      /^【替身补翻】Does anyone/.test(s.comments.t1_e3.tx || ""), JSON.stringify([s.comments.t1_e1, s.comments.t1_e3]));
    ok("评论的说明写着\"翻译自英语\"（照帖子标的语言），是正文那一格的第一行", s.comments.t1_e1.label === "翻译自英语" && s.comments.t1_e1.noteFirst && s.comments.t1_e1.rich,
      JSON.stringify(s.comments.t1_e1));
    ok("西班牙文评论：说明写西班牙语（浏览器认得准就不照帖子标的英文）", /^【替身补翻】¿Alguien/.test(s.comments.t1_e6.tx || "") && /西班牙语/.test(s.comments.t1_e6.label || ""),
      JSON.stringify(s.comments.t1_e6));
    ok("中文评论不翻；日文的翻（有假名就不是中文）", !s.comments.t1_e2.tx && s.comments.t1_e2.origShown && /^【替身补翻】これは/.test(s.comments.t1_e5.tx || "") && /日语/.test(s.comments.t1_e5.label || ""),
      JSON.stringify([s.comments.t1_e2, s.comments.t1_e5]));
    ok("被折叠的评论（骂人）：译文跟着藏起来", s.comments.t1_e4.folded && !s.comments.t1_e4.txShown && !s.comments.t1_e4.origShown, JSON.stringify(s.comments.t1_e4));
    let msgs = await page.evaluate(() => (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").map((m) => [m.id, m.srcLang, m.target, m.source]));
    const postMsgs = msgs.filter((x) => x[0] === "t3_def456").map((x) => x[3].replace(/<\/?p\d+>/g, "")).sort();
    ok("主帖的标题和正文分开翻（各一次、原文各是各的）", JSON.stringify(postMsgs) === JSON.stringify(["How do you keep your notes organized?", "I keep losing track of things. Any tips?"].sort()),
      JSON.stringify(postMsgs));
    ok("请求：英文、日文、西班牙文评论都翻，中文的不发；原文语言帖子是 en、日文 ja、西班牙文 es", JSON.stringify([...new Set(msgs.map((x) => x[0]))].sort()) === JSON.stringify(["t1_e1", "t1_e3", "t1_e4", "t1_e5", "t1_e6", "t3_def456"]) &&
      msgs.find((x) => x[0] === "t1_e5")[1] === "ja" && msgs.find((x) => x[0] === "t1_e1")[1] === "en" && msgs.find((x) => x[0] === "t1_e6")[1] === "es" && msgs.every((x) => x[2] === "zh-CN"),
      JSON.stringify(msgs.map((x) => x.slice(0, 3))));
    // 换成译文以后页面再变一次（Reddit 加载更多评论之类）：reddit.js 重扫，发给 Jev 的必须还是原文
    await page.evaluate(() => { const d = document.createElement("div"); d.textContent = "加载了更多"; document.querySelector("shreddit-comment-tree").append(d); });
    await wait(1500);
    const jev = await page.evaluate(() => (window.__ffJevAll || []).flatMap((m) => m.replies.map((x) => x.text)).concat((window.__ffJevAll || []).map((m) => m.post || "")));
    ok("换成译文以后重扫：发给 Jev 的还是原文，没有译文和说明", jev.length > 0 && !jev.some((x) => /【替身补翻】|翻译自|看原文/.test(x)), JSON.stringify(jev));
    // 看原文：主帖标题、正文一起切回
    await page.evaluate(() => document.querySelector("shreddit-post > .ff-rtx-note .ff-tx-toggle").click());
    await wait(200);
    s = await st();
    ok("主帖点\"看原文\"：标题、正文都露出原文，说明变成原文（英语）· 看翻译", s.title.origShown && !s.title.txShown && !s.body.txShown && s.body.origShown && /原文（英语）/.test(s.title.note || "") && s.title.noteShown,
      JSON.stringify([s.title, s.body]));
    await page.evaluate(() => document.querySelector("shreddit-post > .ff-rtx-note .ff-tx-toggle").click());
    await wait(200);
    s = await st();
    ok("再点\"看翻译\"：换回译文", s.title.txShown && !s.title.origShown && s.body.txShown && !s.body.origShown, JSON.stringify([s.title, s.body]));
    await page.evaluate(() => [...document.querySelectorAll("shreddit-comment")].find((c) => c.getAttribute("thingid") === "t1_e1").querySelector(".ff-rtx-bnote .ff-tx-toggle, .ff-rtx .ff-tx-toggle").click());
    await wait(200);
    s = await st();
    ok("评论点\"看原文\"：露出原文，说明变成原文（英语）· 看翻译", s.comments.t1_e1.origShown && !s.comments.t1_e1.txShown && /原文（英语）/.test(s.comments.t1_e1.label || ""), JSON.stringify(s.comments.t1_e1));
    // Reddit 把标题元素换成新的（重新渲染）：译文跟到新标题旁边，不多出一份
    await page.evaluate(() => { const p = document.querySelector("shreddit-post"), h = p.querySelector(':scope > h1[slot="title"]:not(.ff-own)'), nh = h.cloneNode(true);
      nh.removeAttribute("style"); delete nh.dataset.ffTxHidden; p.querySelector(":scope > .ff-rtx-title").after(nh); h.remove(); });
    await wait(900);
    const re = await page.evaluate(() => { const p = document.querySelector("shreddit-post"); return { clones: p.querySelectorAll(":scope > .ff-rtx-title").length, notes: p.querySelectorAll(":scope > .ff-rtx-note").length,
      origShown: getComputedStyle(p.querySelector(':scope > h1[slot="title"]:not(.ff-own)')).display !== "none" }; });
    ok("标题元素被 Reddit 换掉：译文跟到新标题旁边，只有一份克隆、一份说明", re.clones === 1 && re.notes === 1 && !re.origShown, JSON.stringify(re));
    let sum = await page.evaluate(summary);
    ok("弹窗问这个页面：翻了几条（主帖算一条）", sum && sum.tx && sum.tx.filled === 6, JSON.stringify(sum));

    // ② 帖子列表
    await page.goto(`${BASE}/fakex/reddit/feed_en.html`, { waitUntil: "load" });
    await wait(3500);
    const feed = () => page.evaluate((ts) => {
      const titleState = eval(ts);
      const pv = (p) => {
        const box = p.querySelector('shreddit-post-text-body > [slot="text-body"]');
        if (!box) return null;
        const b = box.querySelector(":scope > .ff-rtx-preview"), t = b?.querySelector(".ff-tx-text"), orig = [...box.children].find((k) => !k.classList.contains("ff-own"));
        return { tx: t?.textContent || null, txShown: !!t && !t.hidden && getComputedStyle(b).display !== "none" && t.getClientRects().length > 0, clamp: t ? getComputedStyle(t).webkitLineClamp : null,
          origShown: !!orig && getComputedStyle(orig).display !== "none", notes: p.querySelectorAll(".ff-tx-note").length };
      };
      return Object.fromEntries([...document.querySelectorAll("shreddit-feed shreddit-post")].map((p) => [p.id, { ...titleState(p.querySelector(':scope > a[slot="title"]:not(.ff-own)')), pv: pv(p) }]));
    }, `(${titleState})`);
    let f = await feed();
    ok("帖子列表：英文标题原位置换（克隆的还是那个链接、在 title 这个 slot 里），原来的藏起来",
      f.t3_g1.tx === "【替身补翻】Best budget mechanical keyboard this year?" && f.t3_g1.txShown && f.t3_g1.txSlot === "title" && f.t3_g1.txTag === "A" &&
      f.t3_g1.txHref === f.t3_g1.origHref && !f.t3_g1.txId && !f.t3_g1.origShown && f.t3_g1.noteShown && f.t3_g1.note === "翻译自英语", JSON.stringify(f.t3_g1));
    ok("帖子列表：日文标题也翻，中文的不翻", /^【替身补翻】これは/.test(f.t3_g3.tx || "") && /日语/.test(f.t3_g3.note || "") && !f.t3_g2.tx && f.t3_g2.origShown && !f.t3_g2.note,
      JSON.stringify([f.t3_g3, f.t3_g2]));
    ok("帖子列表：正文摘要在摘要那一格里原位置换、行数跟 Reddit 自己的（宽屏 6 行），原来的藏起来；说明只在标题上面一份",
      /^【替身补翻】I have been comparing/.test(f.t3_g1.pv?.tx || "") && f.t3_g1.pv.txShown && !f.t3_g1.pv.origShown && f.t3_g1.pv.clamp === "6" && f.t3_g1.pv.notes === 1 &&
      /^【替身补翻】短い/.test(f.t3_g3.pv?.tx || "") && !f.t3_g2.pv?.tx && f.t3_g2.pv?.origShown, JSON.stringify([f.t3_g1.pv, f.t3_g3.pv, f.t3_g2.pv]));
    msgs = await page.evaluate(() => (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").map((m) => [m.id, m.source, m.truncated]));
    ok("帖子列表：只发英文、日文的（标题、摘要各一次），中文的、广告帖不翻", JSON.stringify([...new Set(msgs.map((x) => x[0]))].sort()) === JSON.stringify(["t3_g1", "t3_g3"]) &&
      msgs.length === 4 && !msgs.some((x) => /Buy this|中文的摘要/.test(x[1])), JSON.stringify(msgs.map((x) => [x[0], x[1].slice(0, 30), x[2]])));
    const longPv = msgs.find((x) => x[0] === "t3_g1" && /^I have been/.test(x[1])), shortPv = msgs.find((x) => x[0] === "t3_g3" && /^短い/.test(x[1]));
    ok("很长的摘要只翻够 6 行的（拉丁字母前 500 字左右）、在句子边上截、告诉后台截断了；短的整段翻", !!longPv && longPv[1].length <= 500 && longPv[1].length > 300 && longPv[2] === true &&
      /[.?!]$/.test(longPv[1]) && !!shortPv && shortPv[2] === false, JSON.stringify([longPv && [longPv[1].length, longPv[1].slice(-20), longPv[2]], shortPv && shortPv[2]]));
    // 卡片上盖着透明链接：按钮点得到；说明那一行的字、换上的标题点下去都是进这个帖子
    const hits = await page.evaluate(() => {
      const p = document.getElementById("t3_g1"), n = p.querySelector(":scope > .ff-rtx-note"), b = n.querySelector(".ff-tx-toggle"), lab = n.querySelector(".ff-tx-label"), tt = p.querySelector(":scope > .ff-rtx-title");
      const at = (e) => { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { tag: h?.tagName, own: h === e || e.contains(h), href: h?.closest("a")?.getAttribute("href") || null }; };
      return { btn: at(b), label: at(lab), title: at(tt), href: p.querySelector(':scope > a[slot="title"]').getAttribute("href") };
    });
    ok("卡片上的\"看原文\"按钮点得到（浮在透明链接上面）", hits.btn.own, JSON.stringify(hits));
    ok("说明那一行的字、换上的标题点下去都进这个帖子", !hits.label.own && hits.label.href === hits.href && hits.title.href === hits.href, JSON.stringify(hits));
    await page.evaluate(() => document.querySelector("#t3_g1 > .ff-rtx-note .ff-tx-toggle").click());
    await wait(200);
    f = await feed();
    ok("帖子列表点\"看原文\"：原来的标题、摘要露出来，说明变成原文（英语）", f.t3_g1.origShown && !f.t3_g1.txShown && /原文（英语）/.test(f.t3_g1.note || "") &&
      f.t3_g1.pv.origShown && !f.t3_g1.pv.txShown, JSON.stringify(f.t3_g1));
    sum = await page.evaluate(summary);
    ok("弹窗问这个页面：帖子列表翻了 2 条", sum && sum.kind === "feed" && sum.tx && sum.tx.filled === 2, JSON.stringify(sum));

    // ③ 搜索结果
    await page.goto(`${BASE}/fakex/reddit/search_en.html`, { waitUntil: "load" });
    await wait(3500);
    const ss = await page.evaluate((ts) => {
      const titleState = eval(ts);
      return Object.fromEntries([...document.querySelectorAll("search-telemetry-tracker[data-thingid]")].map((u) => [u.dataset.thingid, titleState(u.querySelector('a[data-testid="post-title-text"]'))]));
    }, `(${titleState})`);
    const lay = await page.evaluate(() => {
      const u = document.querySelector('search-telemetry-tracker[data-thingid="t3_k1"]'), col = u.querySelector('[data-testid="sdui-post-unit"]');
      const ov = u.querySelector('a[data-testid="post-title"]'), note = u.querySelector(".ff-rtx-note"), clone = u.querySelector(".ff-rtx-title");
      const at = (e) => { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { own: h === e || e.contains(h), href: h?.closest("a")?.getAttribute("href") || null }; };
      return { noteInCol: !!note && col.contains(note), cloneInCol: !!clone && col.contains(clone), overlayShown: getComputedStyle(ov).display !== "none" && !ov.dataset.ffTxHidden,
        dl: [note, clone].map((e) => e ? Math.round(e.getBoundingClientRect().left - col.getBoundingClientRect().left) : null), noteH: note ? Math.round(note.getBoundingClientRect().height) : 0,
        btn: note ? at(note.querySelector(".ff-tx-toggle")) : null, label: note ? at(note.querySelector(".ff-tx-label")) : null, href: ov.getAttribute("href") };
    });
    ok("搜索结果：说明和换上的标题在中间那一格里、和标题左边对齐，说明一行放得下（不被挤窄折行）；盖住整条的透明链接不动",
      lay.noteInCol && lay.cloneInCol && lay.overlayShown && lay.dl.every((x) => x === 0) && lay.noteH > 0 && lay.noteH < 24, JSON.stringify(lay)); // 挤窄了会折成几行
    ok("搜索结果：\"看原文\"按钮点得到，说明那一行的字点下去进帖子", lay.btn?.own && !lay.label?.own && lay.label?.href === lay.href, JSON.stringify(lay));
    ok("搜索结果：英文标题原位置换、上面一行说明，中文的不翻",
      ss.t3_k1.tx === "【替身补翻】Which keyboard switches are the quietest?" && ss.t3_k1.txShown && !ss.t3_k1.origShown && ss.t3_k1.txHref === ss.t3_k1.origHref &&
      ss.t3_k1.noteShown && ss.t3_k1.note === "翻译自英语" && !ss.t3_k2.tx && ss.t3_k2.origShown, JSON.stringify(ss));
    // 带正文摘要的那种：最外层没有 data-thingid（id 从链接里取）；c1 标题、摘要都翻，c2 只翻摘要（摘要外面多一层，克隆也带上这一层），c3 只翻标题
    const PV = await page.evaluate((ts) => {
      const titleState = eval(ts), r = {};
      const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
      for (const id of ["c1", "c2", "c3"]) {
        const t = document.getElementById(`search-post-title-t3_${id}`), u = t.closest('[data-testid="search-post-with-content-preview"]');
        const pv = u.querySelector(".line-clamp-2:not(.ff-own)"), clone = pv.nextElementSibling?.classList.contains("ff-rtx-snip") ? pv.nextElementSibling : null;
        r[id] = { title: titleState(t), pv: clone ? clone.textContent : null, pvShown: shown(clone), pvOrigShown: shown(pv), pvCls: clone?.className || "", pvInner: clone?.firstElementChild?.tagName || null,
          noteBeforePv: !!pv.previousElementSibling?.classList.contains("ff-rtx-note") && shown(pv.previousElementSibling), notes: u.querySelectorAll(".ff-rtx-note").length };
      }
      return r;
    }, `(${titleState})`);
    ok("带摘要的搜索结果（没有 data-thingid）：标题、摘要都原位置换，说明在标题上面一份",
      PV.c1.title.tx === "【替身补翻】My first custom keyboard build" && PV.c1.title.txShown && !PV.c1.title.origShown && PV.c1.title.noteShown &&
      PV.c1.pv === "【替身补翻】It took three weekends, but the sound is exactly what I wanted." && PV.c1.pvShown && !PV.c1.pvOrigShown && /line-clamp-2/.test(PV.c1.pvCls) && PV.c1.notes === 1,
      JSON.stringify(PV.c1));
    ok("带摘要的：中文标题、英文摘要只翻摘要，说明放在摘要上面；摘要外面那一层克隆也带上",
      !PV.c2.title.tx && PV.c2.title.origShown && /^【替身补翻】Lubing/.test(PV.c2.pv || "") && PV.c2.pvShown && PV.c2.pvInner === "P" && PV.c2.noteBeforePv && PV.c2.notes === 1, JSON.stringify(PV.c2));
    ok("带摘要的：英文标题、中文摘要只翻标题", PV.c3.title.tx === "【替身补翻】Is this keyboard worth the price?" && !PV.c3.pv && PV.c3.pvOrigShown, JSON.stringify(PV.c3));
    sum = await page.evaluate(summary);
    ok("弹窗问这个页面：搜索结果翻了 4 条（带摘要的也算）", sum && sum.kind === "search" && sum.tx && sum.tx.filled === 4, JSON.stringify(sum));

    // ③b "媒体"那一栏
    await page.goto(`${BASE}/fakex/reddit/search_media.html`, { waitUntil: "load" });
    await wait(3000);
    const media = () => page.evaluate(() => {
      const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
      const cells = [...document.querySelectorAll("search-media-feed > search-telemetry-tracker")], rs = cells.map((c) => c.getBoundingClientRect());
      let overlaps = 0;
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (Math.min(rs[i].right, rs[j].right) - Math.max(rs[i].left, rs[j].left) > 1 && Math.min(rs[i].bottom, rs[j].bottom) - Math.max(rs[i].top, rs[j].top) > 1) overlaps++;
      const r = { overlaps, overflow: cells.map((c) => Math.round(c.firstElementChild.getBoundingClientRect().bottom - c.getBoundingClientRect().bottom)) };
      for (const c of cells) {
        const id = c.firstElementChild.dataset.id, t = c.querySelector("a.line-clamp-2:not(.ff-own)"), clone = t.nextElementSibling?.classList.contains("ff-rtx-title") ? t.nextElementSibling : null;
        const row = c.querySelector("faceplate-hovercard").parentElement, n = row.querySelector(".ff-rtx-note"), sub = row.querySelector("faceplate-hovercard a");
        const nb = n?.getBoundingClientRect(), sb = sub.getBoundingClientRect(), lab = n?.querySelector(".ff-tx-label"), btn = n?.querySelector(".ff-tx-toggle");
        const hit = btn && (() => { const b = btn.getBoundingClientRect(), h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return h === btn || btn.contains(h); })();
        r[id] = { tx: clone?.textContent || null, txShown: shown(clone), origShown: shown(t), href: clone?.getAttribute("href") === t.getAttribute("href"),
          txH: clone ? Math.round(clone.getBoundingClientRect().height) : null, note: !!n, inRow: !!n && n.parentElement === row && row.classList.contains("ff-rtx-mrow"),
          sameLine: !!n && nb.top >= sb.top - 2 && nb.bottom <= sb.bottom + 2, labelHidden: !!lab && lab.getBoundingClientRect().width <= 1 && lab.textContent.length > 0,
          label: lab?.textContent || null, btn: btn?.textContent || null, tip: n?.title || "", hit };
      }
      return r;
    });
    let M = await media();
    ok("媒体那一栏：英文标题原位置换（还是那个链接），中文的不翻",
      ["t3_w1", "t3_w2", "t3_w5", "t3_w6"].every((id) => /^【替身补翻】/.test(M[id].tx || "") && M[id].txShown && !M[id].origShown && M[id].href) && !M.t3_w3.tx && M.t3_w3.origShown && !M.t3_w3.note,
      JSON.stringify(M));
    ok("媒体那一栏：说明挤在版块那一行的右边（同一行），只露\"看原文\"，\"翻译自英语\"留给读屏和鼠标提示；按钮点得到",
      ["t3_w1", "t3_w2"].every((id) => M[id].inRow && M[id].sameLine && M[id].labelHidden && M[id].label === "翻译自英语" && M[id].btn === "看原文" && /翻译自英语/.test(M[id].tip) && M[id].hit),
      JSON.stringify([M.t3_w1, M.t3_w2]));
    ok("媒体那一栏：换上译文以后格子不变高（Reddit 只量了一次高度）、不压住下面那格；原来两行的长标题译文更长也只占两行",
      M.overlaps === 0 && M.overflow.every((x) => x <= 1) && M.t3_w2.txH <= 41, JSON.stringify({ overlaps: M.overlaps, overflow: M.overflow, w2: M.t3_w2.txH }));
    await page.evaluate(() => document.querySelector('[data-id="t3_w1"] .ff-rtx-note .ff-tx-toggle').click());
    await wait(200);
    M = await media();
    ok("媒体那一栏点\"看原文\"：原来的标题露出来，按钮变成\"看翻译\"，别的格子不变", M.t3_w1.origShown && !M.t3_w1.txShown && M.t3_w1.btn === "看翻译" && /原文（英语）/.test(M.t3_w1.tip) &&
      M.t3_w2.txShown && M.overlaps === 0, JSON.stringify([M.t3_w1, M.overlaps]));
    sum = await page.evaluate(summary);
    ok("弹窗问这个页面：媒体那一栏翻了 4 条", sum && sum.kind === "search" && sum.tx && sum.tx.filled === 4, JSON.stringify(sum));

    // ④ 很长的帖子（post_long.html）：正文、长评论按段切块翻，第一块先换上、别的段照原文淡着，说明写"翻译中…"，一块块换完
    await page.evaluateOnNewDocument(() => { window.__ffTxDelay = (m) => (m.part ? 1200 : 150); }); // 第 0 块（和没切的）快，后面的慢
    await page.goto(`${BASE}/fakex/reddit/post_long.html`, { waitUntil: "load" });
    const longState = () => page.evaluate((bs) => {
      const boxState = eval(bs), p = document.querySelector("shreddit-post");
      const c = [...document.querySelectorAll("shreddit-comment")].find((x) => x.getAttribute("thingid") === "t1_l1");
      const b = boxState(p.querySelector('shreddit-post-text-body > [slot="text-body"]')), note = p.querySelector(":scope > .ff-rtx-note");
      const cb = boxState([...c.querySelectorAll('[slot="comment"]')].find((e) => e.closest("shreddit-comment") === c));
      return { text: b.rich && b.txShown ? b.tx : null, pending: b.pending, pendingOpacity: b.pendingOpacity, paras: b.paras,
        busy: note?.querySelector(".ff-tx-busy")?.textContent || null, label: note?.querySelector(".ff-tx-label")?.textContent || null, cText: cb.tx, cPending: cb.pending, cBusy: cb.busy };
    }, `(${boxState})`);
    let L = null;
    for (let i = 0; i < 40 && !(L && L.text); i++) { await wait(50); L = await longState(); }
    const first = L;
    ok("长正文：第一块先换上，后面几段照原文、淡一点；标题上面的说明写着\"翻译中…\"",
      /^【替身补翻】I have been running/.test(first.text || "") && first.pending >= 3 && Number(first.pendingOpacity) < 1 && first.busy === "翻译中…" && first.label === "翻译自英语",
      JSON.stringify(first).slice(0, 600));
    for (let i = 0; i < 80 && !(L.pending === 0 && L.cPending === 0 && !L.busy && !L.cBusy); i++) { await wait(100); L = await longState(); }
    ok("长正文：一块块换完，不再有原文、说明不再写\"翻译中…\"；8 段还是 8 段，每段都换了", L.pending === 0 && !L.busy && L.paras === 8 && (L.text.match(/【替身补翻】/g) || []).length === 8,
      JSON.stringify(L).slice(0, 600));
    ok("长评论（3 段）也切块翻，翻完换上、说明不再写\"翻译中…\"", (L.cText.match(/【替身补翻】/g) || []).length === 3 && L.cPending === 0 && !L.cBusy, JSON.stringify([L.cText && L.cText.slice(0, 120), L.cPending, L.cBusy]));
    const lm = await page.evaluate(() => ({ msgs: (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").map((m) => ({ id: m.id, part: m.part, src: m.source, markup: !!m.markup })),
      maxLive: window.__ffTxMaxLive, title: document.querySelector("shreddit-post").getAttribute("post-title"), body: FFRD.postBody(document.querySelector("shreddit-post")) }));
    const plainLen = (x) => x.replace(/<\/?[ptx]\d+\/?>/g, "").length;
    const bodyParts = lm.msgs.filter((m) => m.id === "t3_lng789" && m.part != null).sort((a, b) => a.part - b.part);
    ok("请求：正文按段切成 4 块（第 0 块 ≤300 字，别的 ≤800 字、一段比这长的单独一块），带标记，拼起来就是原文；标题一次翻、不带块号、不带标记",
      JSON.stringify(bodyParts.map((m) => m.part)) === "[0,1,2,3]" && plainLen(bodyParts[0].src) <= 300 && bodyParts.every((m) => plainLen(m.src) <= 800 || (m.src.match(/<p\d+>/g) || []).length === 1) &&
      bodyParts.every((m) => m.markup) && bodyParts.map((m) => m.src.replace(/<\/?p\d+>/g, "")).join("").replace(/\s+/g, "") === lm.body.replace(/\s+/g, "") &&
      lm.msgs.some((m) => m.id === "t3_lng789" && m.part == null && m.src === lm.title && !m.markup), JSON.stringify(lm.msgs.map((m) => [m.id, m.part, plainLen(m.src)])));
    const l1 = lm.msgs.filter((m) => m.id === "t1_l1");
    ok("长评论切成 2 块（第一段一块，后两段一块）", l1.length === 2 && JSON.stringify(l1.map((m) => m.part).sort()) === "[0,1]", JSON.stringify(l1.map((m) => [m.part, plainLen(m.src)])));
    ok("同时在翻的最多 16 个请求（0.19.4 起；以前 8 个、0.13.13 以前 4 个）", lm.maxLive > 4 && lm.maxLive <= 16, String(lm.maxLive));
    sum = await page.evaluate(summary);
    ok("弹窗问这个页面：长帖子算一条（主帖 + 两条评论 = 3）", sum && sum.tx && sum.tx.filled === 3, JSON.stringify(sum));

    // ⑤ 带格式的评论、正文（post_fmt.html）：链接、加粗、列表、代码、u/账号、引用、斜体都留着；m5 让替身把标记弄丢：换后备模型再翻一次，
    //    还丢就退回纯文字，但网址一个不丢
    await page.evaluateOnNewDocument(() => { window.__ffTxPlan = { "fill:t1_m5": { action: "fill", text: "<p1>先读常见问题，细节在这里</p1>", model: "stub/model", cost: 0 } }; });
    await page.goto(`${BASE}/fakex/reddit/post_fmt.html`, { waitUntil: "load" });
    await wait(2500);
    const F = await page.evaluate(() => {
      const box = (id) => { const c = [...document.querySelectorAll("shreddit-comment")].find((x) => x.getAttribute("thingid") === id);
        return [...c.querySelectorAll('[slot="comment"]')].find((e) => e.closest("shreddit-comment") === c); };
      const clone = (b) => [...b.children].filter((k) => k.classList.contains("ff-rtx-clone"));
      const q = (b, sel) => clone(b).flatMap((c) => [...c.querySelectorAll(sel)]);
      const txt = (b) => clone(b).map((c) => c.textContent).join(" ").replace(/\s+/g, " ").trim();
      const r = {};
      for (const id of ["t1_m1", "t1_m2", "t1_m3", "t1_m4", "t1_m5"]) {
        const b = box(id);
        r[id] = { text: txt(b), links: q(b, "a").map((a) => [a.getAttribute("href"), a.textContent.trim(), a.className]), strong: q(b, "strong").map((x) => x.textContent),
          li: q(b, "ul > li").length, code: q(b, "code").map((x) => x.textContent), em: q(b, "blockquote em").length, ids: clone(b).reduce((n, c) => n + c.querySelectorAll("[id]").length + (c.id ? 1 : 0), 0),
          noteFirst: b.firstElementChild?.classList.contains("ff-rtx-bnote"), label: b.querySelector(":scope > .ff-rtx-bnote .ff-tx-label")?.textContent };
      }
      const pb = document.querySelector('shreddit-post-text-body > [slot="text-body"]');
      r.post = { links: q(pb, "a").map((a) => a.getAttribute("href")), strong: q(pb, "strong").map((x) => x.textContent), text: txt(pb) };
      r.msgs = (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").map((m) => [m.id, !!m.markup, !!m.alt]);
      return r;
    });
    ok("网址本身的链接（用户截图那条）：译文里还是那个链接，地址、样式都在", /^【替身补翻】Source with more info/.test(F.t1_m1.text) &&
      JSON.stringify(F.t1_m1.links) === JSON.stringify([["https://x.com/TheEVuniverse/status/2108212821150613801", "https://x.com/TheEVuniverse/status/2108212821150613801", "link"]]), JSON.stringify(F.t1_m1));
    ok("带字的链接、加粗：照原来的元素拼回去（链接指向原来的地址）", JSON.stringify(F.t1_m2.links) === JSON.stringify([["https://example.com/article", "this article", "link"]]) &&
      JSON.stringify(F.t1_m2.strong) === JSON.stringify(["battery chemistry"]), JSON.stringify(F.t1_m2));
    ok("列表、行内代码、u/账号链接：列表还是两项，代码、账号原样", F.t1_m3.li === 2 && JSON.stringify(F.t1_m3.code) === JSON.stringify(["htop"]) &&
      F.t1_m3.links.some(([h, t]) => h === "/user/someone/" && t === "u/someone") && (F.t1_m3.text.match(/【替身补翻】/g) || []).length === 3, JSON.stringify(F.t1_m3));
    ok("引用、斜体留着", F.t1_m4.em === 1 && (F.t1_m4.text.match(/【替身补翻】/g) || []).length === 2, JSON.stringify(F.t1_m4));
    ok("模型把标记弄丢：换后备模型再翻一次；还丢就退回纯文字，网址那个链接照样留着", JSON.stringify(F.msgs.filter((m) => m[0] === "t1_m5")) === JSON.stringify([["t1_m5", true, false], ["t1_m5", true, true]]) &&
      /^先读常见问题/.test(F.t1_m5.text) && F.t1_m5.links.some(([h]) => h === "https://example.com/details"), JSON.stringify([F.t1_m5, F.msgs.filter((m) => m[0] === "t1_m5")]));
    ok("标记都对的不重翻（每条评论一个请求）", ["t1_m1", "t1_m2", "t1_m3", "t1_m4"].every((id) => F.msgs.filter((m) => m[0] === id).length === 1), JSON.stringify(F.msgs));
    ok("主帖正文：带字的链接和加粗留着", JSON.stringify(F.post.links) === JSON.stringify(["https://example.com/guide"]) && JSON.stringify(F.post.strong) === JSON.stringify(["read it twice"]) &&
      /^【替身补翻】See/.test(F.post.text), JSON.stringify(F.post));
    ok("克隆里没有重复的 id；说明是评论正文那一格的第一行、写着\"翻译自英语\"", ["t1_m1", "t1_m2", "t1_m3", "t1_m4", "t1_m5"].every((id) => F[id].ids === 0 && F[id].noteFirst && F[id].label === "翻译自英语"),
      JSON.stringify(["t1_m1", "t1_m3"].map((id) => [F[id].ids, F[id].noteFirst, F[id].label])));

    // ⑦ 年度帖子页（/posts/2026/global/，"Reddit 最佳"）：英文标题原位置换（在链接里面，点了照样进帖子），中文的不翻
    await page.goto(`${BASE}/fakex/reddit/posts.html`, { waitUntil: "load" });
    await wait(1500);
    const Y = await page.evaluate((ts) => {
      const titleState = eval(ts), r = {};
      for (const x of document.querySelectorAll(".i18n-list-item-post-content")) r[x.getAttribute("post-id")] = titleState(x.querySelector("h3.i18n-list-item-post-title:not(.ff-own)"));
      const n = document.querySelector('[post-id="t3_y1"] .ff-rtx-note'), lab = n?.querySelector(".ff-tx-label"), btn = n?.querySelector(".ff-tx-toggle");
      const at = (e) => { const b = e.getBoundingClientRect(); const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { own: h === e || e.contains(h), href: h?.closest("a")?.getAttribute("href") || null }; };
      r.click = n ? { label: at(lab), btn: at(btn) } : null;
      r.cloneTitleAttr = document.querySelector('[post-id="t3_y1"] .ff-rtx-title')?.hasAttribute("title");
      return r;
    }, `(${titleState})`);
    ok("年度帖子页：英文标题原位置换（克隆的 h3 还在链接里），说明写着\"翻译自英语\"，中文的不翻",
      Y.t3_y1.tx === "【替身补翻】What I asked for, color palette, and what I got" && Y.t3_y1.txShown && Y.t3_y1.txTag === "H3" && !Y.t3_y1.origShown && Y.t3_y1.note === "翻译自英语" &&
      !Y.t3_y3.tx && Y.t3_y3.origShown && Y.cloneTitleAttr === false, JSON.stringify(Y));
    ok("年度帖子页：说明那一行的字点下去还是进帖子，\"看原文\"按钮点得到", Y.click && !Y.click.label.own && Y.click.label.href === "/r/ExpectationVsReality/comments/y1/x/" && Y.click.btn.own,
      JSON.stringify(Y.click));

    // ⑥ 再打开看过的帖子（post_long.html）：先一次查缓存，译文一下全换上，不用一块块排队；没命中的才翻
    await page.goto(`${BASE}/fakex/reddit/post_long.html`, { waitUntil: "load" });
    await wait(4000);
    const firstMsgs = await page.evaluate(() => (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill"));
    const seed = Object.fromEntries(firstMsgs.map((m) => [`${m.id}|${m.alt ? "alt|" : ""}${m.source}`,
      { action: "fill", text: m.markup ? m.source.replace(/<p(\d+)>/g, "<p$1>【替身补翻】") : "【替身补翻】" + m.source, model: "stub/model", cached: true }]));
    await page.evaluateOnNewDocument((sd) => { window.__ffTxCacheSeed = sd; window.__ffTxDelay = () => 3000; }, seed); // 真要翻的话 3 秒才回
    const t1 = Date.now();
    await page.goto(`${BASE}/fakex/reddit/post_long.html`, { waitUntil: "load" });
    let C = null;
    for (let i = 0; i < 60; i++) { await wait(50); C = await longState(); if (C.text && C.pending === 0 && C.cText && C.cPending === 0) break; }
    const took = Date.now() - t1;
    const second = await page.evaluate(() => (window.__ffTxMsgs || []).map((m) => m.type));
    ok("再打开看过的帖子：缓存里有的一下全换上（不等 3 秒的翻译）、没有\"翻译中…\"", C.text && C.pending === 0 && !C.busy && C.paras === 8 && C.cPending === 0 && took < 2000,
      JSON.stringify({ took, pending: C.pending, busy: C.busy, paras: C.paras }));
    ok("再打开：只查了一两次缓存，一个翻译请求都没发", !second.includes("translateFill") && second.filter((x) => x === "fillCachedBatch").length >= 1 && second.filter((x) => x === "fillCachedBatch").length <= 3,
      JSON.stringify(second));
    out.push(`INFO 再打开看过的长帖子：${took} ms 全部换上`);

    // ⑨ 视野外先处理（0.13.11）：上下各一屏、左右各半屏以内的先翻，更远的不动（feed_far.html：英文帖子之间隔着很高的空白）。
    //    新开一个标签：前面几节给 page 装了"翻译 3 秒才回"之类的替身设置
    const page9 = await browser.newPage();
    page9.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page9.setViewport({ width: 900, height: 800 });
    await page9.goto(`${BASE}/fakex/reddit/feed_far.html`, { waitUntil: "load" });
    await wait(1500);
    const askedR = () => page9.evaluate(() => [...new Set((window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").map((m) => m.id))]);
    let far = await askedR();
    ok("视野外先处理（Reddit）：在最上面时，三屏以下的不翻", far.includes("t3_h1") && !far.includes("t3_h2") && !far.includes("t3_h4"), JSON.stringify(far));
    await page9.evaluate(() => { const p = document.getElementById("t3_h2"); window.scrollTo(0, p.getBoundingClientRect().top + scrollY - innerHeight - 700); }); // 在视野下面 700 像素：一屏以内、旧的 600 像素以外
    await wait(1200);
    const below = await page9.evaluate(() => { const p = document.getElementById("t3_h2"), r = p.getBoundingClientRect(); return { out: r.top > innerHeight, tx: !!p.querySelector(":scope > .ff-rtx-title") }; });
    ok("视野外先处理（Reddit）：视野下面一屏以内的，还没滚到就翻好了", below.out && below.tx, JSON.stringify(below));
    await page9.evaluate(() => { const p = document.getElementById("t3_h4"); window.scrollTo(0, p.getBoundingClientRect().bottom + scrollY + 700); }); // 在视野上面 700 像素
    await wait(1200);
    const above = await page9.evaluate(() => { const p = document.getElementById("t3_h4"), r = p.getBoundingClientRect(); return { out: r.bottom < 0, tx: !!p.querySelector(":scope > .ff-rtx-title") }; });
    ok("视野外先处理（Reddit）：视野上面一屏以内的也翻好了（往回滚看到的已经是译文）", above.out && above.tx, JSON.stringify(above));

    // ⑩ 先翻眼前的（0.13.13）：40 条英文帖子的列表，打开时在中间（?y=1000），每个请求 1.5 秒——视野里的全排在最前面，
    //    上面那一屏的排在后面（以前按页面先后，上面那一屏的先发，眼前的要等）。0.19.4 起短的几条拼一个请求、同时最多 16 个请求
    const pageQ = await browser.newPage();
    pageQ.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await pageQ.setViewport({ width: 900, height: 800 });
    await pageQ.evaluateOnNewDocument(() => { window.__ffTxDelay = () => 1500; });
    await pageQ.goto(`${BASE}/fakex/reddit/feed_many.html?y=1000`, { waitUntil: "load" });
    await wait(1000);
    const Q = await pageQ.evaluate(() => {
      const ids = (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").map((m) => m.id);
      const where = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.bottom < 0 ? "above" : r.top > innerHeight ? "below" : "in"; };
      const visible = [...document.querySelectorAll("shreddit-post")].filter((p) => where(p.id) === "in").map((p) => p.id);
      return { order: ids.map(where), n: ids.length, visible: visible.length, maxLive: window.__ffTxMaxLive, batches: window.__ffTxBatches || [], scrolled: Math.round(scrollY) };
    });
    ok("先翻眼前的：视野里的全排在最前面，上面那一屏的排在后面；几条拼一个请求、同时最多 16 个请求", Q.scrolled === 1000 && Q.visible >= 8 &&
      Q.order.slice(0, Q.visible).every((x) => x === "in") && Q.maxLive <= 16 && Q.batches.length > 0 && Math.max(...Q.batches) > 1 && Q.batches.every((n) => n <= 4),
      JSON.stringify({ ...Q, order: Q.order.join(",").slice(0, 200) }));
  } catch (e) {
    out.push(`FAIL 运行出错 ${e.stack}`);
  }
  await browser.close();
  console.log(out.join("\n"));
  process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
})();
