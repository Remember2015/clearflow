// 求推荐帖和 setup（0.15.3，不调任何接口）：帖子页先问 Jev 一句"这个帖子是不是在请大家推荐"（替身里网址加 ?rec=0.95 就是），
// 是的话垃圾回复的门槛换成求推荐类帖子的阈值 0.9（折叠条上只写理由、不写分）；那一问没回来之前不按普通阈值先折（?recDelay=毫秒，回来以后也不折，不闪）；
// 回复多问 setup，门槛比阈值高 0.1（disguised 也高 0.1，0.15.4）；搜索结果这种列表页两样都不问。X（fakex/status/135）和 Reddit（fakex/reddit/post.html）各看一遍；
// YouTube 不问帖子那一问（0.15.4）。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/rec_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const J = (o) => encodeURIComponent(JSON.stringify(o));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 900, height: 1600 });
    const go = async (url, ms = 2500) => { await page.goto(url, { waitUntil: "load" }); await wait(ms); };
    const xBar = (id) => page.evaluate((id) => {
      const a = [...document.querySelectorAll('article[data-testid="tweet"]')].find((x) => x.querySelector(`a[href*="/status/${id}"]`));
      const b = a?.previousElementSibling;
      return b && b.classList.contains("ff-bar") ? b.querySelector(".ff-reason").textContent : null;
    }, id);
    const sent = () => page.evaluate(() => ({ post: window.__ffJevPost || [], extra: (window.__ffJevAll || []).map((m) => m.extra || null) }));

    // ---- X 帖子页 ----
    await go(`${BASE}/fakex/status/135/?jev=${J({ "医保很重要": 0.7 })}`);
    ok("X 普通帖子：0.7 的回复按阈值 0.6 折", /拉人/.test((await xBar("945")) || ""), String(await xBar("945")));
    let s = await sent();
    ok("X 帖子页问了一次帖子那一问（带帖子原文和作者），回复的请求都多问 setup", s.post.length === 1 && s.post[0].postId === "135" && !!s.post[0].post &&
      !!s.post[0].author?.handle && s.extra.length > 0 && s.extra.every((e) => JSON.stringify(e) === '["setup"]'), JSON.stringify(s).slice(0, 300));
    await go(`${BASE}/fakex/status/135/?rec=0.95&jev=${J({ "医保很重要": 0.7 })}`);
    ok("X 求推荐帖：同样 0.7 的不折（门槛 0.9）", !(await xBar("945")), String(await xBar("945")));
    await go(`${BASE}/fakex/status/135/?rec=0.95&jev=${J({ "医保很重要": 0.93 })}`);
    ok("X 求推荐帖：0.93 的照样折", /拉人/.test((await xBar("945")) || ""), String(await xBar("945")));
    await page.goto(`${BASE}/fakex/status/135/?rec=0.95&recDelay=2000&jev=${J({ "医保很重要": 0.7 })}`, { waitUntil: "load" });
    await wait(1200);
    const early = await xBar("945");
    await wait(2200);
    const late = await xBar("945"), flicker = await page.evaluate(() => (window.__ffFolded || []).some((x) => x.id === "945"));
    ok("X：帖子那一问没回来之前不按普通阈值先折，回来以后也不折（不闪）", !early && !late && !flicker, JSON.stringify([early, late, flicker]));
    await go(`${BASE}/fakex/status/135/?jev=${J({ "医保很重要": { setup: 0.75 } })}`);
    ok("X：setup 0.75（阈值 0.6 + 0.1）折，理由写\"像是骗局的套路\"", (await xBar("945")) === "像是骗局的套路", String(await xBar("945")));
    await go(`${BASE}/fakex/status/135/?jev=${J({ "医保很重要": { setup: 0.65 } })}`);
    ok("X：setup 0.65 不到门槛不折", !(await xBar("945")), String(await xBar("945")));
    await go(`${BASE}/fakex/status/135/?jev=${J({ "医保很重要": { disguised: 0.65 } })}`);
    ok("X：\"伪装成普通评论的推广\"0.65（阈值 0.6 + 0.1，0.15.4）不折", !(await xBar("945")), String(await xBar("945")));
    await go(`${BASE}/fakex/status/135/?jev=${J({ "医保很重要": { disguised: 0.75 } })}`);
    ok("X：\"伪装成普通评论的推广\"0.75 折", /伪装/.test((await xBar("945")) || ""), String(await xBar("945")));
    await go(`${BASE}/fakex/search.html`);
    s = await sent();
    ok("X 搜索结果：不问帖子那一问，也不多问 setup", s.post.length === 0 && s.extra.length > 0 && s.extra.every((e) => e === null), JSON.stringify(s).slice(0, 300));

    // ---- Reddit 帖子页（折叠引擎，HN、YouTube 同一套）----
    const rBar = (id) => page.evaluate((id) => {
      const c = document.querySelector(`shreddit-comment[thingid="${id}"]`);
      const body = [...c.querySelectorAll('[slot="comment"]')].find((e) => e.closest("shreddit-comment") === c);
      const b = body.previousElementSibling;
      return b?.classList.contains("ff-bar") ? b.querySelector(".ff-reason").textContent : null;
    }, id);
    await go(`${BASE}/fakex/reddit/post.html?jev=${J({ "Interesting point": 0.7 })}`);
    ok("Reddit 普通帖子：0.7 的评论按阈值 0.6 折", /拉人/.test((await rBar("t1_r09")) || ""), String(await rBar("t1_r09")));
    s = await sent();
    ok("Reddit 帖子页问了一次帖子那一问，评论的请求都多问 setup", s.post.length === 1 && /^r:/.test(s.post[0].postId) && !!s.post[0].post &&
      s.extra.length > 0 && s.extra.every((e) => JSON.stringify(e) === '["setup"]'), JSON.stringify(s).slice(0, 300));
    await go(`${BASE}/fakex/reddit/post.html?rec=0.95&jev=${J({ "Interesting point": 0.7 })}`);
    ok("Reddit 求推荐帖：同样 0.7 的不折（以前 Reddit 上没有这一条）", !(await rBar("t1_r09")), String(await rBar("t1_r09")));
    await page.goto(`${BASE}/fakex/reddit/post.html?rec=0.95&recDelay=2000&jev=${J({ "Interesting point": 0.7 })}`, { waitUntil: "load" });
    await wait(1200);
    const rEarly = await rBar("t1_r09");
    await wait(2200);
    const rLate = await rBar("t1_r09");
    ok("Reddit：帖子那一问没回来之前也不先折", !rEarly && !rLate, JSON.stringify([rEarly, rLate]));
    await go(`${BASE}/fakex/reddit/post.html?jev=${J({ "Interesting point": { setup: 0.75 } })}`);
    ok("Reddit：setup 0.75 折，理由写\"像是骗局的套路\"", (await rBar("t1_r09")) === "像是骗局的套路", String(await rBar("t1_r09")));

    // ---- YouTube：不问帖子那一问（0.15.4；抽样的 170 个视频没有一个是求推荐的），评论照常多问 setup ----
    await go(`${BASE}/fakex/yt/watch.html`, 3000);
    s = await sent();
    ok("YouTube 视频页：不问帖子那一问，评论的请求照常多问 setup", s.post.length === 0 && s.extra.length > 0 && s.extra.every((e) => JSON.stringify(e) === '["setup"]'), JSON.stringify(s).slice(0, 300));
  } catch (e) {
    out.push(`FAIL 运行出错 ${e.stack}`);
  }
  await browser.close();
  console.log(out.join("\n"));
  process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
})();
