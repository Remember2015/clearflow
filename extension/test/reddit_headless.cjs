// Reddit 上的折叠（不调任何接口）：仿新版 Reddit 的帖子页、帖子列表、搜索结果（test/fakex/reddit/，结构照真 Reddit 记下的）。
// 帖子页：拉人的、骂人的、色情的折，楼主自己的照样判（0.21.3），三个号刷同一句带"主页"的话按 D1 折，评论区广告不判；
// 折的只藏那条评论自己的正文和操作栏，作者那一行和下面的回复留着；展开、判错了；请求里带主帖和楼主；折掉的记给弹窗；弹窗问"这个页面"答得出。
// 帖子列表、搜索结果：拉人、色情、骂人的帖子整张卡片折起来，广告帖不判。折起来的卡片带正文摘要（服务端渲染的缩进换行）：
// 页面再变几次也一直折着、不重判（0.13.2 以前藏起来以后读到的字不一样，当成新内容先展开再折回去，一闪一闪）。
// 搜索结果里带正文摘要的那种（没有 data-thingid，0.13.12 以前不认）标题加摘要一起判；"媒体"那一栏色情的折起来，折叠条放在格子里面
// （不然折叠条自己变成瀑布流的一格）；评论那一栏还不管。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/reddit_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const JEV = encodeURIComponent(JSON.stringify({ "加我微信": 0.9 }));
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
    await page.setViewport({ width: 900, height: 1600 });

    await page.goto(`${BASE}/fakex/reddit/post.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(2500);
    const st = () => page.evaluate(() => {
      const r = {};
      for (const c of document.querySelectorAll("shreddit-comment")) {
        const id = c.getAttribute("thingid");
        const body = [...c.querySelectorAll('[slot="comment"]')].find((e) => e.closest("shreddit-comment") === c);
        const row = [...c.querySelectorAll('[slot="actionRow"]')].find((e) => e.closest("shreddit-comment") === c);
        const bar = body.previousElementSibling?.classList.contains("ff-bar") ? body.previousElementSibling : null;
        r[id] = { bar: bar ? bar.querySelector(".ff-reason").textContent : null, who: bar?.querySelector(".ff-who")?.textContent || null,
          bodyHidden: getComputedStyle(body).display === "none", rowHidden: getComputedStyle(row).display === "none",
          metaShown: getComputedStyle([...c.querySelectorAll('[slot="commentMeta"]')].find((e) => e.closest("shreddit-comment") === c)).display !== "none" };
      }
      return r;
    });
    let s = await st();
    ok("拉人的折成垃圾回复、骂人的折成辱骂、色情的折成色情", !!s.t1_r01.bar && !/辱骂|色情/.test(s.t1_r01.bar) && /辱骂/.test(s.t1_r02.bar || "") && /色情/.test(s.t1_r04.bar || ""),
      JSON.stringify(s));
    ok("楼主自己的照样判（0.21.3），这句没问题、不折；正常的不折", !s.t1_r05.bar && !s.t1_r09.bar && !s.t1_r03.bar, JSON.stringify([s.t1_r05, s.t1_r09, s.t1_r03]));
    ok("三个号刷同一句带\"主页\"的话：按 D1 折", ["t1_r06", "t1_r07", "t1_r08"].every((k) => /发了同一句话/.test(s[k].bar || "")), JSON.stringify([s.t1_r06, s.t1_r07]));
    ok("折的只藏正文和操作栏，作者那一行留着；折叠条上写着 u/账号", s.t1_r02.bodyHidden && s.t1_r02.rowHidden && s.t1_r02.metaShown && s.t1_r02.who === "u/hater_x", JSON.stringify(s.t1_r02));
    ok("骂人那条下面的回复照常显示", !s.t1_r03.bodyHidden, JSON.stringify(s.t1_r03));
    // 折起来的评论（两段、带服务端渲染的缩进换行）：页面再变几次也一直折着、不再发 Jev
    const cflips = await page.evaluate(async () => {
      const c = [...document.querySelectorAll("shreddit-comment")].find((x) => x.getAttribute("thingid") === "t1_r01");
      const body = [...c.querySelectorAll('[slot="comment"]')].find((e) => e.closest("shreddit-comment") === c), jev0 = (window.__ffJevAll || []).length;
      let n = 0, last = getComputedStyle(body).display;
      const mo = new MutationObserver(() => { const d = getComputedStyle(body).display; if (d !== last) { n++; last = d; } });
      mo.observe(body, { attributes: true, attributeFilter: ["style"] });
      for (let i = 0; i < 6; i++) { const d = document.createElement("div"); d.textContent = "x" + i; document.querySelector("shreddit-comment-tree").append(d); await new Promise((r) => setTimeout(r, 500)); }
      mo.disconnect();
      return { flips: n, hidden: getComputedStyle(body).display === "none", jevMore: (window.__ffJevAll || []).length - jev0 };
    });
    ok("折起来的评论（两段）：页面变了几次也一直折着，不闪、不再发 Jev", cflips.flips === 0 && cflips.hidden && cflips.jevMore === 0, JSON.stringify(cflips));
    const jev = await page.evaluate(() => window.__ffLastJev);
    const sent = await page.evaluate(() => (window.__ffLog || []).length);
    ok("请求里带上主帖（标题 + 正文）和楼主", /合成帖子：大家怎么看这件事/.test(jev?.post || "") && /随便聊聊/.test(jev?.post || "") && jev?.author?.handle === "u/op_user" && jev?.postId === "r:t3_abc123",
      JSON.stringify([jev?.post, jev?.author, jev?.postId]));
    ok("评论区广告不发 Jev（本地就认出来了）；楼主的照样发（0.21.3，用户：作者的评论也得过滤）", (jev?.replies || []).some((x) => x.id === "t1_r05") && !(jev?.replies || []).some((x) => /广告/.test(x.text)), JSON.stringify((jev?.replies || []).map((x) => x.id)) + sent);
    // 这一页的记号：0.28.5 起不再给后台发"最近清理"的记录，改看发给 Jev 的请求里的 postId
    ok("只问用得上的（0.29.14）：Reddit 帖子页五问全问（不带 keys）", !!jev && !jev.keys, JSON.stringify(jev?.keys));
    const keys = await page.evaluate(() => [...new Set((window.__ffJevAll || []).map((m) => m.postId))]);
    ok("这一页记成 r:t3_abc123（发给 Jev 的请求里）", JSON.stringify(keys) === JSON.stringify(["r:t3_abc123"]), JSON.stringify(keys));
    let sum = await page.evaluate(summary);
    ok("弹窗问这个页面：Reddit 的帖子页、三类加 D1", sum && sum.kind === "status" && sum.site === "reddit" && sum.folds.spam === 4 && sum.folds.abuse === 1 && sum.folds.sexual === 1, JSON.stringify(sum));
    // 展开、判错了
    await page.evaluate(() => [...document.querySelectorAll(".ff-bar")].find((b) => b.dataset.ffId === "t1_r02").click());
    await wait(200);
    s = await st();
    ok("点折叠条展开：正文和操作栏露出来", !s.t1_r02.bodyHidden && !s.t1_r02.rowHidden && !!s.t1_r02.bar, JSON.stringify(s.t1_r02));
    await page.evaluate(() => [...document.querySelectorAll(".ff-bar")].find((b) => b.dataset.ffId === "t1_r02").querySelector('button[aria-label^="判错了"]').click());
    await wait(600);
    s = await st();
    const ov = await page.evaluate(() => chrome.storage.local._d["ff_reply_override:t1_r02"]);
    ok("判错了：存成纠错、这条不再折", !s.t1_r02.bar && !s.t1_r02.bodyHidden && ov?.label === "fp", JSON.stringify([s.t1_r02, ov]));

    // 帖子列表
    await page.goto(`${BASE}/fakex/reddit/feed.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(2500);
    const fs = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("shreddit-feed shreddit-post")].map((p) => {
      const bar = p.previousElementSibling?.classList.contains("ff-bar") ? p.previousElementSibling : null;
      return [p.id, { bar: bar ? bar.querySelector(".ff-reason").textContent : null, hidden: getComputedStyle(p).display === "none" }];
    })));
    ok("帖子列表：拉人帖、色情帖整张卡片折起来，正常的不折", fs.t3_f2.bar && fs.t3_f2.hidden && /色情/.test(fs.t3_f3.bar || "") && fs.t3_f3.hidden && !fs.t3_f1.bar && !fs.t3_f1.hidden, JSON.stringify(fs));
    const fj = await page.evaluate(() => window.__ffLastJev);
    ok("帖子列表：请求里说明是帖子列表、不带作者；广告帖不判", /Reddit feed/.test(fj?.post || "") && !fj?.author && fj?.postId === "r:feed" && !(fj?.replies || []).some((x) => /买它/.test(x.text)), JSON.stringify([fj?.post, fj?.postId]));
    ok("只问用得上的（0.29.14）：Reddit 帖子列表只问引流、辱骂、色情", JSON.stringify(fj?.keys) === JSON.stringify(["benefit", "abuse", "sexual"]), JSON.stringify(fj?.keys));
    ok("帖子列表：每条多问 own_work（0.29.15）", (fj?.replies || []).length > 0 && fj.replies.every((x) => (x.ask || []).includes("own_work")), JSON.stringify((fj?.replies || []).map((x) => x.ask)));
    // 作者分享自己做的东西（own_work 高）引流给高分也不折；推加微信的照样折（0.29.15）
    await page.goto(`${BASE}/fakex/reddit/feed.html?jev=${encodeURIComponent(JSON.stringify({ "加我微信": 0.9, "今天的合成日常分享": { benefit: 0.9, own_work: 0.95 } }))}`, { waitUntil: "load" });
    await wait(2500);
    const fo = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("shreddit-feed shreddit-post")].map((p) => [p.id, !!(p.previousElementSibling?.classList.contains("ff-bar"))])));
    ok("帖子列表：作者分享自己做的东西（own_work 0.95）引流 0.9 也不折，推加微信的照样折", fo.t3_f1 === false && fo.t3_f2 === true, JSON.stringify(fo));
    sum = await page.evaluate(summary);
    ok("弹窗问这个页面：帖子列表", sum && sum.kind === "feed" && sum.folds.spam === 1 && sum.folds.sexual === 1, JSON.stringify(sum));
    const flips = await page.evaluate(async () => {
      const p = document.getElementById("t3_f2"), jev0 = (window.__ffJevAll || []).length;
      let n = 0, last = getComputedStyle(p).display;
      const mo = new MutationObserver(() => { const d = getComputedStyle(p).display; if (d !== last) { n++; last = d; } });
      mo.observe(p, { attributes: true, attributeFilter: ["style"] });
      for (let i = 0; i < 6; i++) { const d = document.createElement("div"); d.textContent = "x" + i; document.querySelector("shreddit-feed").append(d); await new Promise((r) => setTimeout(r, 500)); }
      mo.disconnect();
      const sent = (window.__ffJevAll || []).flatMap((m) => m.replies).find((x) => x.id === "t3_f2");
      return { flips: n, hidden: getComputedStyle(p).display === "none", jevMore: (window.__ffJevAll || []).length - jev0, text: sent && sent.text };
    });
    ok("折起来的卡片（带摘要）：页面变了几次也一直折着，不闪、不再发 Jev", flips.flips === 0 && flips.hidden && flips.jevMore === 0, JSON.stringify(flips));
    ok("卡片的字：标题加摘要，段落之间空一行（不带服务端渲染的缩进）", flips.text === "加我微信领资料，名额有限\n第一段合成文字，资料很全。\n\n第二段：名额有限，先到先得。", JSON.stringify(flips.text));

    // 帖子列表里的是帖子不是回复："伪装成普通评论的广告""在 @ 别人做推广"给高分也不折（实测：新闻标题、电影海报被折过），只看"引流"
    await page.goto(`${BASE}/fakex/reddit/feed.html?jev=${encodeURIComponent(JSON.stringify({ "加我微信": 0.9, "今天的合成日常分享": { disguised: 0.8, promo_mention: 0.8 } }))}`, { waitUntil: "load" });
    await wait(2500);
    const fs2 = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("shreddit-feed shreddit-post")].map((p) => [p.id, !!p.previousElementSibling?.classList.contains("ff-bar")])));
    ok("帖子列表：只有\"伪装成普通评论的广告\"高的帖子不折，拉人的照样折", !fs2.t3_f1 && fs2.t3_f2, JSON.stringify(fs2));
    // 评论区的评论：三问都照常用
    await page.goto(`${BASE}/fakex/reddit/post.html?jev=${encodeURIComponent(JSON.stringify({ "加我微信": 0.9, "Interesting point": { disguised: 0.8 } }))}`, { waitUntil: "load" });
    await wait(2500);
    const c9 = await page.evaluate(() => { const c = [...document.querySelectorAll("shreddit-comment")].find((x) => x.getAttribute("thingid") === "t1_r09");
      const body = [...c.querySelectorAll('[slot="comment"]')].find((e) => e.closest("shreddit-comment") === c);
      return body.previousElementSibling?.classList.contains("ff-bar") ? body.previousElementSibling.querySelector(".ff-reason").textContent : null; });
    ok("评论区的评论：\"伪装成普通评论的广告\"给高分照样折", /伪装成普通评论的广告/.test(c9 || ""), String(c9));

    // 网址不认识、但页面里是 Reddit 标准帖子列表的（/news/）：照帖子列表管
    await page.goto(`${BASE}/fakex/reddit/news.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(2500);
    const ns = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("shreddit-feed shreddit-post")].map((p) => [p.id, !!(p.previousElementSibling?.classList.contains("ff-bar"))])));
    sum = await page.evaluate(summary);
    ok("/news/ 这类页面（网址不认识、里面是标准帖子列表）：拉人的帖子折起来，弹窗当帖子列表答", ns.t3_n2 && !ns.t3_n1 && sum && sum.kind === "feed" && sum.folds.spam === 1,
      JSON.stringify([ns, sum]));
    ok("/news/ 这一页的记号是 rf:news（和首页、版块分开）", sum && sum.key === "rf:news", JSON.stringify(sum && sum.key));

    // 年度帖子页（/posts/2026/global/，"Reddit 最佳"）：不是 shreddit-post，一张张卡片；拉人的整张卡片折起来
    await page.goto(`${BASE}/fakex/reddit/posts.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(2500);
    const yc = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".i18n-list-item-post-content")].map((x) => {
      const card = x.closest(".py-md");
      return [x.getAttribute("post-id"), { bar: !!card.previousElementSibling?.classList.contains("ff-bar"), hidden: getComputedStyle(card).display === "none" }];
    })));
    sum = await page.evaluate(summary);
    ok("年度帖子页：拉人的整张卡片（版块、标题、缩略图、票数一起）折起来，别的不折；这一页记成 rf:posts-2026-global",
      yc.t3_y2.bar && yc.t3_y2.hidden && !yc.t3_y1.bar && !yc.t3_y1.hidden && !yc.t3_y3.bar && sum && sum.kind === "feed" && sum.folds.spam === 1 &&
      sum.key === "rf:posts-2026-global", JSON.stringify([yc, sum]));

    // 搜索结果
    await page.goto(`${BASE}/fakex/reddit/search.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(2500);
    const ss = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("search-telemetry-tracker[data-thingid]")].map((u) => {
      const bar = u.previousElementSibling?.classList.contains("ff-bar") ? u.previousElementSibling : null;
      return [u.dataset.thingid, { bar: bar ? bar.querySelector(".ff-reason").textContent : null, hidden: getComputedStyle(u).display === "none" }];
    })));
    ok("搜索结果：骂人的、拉人的折，正常的不折", /辱骂/.test(ss.t3_s2.bar || "") && ss.t3_s2.hidden && !!ss.t3_s3.bar && !ss.t3_s1.bar, JSON.stringify(ss));
    const pv = await page.evaluate(() => {
      const r = {};
      for (const id of ["s4", "s5"]) {
        const u = document.getElementById(`search-post-title-t3_${id}`).closest("search-telemetry-tracker[view-events]");
        const bar = u.previousElementSibling?.classList.contains("ff-bar") ? u.previousElementSibling : null;
        r[id] = { bar: bar ? bar.querySelector(".ff-reason").textContent : null, hidden: getComputedStyle(u).display === "none" };
      }
      r.sent = (window.__ffJevAll || []).flatMap((m) => m.replies).filter((x) => x.id === "t3_s4").map((x) => x.text);
      return r;
    });
    pv.key = (await page.evaluate(summary))?.key;
    ok("搜索结果里带摘要的那种（没有 data-thingid）：标题加摘要一起判，摘要里拉人的整条折起来，正常的不折；这一页还是 rs:fake",
      /拉人/.test(pv.s4.bar || "") && pv.s4.hidden && !pv.s5.bar && !pv.s5.hidden && pv.sent.length >= 1 && pv.sent.every((x) => x === "分享一份合成的学习资料\n资料在这里，加我微信领资料，名额有限") &&
      pv.key === "rs:fake", JSON.stringify(pv));
    sum = await page.evaluate(summary);
    ok("弹窗问这个页面：搜索结果", sum && sum.kind === "search" && sum.folds.abuse === 1 && sum.folds.spam === 2, JSON.stringify(sum));

    // 搜索的"媒体"那一栏：色情的折起来，折叠条放在格子里面，格子里的内容藏起来；别的不折
    await page.goto(`${BASE}/fakex/reddit/search_media.html`, { waitUntil: "load" });
    await wait(2500);
    const md = await page.evaluate(() => {
      const r = {};
      for (const c of document.querySelectorAll("search-media-feed > search-telemetry-tracker")) {
        const inner = c.querySelector(":scope > [data-id]"), bar = c.querySelector(":scope > .ff-bar");
        r[inner.dataset.id] = { bar: bar ? bar.querySelector(".ff-reason").textContent : null, barFirst: c.firstElementChild === bar, hidden: getComputedStyle(inner).display === "none" };
      }
      r.gridBars = document.querySelectorAll("search-media-feed > .ff-bar").length;
      return r;
    });
    md.key = (await page.evaluate(summary))?.key;
    ok("媒体那一栏：色情的折起来，折叠条在格子里面（不变成瀑布流的一格）、格子里的内容藏起来，别的不折；这一页记成 rs:media/idol",
      /色情/.test(md.t3_w4.bar || "") && md.t3_w4.barFirst && md.t3_w4.hidden && md.gridBars === 0 && ["t3_w1", "t3_w2", "t3_w3", "t3_w5", "t3_w6"].every((id) => !md[id].bar && !md[id].hidden) &&
      md.key === "rs:media/idol", JSON.stringify(md));
    await page.evaluate(() => document.querySelector("search-media-feed .ff-bar").click());
    await wait(200);
    const opened = await page.evaluate(() => getComputedStyle(document.querySelector('[data-id="t3_w4"]')).display !== "none");
    ok("媒体那一栏：点折叠条展开", opened, String(opened));
    sum = await page.evaluate(summary);
    ok("弹窗问这个页面：媒体那一栏", sum && sum.kind === "search" && sum.folds.sexual === 1 && sum.seen === 6, JSON.stringify(sum));
    // 评论那一栏还不管（一条是评论，按帖子认会认错）：换到 type=comments，这一页的折叠条都撤掉、认不出结果
    await page.evaluate(() => history.pushState({}, "", "/search/?q=idol&type=comments"));
    await wait(1200);
    const cm = await page.evaluate(() => ({ units: FFRD.searchUnits().length, bars: document.querySelectorAll(".ff-bar").length }));
    sum = await page.evaluate(summary);
    ok("搜索的评论那一栏先不管：认不出结果、不折", cm.units === 0 && cm.bars === 0 && sum && sum.kind === "other", JSON.stringify([cm, sum]));
    // 评测记录（0.16–0.23）去掉了：旧设置里还开着 evalRecord 也不发
    const ep = await browser.newPage();
    await ep.evaluateOnNewDocument(() => { window.__ffSeed = { ff_settings: { evalRecord: true } }; });
    await ep.goto(`${BASE}/fakex/reddit/post.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(2500);
    ok("评测记录去掉了：旧设置里开着也不发", (await ep.evaluate(() => (window.__ffEval || []).length)) === 0);
    await ep.close();
  } catch (e) {
    out.push(`FAIL 运行出错 ${e.stack}`);
  }
  await browser.close();
  console.log(out.join("\n"));
  process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
})();
