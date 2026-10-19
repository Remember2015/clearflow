// 翻译增强（translate.js）的测试：无头 Chrome 里跑仿 X 首页自动翻译 test/fakex/translate.html，
// 替身按 window.__ffTxPlan 回后台结果（见 build_inject_bundle.py），检查读原文、切回、换上译文、各种开关；
// 再跑仿帖子详情页 test/fakex/thread.html：主帖被 X 翻译了、楼主自己的回复没翻，检查补翻和"楼主的回复不折叠"。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/translate_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const puppeteer = require(require("path").resolve(process.argv[2] || ".", "node_modules/puppeteer-core"));
const ORIG_1006 = "Big update from @openai_test 🎉\nRead more: https://example.com/launch-notes… #BigUpdate #AI $NVDA";
const TR_1006 = "来自 @openai_test 的大更新 🎉\n阅读更多：https://example.com/launch-notes… #BigUpdate #AI $NVDA";
const OURS = {
  "1001": "为什么好人这么难招？因为真正厉害的人根本不缺工作！",
  "1003": "这是一篇讲路线图的长文。第一，编辑器推倒重写；第二，同步快 10 倍。",
  "1006": "@openai_test 放大招了 🎉\n详情：https://example.com/launch-notes… #AI #大更新 $NVDA", // 话题一个照抄、一个译了，先后也换了
  "1008": "说实话，这次更新真的改变了游戏规则。 #游戏规则", // 原文没有话题，模型多出来一个
  "1012": "又一篇合成长帖，写得挺长，所以 X 在信息流里只露出开头。",
};
const PLAN = Object.fromEntries(Object.entries(OURS).map(([id, text]) => [id, {
  action: "replace", tried: true, text, model: "openai/gpt-6-luna", weak: id === "1006" ? "natural" : "faithful",
  grok: {}, grokMin: 0.42, ours: {}, oursMin: 0.86, cost: 0.00004, jevTokens: 900, cached: false,
}]));
PLAN["1002"] = { action: "keep", grokMin: 0.91, cached: false };

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  const out = [];
  const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1400 });
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.evaluateOnNewDocument((plan) => {
      window.__ffTxPlan = plan;
      // 每一帧开头看一眼：有没有哪条（慢切换的 1008 除外）在屏幕上露出了原文。微任务里切换完的话一帧都不会有
      window.__ffFlash = []; window.__ffSlowFlash = 0; window.__ffWatch = true;
      const rec = () => {
        if (window.__ffWatch) {
          const shown = [...document.querySelectorAll('[data-testid="tweetText"][lang="en"]')];
          const fast = shown.filter((x) => !x.closest('[data-fid="1008"]'));
          if (fast.length) window.__ffFlash.push(fast.map((x) => x.closest("article").dataset.fid).join(","));
          if (fast.length < shown.length) window.__ffSlowFlash++;
        }
        requestAnimationFrame(rec);
      };
      requestAnimationFrame(rec);
    }, PLAN);
    await page.goto(`${process.argv[3] || "http://localhost:8767"}/fakex/translate.html`, { waitUntil: "load" });
    await wait(3500);
    const st = (id) => page.evaluate((id) => {
      const a = document.querySelector(`article[data-fid="${id}"]`), tt = a.querySelector('[data-testid="tweetText"]'), b = a.querySelector(".ff-tx");
      return { lang: tt.getAttribute("lang"), hidden: getComputedStyle(tt).display === "none", text: tt.textContent,
        showOrig: !!a.querySelector('button[aria-label="显示原文"]'), block: !!b, afterTt: !!b && tt.nextElementSibling === b,
        ours: b && !b.querySelector(".ff-tx-text").hidden ? b.querySelector(".ff-tx-text").textContent : null,
        label: b?.querySelector(".ff-tx-label").textContent, toggle: b?.querySelector(".ff-tx-toggle").textContent,
        title: b?.querySelector(".ff-tx-note").title, fontSize: b ? getComputedStyle(b.querySelector(".ff-tx-text")).fontSize : null,
        clamp: !!b && b.querySelector(".ff-tx-text").classList.contains("ff-tx-clamp"), lines: b ? b.querySelector(".ff-tx-text").style.webkitLineClamp : null,
        ourMore: !!b && !!b.querySelector(".ff-tx-more") && !b.querySelector(".ff-tx-more").hidden,
        xMore: a.querySelector('[data-testid="tweet-text-show-more-link"]') ? getComputedStyle(a.querySelector('[data-testid="tweet-text-show-more-link"]')).display : "gone" };
    }, id);
    const msgs = await page.evaluate(() => window.__ffTxMsgs || []);
    const by = Object.fromEntries(msgs.map((m) => [m.id, m]));
    ok("只发了有自动翻译、有帖子链接的（长帖读得到页面数据的也发，读不到的等展开）", JSON.stringify(Object.keys(by).sort()) === '["1001","1002","1003","1006","1008"]', JSON.stringify(Object.keys(by)));
    ok("每条只发一次", msgs.length === 5, `n=${msgs.length}`);
    ok("长帖没展开就用页面数据里的完整原文和完整译文", by["1003"]?.source.endsWith("sync gets 10x faster. https://example.com/roadmap") && by["1003"].xText.endsWith("同步快十倍。 https://example.com/roadmap") && by["1003"].srcLang === "en", JSON.stringify(by["1003"]));
    ok("页面数据的原文里去掉视频的 t.co（页面上显示成视频，不是字），作者贴的链接留着", !/fakevid|someone/.test(by["1003"]?.source + by["1003"]?.xText), JSON.stringify(by["1003"]));
    ok("读到原文和 Grok 译文", by["1001"]?.source === "Why is it so hard to hire good people? Because the good ones are not for hire!" &&
      by["1001"].xText === "为什么雇佣好人这么难？因为好人不是雇佣兵！" && by["1001"].srcLang === "en", JSON.stringify(by["1001"]));
    ok("@、表情图、被拆开的链接、#话题、$代码都读对", by["1006"]?.source === ORIG_1006 && by["1006"].xText === TR_1006, JSON.stringify(by["1006"]));
    ok("慢切换（60 ms）也读到原文", by["1008"]?.source === "Not gonna lie, this update is a game changer.", JSON.stringify(by["1008"]));
    const flash = await page.evaluate(() => window.__ffFlash);
    ok("读原文时一帧都没露出来", flash.length === 0, JSON.stringify(flash));
    ok("对照：慢切换那条确实露出过原文（说明上面的检查抓得到）", (await page.evaluate(() => window.__ffSlowFlash)) > 0);
    const all = await Promise.all(["1001", "1002", "1003", "1004", "1006", "1008", "1012"].map(st));
    ok("读完都切回了译文", all.every((s) => s.lang === "zh" && s.showOrig), JSON.stringify(all.map((s) => [s.lang, s.showOrig])));
    let s1 = all[0];
    ok("Grok 翻得差的换上了改进的译文", s1.hidden && s1.block && s1.afterTt && s1.ours === OURS["1001"], JSON.stringify(s1));
    ok("说明行和切换按钮", s1.label === "改进的翻译" && s1.toggle === "看 Grok 版" && /gpt-6-luna/.test(s1.title) && /0\.42/.test(s1.title), JSON.stringify(s1));
    ok("字号跟 X 正文一样", s1.fontSize === "15px", s1.fontSize);
    ok("Grok 翻得好的不动", !all[1].block && !all[1].hidden);
    ok("读不到页面数据的长帖、广告不动", !all[6].block && !all[3].block && !all[6].hidden && !all[3].hidden && !["none", "gone"].includes(all[6].xMore));
    ok("长帖没展开就换上了完整的改进译文，X 的显示更多藏起来", all[2].block && all[2].hidden && !all[2].clamp && !all[2].ourMore &&
      all[2].xMore === "none" && all[2].ours === OURS["1003"], JSON.stringify(all[2]));
    ok("慢切换那条也换上了", all[5].block && all[5].hidden && all[5].ours === OURS["1008"], JSON.stringify(all[5]));
    const links = await page.evaluate(() => [...document.querySelectorAll('article[data-fid="1006"] .ff-tx-link')].map((a) => [a.textContent, a.getAttribute("href")]));
    ok("译文里的链接、@、#、$ 能点，链接还是 X 的 t.co；#话题 显示译文、点了搜原文的话题（照抄的先对上，剩下的按先后）", JSON.stringify(links) === JSON.stringify([["@openai_test", "/openai_test"],
      ["https://example.com/launch-notes…", "https://t.co/fakelink1"], ["#AI", "/hashtag/AI"], ["#大更新", "/hashtag/BigUpdate"], ["$NVDA", "/search?q=%24NVDA"]]), JSON.stringify(links));
    const links1008 = await page.evaluate(() => document.querySelectorAll('article[data-fid="1008"] .ff-tx-link').length);
    ok("原文里对不上的话题只显示字、不做成链接", links1008 === 0 && all[5].ours === OURS["1008"], `${links1008} ${all[5].ours}`);

    await page.evaluate(() => { window.__ffWatch = false; });
    // 点我们的译文、说明行和点 X 自己的正文一样，交给 X（真 X 首页上会点开帖子）；点链接、切换按钮不当成点了帖子
    const clicks = await page.evaluate(() => {
      const seen = [];
      const kind = (t) => (t.closest(".ff-tx-link") ? "link" : t.closest(".ff-tx-toggle") ? "toggle" : t.closest(".ff-tx-label") ? "label" : "text");
      const onBubble = (e) => { if (e.target.closest(".ff-tx")) seen.push(kind(e.target)); };
      const noNav = (e) => { if (e.target.closest("a")) e.preventDefault(); }; // 链接别真跳走
      window.addEventListener("click", noNav, true);
      document.addEventListener("click", onBubble);
      document.querySelector('article[data-fid="1001"] .ff-tx-text').click();
      document.querySelector('article[data-fid="1001"] .ff-tx-label').click();
      document.querySelector('article[data-fid="1006"] .ff-tx-link').click();
      document.querySelector('article[data-fid="1001"] .ff-tx-toggle').click();
      document.removeEventListener("click", onBubble);
      window.removeEventListener("click", noNav, true);
      return seen;
    });
    ok("点译文、说明行交给 X（会点开帖子），点链接、切换按钮不会", JSON.stringify(clicks) === JSON.stringify(["text", "label"]), JSON.stringify(clicks));
    await wait(150);
    s1 = await st("1001");
    ok("看 Grok 版：露出 X 的译文，按钮变成看改进版", !s1.hidden && s1.block && s1.ours === null && s1.label === "这是 Grok 的翻译" && s1.toggle === "看改进版", JSON.stringify(s1));
    await page.evaluate(() => document.querySelector('article[data-fid="1001"] .ff-tx-toggle').click());
    await wait(150);
    s1 = await st("1001");
    ok("看改进版：切回来", s1.hidden && s1.ours === OURS["1001"]);
    await page.evaluate(() => document.querySelector('article[data-fid="1001"] button[aria-label="显示原文"]').click());
    await wait(200);
    s1 = await st("1001");
    ok("点 X 的显示原文：我们的块撤掉，显示原文", !s1.block && !s1.hidden && s1.lang === "en" && s1.text.startsWith("Why is it"), JSON.stringify(s1));
    await wait(1500);
    ok("看原文时不重发", (await page.evaluate(() => window.__ffTxMsgs.length)) === 5);
    await page.evaluate(() => document.querySelector('article[data-fid="1001"] button[aria-label="显示翻译"]').click());
    await wait(200);
    s1 = await st("1001");
    ok("再点显示翻译：换回改进的译文", s1.block && s1.hidden && s1.lang === "zh" && s1.ours === OURS["1001"], JSON.stringify(s1));

    await page.evaluate(() => document.querySelector('article[data-fid="1003"] .ff-tx-toggle').click());
    await wait(200);
    let s3 = await st("1003");
    ok("长帖看 Grok 版：X 那截和它的显示更多都露出来", !s3.hidden && s3.ours === null && !["none", "gone"].includes(s3.xMore) &&
      s3.text === "这是一篇关于我们路线图的长文。首先，我们会从头重写编", JSON.stringify(s3));
    await page.evaluate(() => document.querySelector('article[data-fid="1003"] [data-testid="tweet-text-show-more-link"]').click());
    await wait(300);
    s3 = await st("1003");
    ok("在 Grok 版点 X 的显示更多：展开成 X 的完整译文", s3.xMore === "gone" && s3.text.endsWith("同步快十倍。") && !s3.hidden, JSON.stringify(s3));
    await page.evaluate(() => document.querySelector('article[data-fid="1003"] .ff-tx-toggle').click());
    await wait(300);
    s3 = await st("1003");
    ok("切回改进版：还是那份完整译文，不重新判", s3.block && s3.hidden && s3.ours === OURS["1003"] &&
      (await page.evaluate(() => window.__ffTxMsgs.filter((m) => m.id === "1003").length)) === 1, JSON.stringify(s3));

    await page.evaluate(() => __expand("1012"));
    await wait(2500);
    const m12 = await page.evaluate(() => window.__ffTxMsgs.filter((m) => m.id === "1012"));
    ok("读不到页面数据的长帖：展开后才处理，用的是完整原文和译文", m12.length === 1 && m12[0].source.endsWith("first part of it in the feed.") && m12[0].xText.endsWith("只显示前一部分。"), JSON.stringify(m12));
    const s12 = await st("1012");
    ok("展开的长帖换上了", s12.block && s12.hidden && s12.ours === OURS["1012"] && !s12.clamp, JSON.stringify(s12));

    await page.evaluate(() => chrome.storage.local.set({ ff_settings: { translate: false } }));
    await wait(400);
    const off = await page.evaluate(() => ({ blocks: document.querySelectorAll(".ff-tx").length,
      hidden: [...document.querySelectorAll('[data-testid="tweetText"]')].filter((x) => getComputedStyle(x).display === "none").length,
      flagged: document.querySelectorAll("[data-ff-tx-hidden]").length }));
    ok("关掉开关：换上的全撤下，X 的译文都露出来", off.blocks === 0 && off.hidden === 0 && off.flagged === 0, JSON.stringify(off));
    const n0 = await page.evaluate(() => window.__ffTxMsgs.length);
    await wait(2000);
    ok("关着不发请求", (await page.evaluate(() => window.__ffTxMsgs.length)) === n0);
    await page.evaluate(() => chrome.storage.local.set({ ff_settings: { translate: true } }));
    await wait(3000);
    const back = await page.evaluate(() => document.querySelectorAll(".ff-tx").length);
    ok("重新打开：按新设置重做，五条又换上", back === 5, `blocks=${back}`);

    // 滚动加载新帖：照 1002 克隆一条（新 id、新原文和译文）
    const addPost = (id) => page.evaluate((id) => {
      TX[id] = { orig: `Synthetic post number ${id}.`, tr: `合成帖子 ${id} 号。` };
      const cell = document.querySelector('article[data-fid="1002"]').closest('[data-testid="cellInnerDiv"]').cloneNode(true);
      const a = cell.querySelector("article");
      a.dataset.fid = id;
      a.querySelector('a[href*="/status/"]').setAttribute("href", `/user${id}/status/${id}`);
      fill(a, "tr");
      document.querySelector('[aria-label^="时间线"]').appendChild(cell);
    }, id);
    const sent = (id) => page.evaluate((id) => window.__ffTxMsgs.filter((m) => m.id === id).length, id);
    await page.evaluate(() => history.pushState({}, "", "/explore"));
    await addPost("1009");
    await wait(2500);
    ok("不在首页不处理", (await sent("1009")) === 0);
    await page.evaluate(() => history.pushState({}, "", "/home"));
    await wait(2500);
    ok("回到首页接着处理", (await sent("1009")) === 1);

    // 后台说余额不足：这一页不再发（后面新滚出来的也不发）
    await page.evaluate(() => { window.__ffTxPlan["1010"] = { error: "OpenRouter 余额不足", code: "or_credit", retryable: false }; });
    await addPost("1010");
    await wait(2500);
    await addPost("1011");
    await wait(2500);
    ok("余额不足后这一页停下", (await sent("1010")) === 1 && (await sent("1011")) === 0, `${await sent("1010")} ${await sent("1011")}`);
    // 改了设置（比如充了值、换了 key 之后）重新开始
    await page.evaluate(() => chrome.storage.local.set({ ff_settings: { translate: true, translateMargin: 0.2 } }));
    await wait(3500);
    ok("设置变了重新开始", (await sent("1011")) === 1);
    await page.close();

    // ---------- 帖子页补翻 ----------
    const base = process.argv[3] || "http://localhost:8767";
    const FILL = { "fill:3002": { action: "fill", text: "还有一件事：老套餐到明年之前都能继续用。", model: "openai/gpt-6-luna", cost: 0.00003, cached: false } };
    const open = async (q = "", init = {}, plan = {}) => {
      const pg = await browser.newPage();
      await pg.setViewport({ width: 800, height: 2000 });
      pg.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
      await pg.evaluateOnNewDocument((plan, init) => { window.__ffTxPlan = plan; Object.assign(window, init); }, { ...FILL, ...plan }, init);
      await pg.goto(`${base}/fakex/thread.html${q}`, { waitUntil: "load" });
      await wait(5000); // 0.28.9 起补翻先等 1.5 秒（X 可能晚一点挂出自己的翻译）
      return pg;
    };
    const fills = (pg) => pg.evaluate(() => (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill"));
    const tst = (pg, id) => pg.evaluate((id) => {
      const a = document.querySelector(`article[data-fid="${id}"]`), tt = a.querySelector('[data-testid="tweetText"]'), b = a.querySelector(".ff-tx");
      return { lang: tt.getAttribute("lang"), hidden: getComputedStyle(tt).display === "none", text: tt.textContent, block: !!b,
        beforeTt: !!b && b.nextElementSibling === tt, noteFirst: !!b && b.firstElementChild?.classList.contains("ff-tx-note"),
        ours: b && !b.querySelector(".ff-tx-text").hidden ? b.querySelector(".ff-tx-text").textContent : null,
        label: b?.querySelector(".ff-tx-label").textContent, toggle: b?.querySelector(".ff-tx-toggle").textContent, title: b?.querySelector(".ff-tx-note").title,
        folded: a.style.display === "none" || !!(a.previousElementSibling && a.previousElementSibling.classList.contains("ff-bar")),
        xRow: !!a.querySelector('button[aria-label="显示原文"]'),
        xMore: a.querySelector('[data-testid="tweet-text-show-more-link"]') ? getComputedStyle(a.querySelector('[data-testid="tweet-text-show-more-link"]')).display : "gone" };
    }, id);
    let tp = await open();
    let fm = await fills(tp);
    ok("帖子页：只补翻楼主没被翻译的外文回复（中文、别人的、只有链接的、发现更多下面的都不翻；0.21.2 起楼主骂人的那条 3007 被清理了，也不翻）",
      JSON.stringify(fm.map((m) => m.id).sort()) === '["3002","3003","3012"]', JSON.stringify(fm.map((m) => m.id)));
    const f3 = fm.find((m) => m.id === "3003"), f12 = fm.filter((m) => m.id === "3012");
    ok("长回复（读得到页面数据）：按完整原文翻，不用展开", f3?.truncated === false && f3.source.endsWith("0.2% of traffic.") && fm.find((m) => m.id === "3002")?.truncated === false, JSON.stringify(f3));
    let t3 = await tst(tp, "3003");
    ok("长回复换上完整译文，X 的显示更多藏起来", t3.block && t3.hidden && t3.ours?.endsWith("0.2% of traffic.") && t3.xMore === "none", JSON.stringify(t3));
    const t12 = await tst(tp, "3012");
    ok("长回复（读不到页面数据）：替你点开显示更多，按展开后的全文翻", f12.length === 1 && f12[0].truncated === false && f12[0].source.endsWith("to read the rest.") &&
      t12.xMore === "gone" && t12.block && t12.ours?.endsWith("to read the rest."), JSON.stringify([f12, t12]));
    let t2 = await tst(tp, "3002");
    ok("楼主回复换上补翻：说明在正文上面、原文藏起来", t2.block && t2.beforeTt && t2.noteFirst && t2.hidden && t2.ours === FILL["fill:3002"].text, JSON.stringify(t2));
    ok("补翻的说明和提示", t2.label === "插件翻译自英语" && t2.toggle === "看原文" && /X 没有翻译这条/.test(t2.title) && /gpt-6-luna/.test(t2.title), JSON.stringify(t2));
    const t1 = await tst(tp, "3001");
    ok("主帖（X 已经翻译）不动", !t1.block && !t1.hidden && t1.xRow && t1.lang === "zh", JSON.stringify(t1));
    const t7 = await tst(tp, "3007"), t8 = await tst(tp, "3008");
    ok("楼主自己的回复带辱骂词：0.21.2 起照样清理（用户：作者的回复也可能是垃圾、辱骂、色情）", t7.folded, JSON.stringify(t7));
    ok("对照：别人的同样内容照常折叠", t8.folded, JSON.stringify(t8));
    await wait(1000);
    const xClicks = await tp.evaluate(() => window.__clicks), demand = await tp.evaluate(() => window.__demandClicks);
    const t10 = await tst(tp, "3010"), t11 = await tst(tp, "3011");
    ok("X 能按需翻的：替你点一次显示翻译，用 X 自己的译文，插件不另翻", demand["3010"] === 1 && t10.lang === "zh" && t10.xRow && !t10.block &&
      !(await fills(tp)).some((m) => m.id === "3010"), JSON.stringify([demand, t10]));
    ok("你切回原文的（X 自动翻过）：不点、不翻", !xClicks["3011"] && t11.lang === "en" && !t11.block, JSON.stringify([xClicks, t11]));
    await tp.evaluate(() => document.querySelector('article[data-fid="3002"] .ff-tx-toggle').click());
    await wait(200);
    t2 = await tst(tp, "3002");
    ok("看原文：露出英文原文，说明变成原文（英语）· 看翻译", !t2.hidden && t2.ours === null && t2.label === "原文（英语）" && t2.toggle === "看翻译" && t2.lang === "en", JSON.stringify(t2));
    await tp.evaluate(() => document.querySelector('article[data-fid="3002"] .ff-tx-toggle').click());
    await wait(200);
    ok("看翻译：切回来", (await tst(tp, "3002")).hidden);
    const fillClicks = await tp.evaluate(() => {
      const a = document.querySelector('article[data-fid="3002"]');
      let n = 0; a.addEventListener("click", () => n++);
      a.querySelector(".ff-tx-text").click();
      return n;
    });
    ok("点补翻的正文和点 X 的正文一样交给 X（会点开那条回复）", fillClicks === 1, `n=${fillClicks}`);
    const improves = await tp.evaluate(() => (window.__ffTxMsgs || []).filter((m) => m.type === "translate").map((m) => m.id).sort());
    ok("帖子页也判 X 的译文：主帖、替你点开翻译的那条都判，你切回原文的不判", JSON.stringify(improves) === '["3001","3010"]', JSON.stringify(improves));
    await tp.evaluate(() => document.querySelector('article[data-fid="3003"] .ff-tx-toggle').click());
    await wait(200);
    t3 = await tst(tp, "3003");
    ok("长回复看原文：X 那截原文和它的显示更多都露出来", !t3.hidden && t3.ours === null && !["none", "gone"].includes(t3.xMore), JSON.stringify(t3));
    await tp.evaluate(() => document.querySelector('article[data-fid="3003"] [data-testid="tweet-text-show-more-link"]').click());
    await wait(300);
    await tp.evaluate(() => document.querySelector('article[data-fid="3003"] .ff-tx-toggle').click());
    await wait(1500);
    t3 = await tst(tp, "3003");
    ok("看原文时点开显示更多，再切回翻译：还是那份完整译文，不重翻", t3.block && t3.hidden && t3.ours?.endsWith("0.2% of traffic.") &&
      (await fills(tp)).filter((m) => m.id === "3003").length === 1, JSON.stringify(t3));
    await tp.close();

    tp = await open("", {}, { "3001": { action: "replace", tried: true, text: "今天我们发布了三样新东西：新编辑器、更快的同步、更便宜的套餐。",
      model: "openai/gpt-6-luna", weak: "natural", grokMin: 0.5, oursMin: 0.85, cached: false } });
    const tf = await tst(tp, "3001");
    const tfPos = await tp.evaluate(() => { const a = document.querySelector('article[data-fid="3001"]'); const b = a.querySelector(".ff-tx");
      return { after: b?.previousElementSibling === a.querySelector('[data-testid="tweetText"]'), label: b?.querySelector(".ff-tx-label").textContent }; });
    ok("帖子页主帖 Grok 翻得差：换上改进的译文，和首页一样放在正文下面", tf.block && tf.hidden && tf.ours?.startsWith("今天我们发布了三样新东西") && tfPos.after &&
      tfPos.label === "改进的翻译", JSON.stringify([tf, tfPos]));
    await tp.close();
    tp = await open("?notr");
    ok("主帖没被 X 翻译：什么都不补，也不替你点", (await fills(tp)).length === 0 && !(await tp.evaluate(() => window.__demandClicks["3010"])));
    await tp.close();
    tp = await open("?focal=3002");
    fm = await fills(tp);
    ok("打开的是楼主那条回复（上面的主帖被翻译了）：这条和楼主别的回复照样补", JSON.stringify(fm.map((m) => m.id).sort()) === '["3002","3003","3012"]' && (await tst(tp, "3002")).block, JSON.stringify(fm.map((m) => m.id)));
    await tp.close();
    tp = await open("", { __ffNoJevKey: true });
    ok("没填 TypeSafe key 也补翻（只要 OpenRouter key）", (await fills(tp)).length === 4);
    await tp.close();

    // ---------- X 的界面是英文：目标语言跟着 X 走，插进去的字是英文，认翻译那一行不靠按钮上的字 ----------
    const openEn = async (q, plan) => {
      const pg = await browser.newPage();
      await pg.setViewport({ width: 800, height: 1400 });
      pg.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
      await pg.evaluateOnNewDocument((plan) => { window.__ffTxPlan = plan; }, plan);
      await pg.goto(`${base}/fakex/translate_en.html${q}`, { waitUntil: "load" });
      await wait(3500);
      return pg;
    };
    const en = await openEn("", { "5001": { action: "replace", tried: true, text: "It's such nice weather today. Let's all go for a walk!",
      model: "openai/gpt-6-luna", weak: "natural", grokMin: 0.4, oursMin: 0.9, cached: false } });
    const enMsgs = await en.evaluate(() => window.__ffTxMsgs || []);
    ok("英文界面：X 的英文译文照样判，目标语言是 en，原文语言读对", JSON.stringify(enMsgs.map((m) => [m.id, m.target, m.srcLang]).sort()) === '[["5001","en","ja"],["5002","en","zh"]]',
      JSON.stringify(enMsgs.map((m) => [m.id, m.target, m.srcLang, m.source])));
    const e1 = await en.evaluate(() => { const a = document.querySelector('article[data-fid="5001"]'), b = a.querySelector(".ff-tx");
      return { block: !!b, label: b?.querySelector(".ff-tx-label").textContent, toggle: b?.querySelector(".ff-tx-toggle").textContent, title: b?.querySelector(".ff-tx-note").title,
        ours: b?.querySelector(".ff-tx-text").textContent }; });
    ok("英文界面：换上的说明和按钮是英文", e1.block && e1.label === "Improved translation" && e1.toggle === "Show Grok's version" &&
      /^Retranslated by openai\/gpt-6-luna/.test(e1.title) && e1.ours.startsWith("It's such nice weather"), JSON.stringify(e1));
    await en.evaluate(() => document.querySelector('article[data-fid="5001"] .ff-tx-toggle').click());
    await wait(200);
    const e2 = await en.evaluate(() => { const b = document.querySelector('article[data-fid="5001"] .ff-tx'); return [b.querySelector(".ff-tx-label").textContent, b.querySelector(".ff-tx-toggle").textContent]; });
    ok("英文界面：切回 Grok 版", JSON.stringify(e2) === JSON.stringify(["This is Grok's translation", "Show improved version"]), JSON.stringify(e2));
    await en.close();
    const ens = await openEn("?status", {});
    const ensMsgs = await ens.evaluate(() => window.__ffTxMsgs || []);
    ok("英文界面帖子页：主帖判 X 的译文，楼主的西班牙语回复补翻成英文，英文回复不翻",
      JSON.stringify(ensMsgs.map((m) => [m.type, m.id, m.target, m.srcLang]).sort()) === '[["translate","5101","en","es"],["translateFill","5102","en","es"]]',
      JSON.stringify(ensMsgs.map((m) => [m.type, m.id, m.target, m.srcLang])));
    const f2 = await ens.evaluate(() => { const b = document.querySelector('article[data-fid="5102"] .ff-tx');
      return b && [b.querySelector(".ff-tx-label").textContent, b.querySelector(".ff-tx-toggle").textContent, b.querySelector(".ff-tx-note").title]; });
    ok("英文界面：补翻的说明是英文", !!f2 && f2[0] === "Translated from Spanish by the extension" && f2[1] === "Show original" && /^X didn't translate this post/.test(f2[2]), JSON.stringify(f2));
    await ens.close();
    // 视野外先处理（0.13.11）：视野下面两屏、上面一屏以内的先处理，更远的不动
    {
      const base = process.argv[3] || "http://localhost:8767";
      const pg = await browser.newPage();
      await pg.setViewport({ width: 800, height: 800 });
      const asked = () => pg.evaluate(() => [...new Set((window.__ffTxMsgs || []).filter((m) => m.type === "translate").map((m) => m.id))]);
      await pg.goto(`${base}/fakex/translate.html?far=4000`, { waitUntil: "load" });
      await new Promise((r) => setTimeout(r, 2500));
      const top = await asked();
      await pg.goto(`${base}/fakex/translate.html?far=4000&start=bottom`, { waitUntil: "load" });
      await new Promise((r) => setTimeout(r, 2500));
      const bottom = await asked();
      ok("视野外先处理（X）：在最上面时，下面两屏以内的先处理、四千像素以下的不动；一打开就在底部时，上面一屏以内的先处理、最上面的不动",
        top.includes("1001") && top.includes("1002") && !top.includes("1006") && bottom.includes("1006") && !bottom.includes("1001"), JSON.stringify({ top, bottom }));
      await pg.close();
    }
  } catch (e) {
    out.push(`FAIL 运行出错 ${e.stack}`);
  } finally {
    await browser.close();
  }
  console.log(out.join("\n"));
  process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
})();
