// Hacker News（不调任何接口；替身把翻译回成"【替身补翻】"加原文，Jev 带"傻"的给辱骂 0.9、带"露骨"的给色情 0.95）：仿 HN 的页面
// （test/fakex/hn/，结构照真页面：服务端直出的表格，回复不嵌套、层级在 td.ind[indent]，评论第一段是裸文字、后面才是 <p>）。
// ① 列表 news.html：英文标题原位置换（还是那个链接），标题后面一个 ✦（鼠标提示"翻译自英语 · 由…翻译 · 看原文"，点它看原文），中文的不翻；
//    列表上不判；弹窗问"这个页面"答"只翻标题"。
// ② 帖子页 item.html：标题、正文（Ask HN）、评论原位置换，带格式（网址链接、带字的链接、斜体留着，代码块不翻、原样在），说明在正文上面；
//    层级那一格不动；只折辱骂和色情——骂人的折、色情的折，"我做了个工具"（引流 0.95）不折（HN 上不折垃圾），
//    带刺的（辱骂 0.75）不折（HN 上辱骂要到 0.8），楼主自己的照样判（0.21.3）；发给 Jev 的主帖是标题加正文、带楼主；弹窗答得出。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/hn_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const summary = () => new Promise((res) => { let done = false; for (const f of window.__ffOnMessage || []) f({ type: "pageSummary" }, {}, (r) => { if (!done) { done = true; res(r); } }); setTimeout(() => res(null), 300); });
const JEV = encodeURIComponent(JSON.stringify({ "I built a tool": 0.95, "borderline": { abuse: 0.75 } }));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 1100, height: 1400 });

    // ① 列表（9004 "Apple HomeView" 让替身原样返回）
    await page.evaluateOnNewDocument(() => { window.__ffTxPlan = { "fill:hn_9004": { action: "fill", text: "Apple HomeView", model: "stub/model", cost: 0 } }; });
    await page.goto(`${BASE}/fakex/hn/news.html`, { waitUntil: "load" });
    await wait(2500);
    const list = () => page.evaluate(() => {
      const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
      const r = {};
      for (const row of document.querySelectorAll("tr.athing.submission")) {
        const a = row.querySelector(".titleline > a:not(.ff-own)"), c = a.nextElementSibling?.classList.contains("ff-rtx-title") ? a.nextElementSibling : null;
        const n = (c || a).nextElementSibling?.classList.contains("ff-tx-inote") ? (c || a).nextElementSibling : null;
        const b = n && n.getBoundingClientRect(), hit = n && (() => { const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return h === n || n.contains(h); })();
        r[row.id] = { tx: c?.textContent || null, txShown: shown(c), origShown: shown(a), href: c ? c.getAttribute("href") === a.getAttribute("href") : null,
          icon: !!n, tip: n?.title || "", aria: n?.getAttribute("aria-label") || "", hit, sitebit: !!row.querySelector(".sitebit") && shown(row.querySelector(".sitebit")) };
      }
      return r;
    });
    let L = await list();
    ok("HN 列表：英文标题原位置换（还是那个链接），域名还在，中文的不翻", L["9001"].tx === "【替身补翻】Synthetic story about faster build systems" && L["9001"].txShown && !L["9001"].origShown &&
      L["9001"].href && L["9001"].sitebit && /^【替身补翻】Show HN/.test(L["9003"].tx || "") && !L["9002"].tx && L["9002"].origShown && !L["9002"].icon, JSON.stringify(L));
    ok("HN 列表：译出来和原文一字不差的（只有名字的标题）不换、不挂 ✦", !L["9004"].tx && L["9004"].origShown && !L["9004"].icon, JSON.stringify(L["9004"]));
    ok("HN 列表：说明不另起一行，标题后面一个 ✦，鼠标提示写着\"翻译自英语 · 由…翻译 · 看原文\"，读屏读得到，点得到",
      L["9001"].icon && /^翻译自英语 · 由 .+ 翻译 · 看原文$/.test(L["9001"].tip) && L["9001"].aria === "翻译自英语 · 看原文" && L["9001"].hit, JSON.stringify(L["9001"]));
    await page.evaluate(() => document.querySelector('[id="9001"] .ff-tx-inote').click());
    await wait(200);
    L = await list();
    ok("HN 列表：点 ✦ 看原文，原来的标题露出来，✦ 的提示变成\"原文（英语）· … · 看翻译\"；别的标题不变", L["9001"].origShown && !L["9001"].txShown && /^原文（英语） · .+ · 看翻译$/.test(L["9001"].tip) &&
      L["9003"].txShown, JSON.stringify([L["9001"], L["9003"]]));
    let sum = await page.evaluate(summary);
    ok("HN 列表：弹窗问这个页面——只翻标题、不判（不报折了几条），翻了 2 条", sum && sum.site === "hn" && sum.kind === "list" && !sum.folds && sum.tx && sum.tx.filled === 2, JSON.stringify(sum));

    // 30 个标题的列表（0.19.4，用户："条目比较多，翻译的有点慢"）：几条拼一个请求（每个请求最多 4 条），30 条 8 个请求、一轮发完（同时最多 16 个）；
    // 每个请求 600 毫秒，以前一条一个、同时 8 个要四轮
    {
      const pm = await browser.newPage();
      pm.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
      await pm.setViewport({ width: 1200, height: 1400 });
      await pm.evaluateOnNewDocument(() => { window.__ffTxDelay = () => 600; });
      await pm.goto(`${BASE}/fakex/hn/news_many.html`, { waitUntil: "load" });
      await wait(2500);
      const M = await pm.evaluate(() => ({ titles: document.querySelectorAll("tr.athing").length, done: document.querySelectorAll(".ff-rtx-title").length,
        items: (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").length, batches: window.__ffTxBatches || [], maxLive: window.__ffTxMaxLive,
        solo: (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill" && !m.batch).length }));
      // 正好 8 个请求、没有单发的：先查缓存那一步等这一轮的都认完语言再一起查（不等的时候各条先后错开，偶尔切成 11 个请求）
      ok("HN 30 个标题：几条拼一个请求（每个最多 4 条，30 条 8 个请求），一轮发完、全都换上", M.titles === 30 && M.done === 30 && M.items === 30 &&
        M.batches.length === 8 && M.solo === 0 && M.batches.every((n) => n >= 2 && n <= 4) && M.maxLive <= 16, JSON.stringify(M));
      await pm.close();
    }
    // 流式（0.19.4）：一批里先译完的先换上，不等整批。每 4 条里有一条慢的（2.5 秒），别的 150 毫秒：
    // 900 毫秒时快的都换上了、慢的还没有；推不到（__ffTxNoPart）时只靠整批回来，900 毫秒时一条都没换上，最后也全换上
    for (const noPart of [false, true]) {
      const pm = await browser.newPage();
      pm.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
      await pm.setViewport({ width: 1200, height: 1400 });
      await pm.evaluateOnNewDocument((np) => { window.__ffTxNoPart = np; window.__ffTxDelay = (m) => (/^Synthetic story (4|8|12|16|20|24|28):/.test(m.source) ? 2500 : 150); }, noPart);
      await pm.goto(`${BASE}/fakex/hn/news_many.html`, { waitUntil: "load" });
      await wait(900);
      const count = () => pm.evaluate(() => { const done = [...document.querySelectorAll(".ff-rtx-title")].map((e) => e.textContent), slow = (t) => /story (4|8|12|16|20|24|28):/.test(t);
        // 900 毫秒以前就整个回来的：没有慢条的那几批，加上单独发的快条（准备好的先后不一定，偶尔有一条单独发）
        const allFast = (window.__ffTxBatchSrc || []).filter((b) => !b.some(slow)).reduce((n, b) => n + b.length, 0) +
          (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill" && !m.batch && !slow(m.source)).length;
        return { done: done.length, slow: done.filter(slow).length, allFast, batches: (window.__ffTxBatches || []).length }; });
      const early = await count();
      await wait(2600);
      const late = await count();
      if (!noPart) ok("流式：每批里先译完的先换上（900 毫秒时快的 23 条都换上了、慢的 7 条还没有），最后全换上", early.done === 23 && early.slow === 0 && late.done === 30 && late.slow === 7,
        JSON.stringify({ early, late }));
      else ok("推不到时（没有流式）照整批回来的换上：900 毫秒时只有不带慢条的那几批换上了，最后全换上", early.done === early.allFast && early.done < 23 && late.done === 30,
        JSON.stringify({ early, late }));
      await pm.close();
    }

    // ② 帖子页
    await page.goto(`${BASE}/fakex/hn/item.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(3000);
    const item = () => page.evaluate(async () => {
      const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
      const r = {};
      for (const c of document.querySelectorAll("tr.athing.comtr")) {
        const box = c.querySelector("div.comment"), orig = box.querySelector("div.commtext:not(.ff-own)"), cl = box.querySelector(":scope > .ff-rtx-whole");
        const note = box.querySelector(":scope > .ff-rtx-bnote"), bar = box.previousElementSibling?.classList.contains("ff-bar") ? box.previousElementSibling : null;
        r[c.id] = { tx: cl ? cl.textContent.replace(/\s+/g, " ").trim() : null, txShown: shown(cl), origShown: shown(orig), note: note?.querySelector(".ff-tx-label")?.textContent || null,
          noteFirst: !!note && box.firstElementChild === note, links: cl ? [...cl.querySelectorAll("a")].map((a) => [a.getAttribute("href"), a.textContent]) : [], i: cl ? cl.querySelectorAll("i").length : 0,
          code: cl ? [...cl.querySelectorAll("pre code")].map((x) => x.textContent) : [], ids: cl ? cl.querySelectorAll("[id]").length : 0,
          bar: bar ? bar.querySelector(".ff-reason").textContent : null, hidden: getComputedStyle(box).display === "none", headShown: shown(c.querySelector(".comhead")),
          indent: c.querySelector("td.ind").getAttribute("indent"), indW: c.querySelector("td.ind img").getAttribute("width") };
      }
      const fat = document.querySelector("table.fatitem"), ta = fat.querySelector(".titleline > a:not(.ff-own)"), tc = fat.querySelector(".ff-rtx-title");
      const top = fat.querySelector(".ff-rtx-whole");
      r.main = { title: tc?.textContent || null, titleShown: shown(tc), origTitle: shown(ta), icon: !!fat.querySelector(".ff-tx-inote"), top: top ? top.textContent.replace(/\s+/g, " ").trim() : null,
        topI: top ? top.querySelectorAll("i").length : 0, topNote: fat.querySelector(".ff-rtx-bnote .ff-tx-label")?.textContent || null };
      r.jev = (window.__ffJevAll || []).map((m) => ({ post: m.post, author: m.author, ids: m.replies.map((x) => x.id) }));
      { const s = await new Promise((res) => { let done = false; for (const f of window.__ffOnMessage || []) f({ type: "pageSummary" }, {}, (s) => { if (!done) { done = true; res(s || {}); } }); setTimeout(() => { if (!done) res({}); }, 300); }); r.folded = (s.folded || []).map(([id, kind]) => id + "@" + s.key + ":" + kind); } // 0.28.5：从弹窗那条查询里拿（不再发"最近清理"）
      return r;
    });
    let I = await item();
    ok("HN 帖子页：标题原位置换、后面一个 ✦；Ask HN 的正文带格式换（斜体留着），说明在正文上面",
      I.main.title === "【替身补翻】Ask HN: What synthetic tools do you use every day?" && I.main.titleShown && !I.main.origTitle && I.main.icon &&
      /^【替身补翻】I have been looking for good tools/.test(I.main.top || "") && I.main.topI === 1 && I.main.topNote === "翻译自英语", JSON.stringify(I.main));
    const h1 = I["9101"];
    ok("HN 评论带格式换：裸文字那一段、<p> 段落都换了，网址链接、带字的链接（指向原来的地址）、斜体留着，代码块原样不翻，克隆里没有重复的 id",
      /^【替身补翻】Type systems are hard!/.test(h1.tx || "") && /【替身补翻】The last part comes after the code block\.$/.test(h1.tx || "") && (h1.tx.match(/【替身补翻】/g) || []).length === 4 &&
      JSON.stringify(h1.links) === JSON.stringify([["https://counterexamples.org/", "https://counterexamples.org/"], ["https://example.com/notes", "named link"]]) &&
      h1.i === 1 && JSON.stringify(h1.code) === JSON.stringify(["  let x = compute(1);"]) && h1.ids === 0 && h1.txShown && !h1.origShown, JSON.stringify(h1));
    ok("HN 评论：说明在正文上面、写着\"翻译自英语\"；回复（indent 1）也翻，层级那一格不动；中文的不翻",
      h1.note === "翻译自英语" && h1.noteFirst && /^【替身补翻】Thanks/.test(I["9102"].tx || "") && I["9102"].indent === "1" && I["9102"].indW === "40" &&
      !I["9107"].tx && I["9107"].origShown, JSON.stringify([I["9102"], I["9107"]]));
    ok("HN 只折辱骂和色情：骂人的、色情的折起来（作者那一行留着），\"我做了个工具\"（引流 0.95）不折，带刺的（辱骂 0.75）不折，楼主自己的照样判、这句没问题不折",
      /辱骂/.test(I["9103"].bar || "") && I["9103"].hidden && I["9103"].headShown && /色情/.test(I["9105"].bar || "") && I["9105"].hidden &&
      !I["9104"].bar && !I["9104"].hidden && !I["9108"].bar && !I["9106"].bar, JSON.stringify(["9103", "9104", "9105", "9106", "9108"].map((k) => [k, I[k].bar, I[k].hidden])));
    const sent = I.jev.flatMap((m) => m.ids);
    ok("发给 Jev 的：主帖是标题加正文、带楼主；楼主自己的评论也发（0.21.3）；记下的折叠是 hn_… 这一页 hn:i:9100",
      I.jev.length >= 1 && I.jev.every((m) => m.post === "Ask HN: What synthetic tools do you use every day?\nI have been looking for good tools for a while.\nAny suggestions are welcome." &&
        m.author && m.author.handle === "alice") && sent.includes("hn_9106") && sent.includes("hn_9101") &&
      JSON.stringify(I.folded.sort()) === JSON.stringify(["hn_9103@hn:i:9100:abuse", "hn_9105@hn:i:9100:sexual"]), JSON.stringify([I.jev, I.folded]));
    await page.evaluate(() => document.querySelector('[id="9101"] .ff-rtx-bnote .ff-tx-toggle').click());
    await wait(200);
    I = await item();
    ok("HN 评论点\"看原文\"：原文露出来，说明还在、写着\"原文（英语）\"；别的评论不变", I["9101"].origShown && !I["9101"].txShown && /原文（英语）/.test(I["9101"].note || "") && I["9102"].txShown,
      JSON.stringify([I["9101"], I["9102"].txShown]));
    await page.evaluate(() => document.querySelector('[id="9103"] .ff-bar').click());
    await wait(200);
    I = await item();
    ok("HN：点折叠条展开骂人的那条", !I["9103"].hidden, JSON.stringify(I["9103"]));
    sum = await page.evaluate(summary);
    ok("HN 帖子页：弹窗问这个页面——折了辱骂 1 条、色情 1 条，翻了的条数也报", sum && sum.site === "hn" && sum.kind === "status" && sum.folds && sum.folds.abuse === 1 &&
      sum.folds.sexual === 1 && sum.folds.spam === 0 && sum.tx && sum.tx.filled >= 7, JSON.stringify(sum));
    // 别的页面（用户页之类）不管
    await page.evaluate(() => history.pushState({}, "", "/user?id=alice"));
    await wait(1000);
    sum = await page.evaluate(summary);
    ok("HN 别的页面（用户页）不管：撤掉折叠条，弹窗答\"插件不管\"", sum && sum.kind === "other" && (await page.evaluate(() => document.querySelectorAll(".ff-bar").length)) === 0, JSON.stringify(sum));
  } catch (e) {
    out.push(`FAIL 运行出错 ${e.stack}`);
  }
  await browser.close();
  console.log(out.join("\n"));
  process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
})();
