// 看回复里的图片（0.18，设置里默认关）：X、小红书、Reddit 三个站点，内容脚本有没有把回复里的图交给后台（替身 Jev 收到的消息里有没有 images）。
// 仿页面里的图（pbs.twimg.com、xhscdn、preview.redd.it）全在这里拦下来回一张假图，不出网。替身 Jev：?jevimg=0.9 给带图的回复 benefit 0.9。
// - 关着（默认）：消息里没有 images；只有图没写字的不判、不发；短英文 + 图（"lol"）按字判，被短文本豁免。
// - 开着：有字有图的连图网址一起发；只有图的也发（text 是空的）；只有字的照旧；"lol" + 图不再被短文本豁免、按分折；
//   X 上引用卡片里别人帖子的图不算；打开以后带图的重问一次。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/images_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 0.22.1 起连着 3 条以上被折的合成一条：这里测的是一条条的折叠条，先把合起来的都点开（和用户点开一样）
const openGroups = async (pg) => { await pg.evaluate(() => document.querySelectorAll('.ff-group[aria-expanded="false"]').forEach((b) => b.click())); await new Promise((r) => setTimeout(r, 300)); };
// 1×1 的 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const IMG_HOST = /^https?:\/\/(pbs\.twimg\.com|[\w-]+\.xhscdn\.com|preview\.redd\.it|i\.redd\.it)\//;
const sent = () => {
  const all = (window.__ffJevAll || []).flatMap((m) => m.replies);
  return Object.fromEntries(all.map((r) => [r.id, { text: r.text, images: r.images || null }]));
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    const open = async (url, images, settle = 3500) => {
      const page = await browser.newPage();
      page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
      await page.setRequestInterception(true);
      page.on("request", (r) => (IMG_HOST.test(r.url()) ? r.respond({ status: 200, contentType: "image/png", body: PNG }) : r.continue()));
      if (images) await page.evaluateOnNewDocument(() => { window.__ffSeed = { ff_settings: { images: true } }; });
      await page.setViewport({ width: 1200, height: 2000 });
      await page.goto(url, { waitUntil: "load" });
      await wait(settle);
      await openGroups(page);
      return page;
    };
    const bars = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((a) => !!a.querySelector(".ff-bar") || !!a.previousElementSibling?.classList?.contains("ff-bar")), sel);

    // ---------- X ----------
    for (const images of [false, true]) {
      const page = await open(`${BASE}/fakex/status/7001/?jevimg=0.9`, images);
      const s = await page.evaluate(sent);
      const lolBar = await page.evaluate(() => { const a = [...document.querySelectorAll("article")].find((x) => x.querySelector('a[href$="/status/7103"]')); return !!(a && (a.querySelector(".ff-bar") || a.closest("[data-testid=cellInnerDiv]")?.querySelector(".ff-bar"))); });
      if (!images) {
        ok("X 看图片关着：消息里没有图；只有图的不发；lol + 图按字判（短文本豁免，不折）", s["7101"] && !s["7101"].images && !s["7102"] && s["7103"] && !s["7103"].images && !lolBar,
          JSON.stringify({ s, lolBar }));
      } else {
        ok("X 看图片开着：有字有图的连图网址一起发、只有图的也发（text 空）、只有字的照旧",
          JSON.stringify(s["7101"]?.images) === '["https://pbs.twimg.com/media/FAKE_A.jpg"]' && s["7102"]?.text === "" && JSON.stringify(s["7102"]?.images) === '["https://pbs.twimg.com/media/FAKE_B.jpg"]' &&
          s["7104"] && !s["7104"].images, JSON.stringify(s));
        ok("X 看图片开着：lol + 图不再被短文本豁免，按分（0.9）折", lolBar, JSON.stringify(s["7103"]));
      }
      await page.close();
    }
    // 开着页面中途打开看图片：带图的重问一次（连图）
    {
      const page = await open(`${BASE}/fakex/status/7001/?jevimg=0.9`, false);
      await page.evaluate(() => chrome.storage.local.set({ ff_settings: { images: true } }));
      await wait(2500);
      const s = await page.evaluate(sent);
      ok("X 中途打开看图片：带图的重问一次（这回带图），只有图的也补上", JSON.stringify(s["7101"]?.images) === '["https://pbs.twimg.com/media/FAKE_A.jpg"]' && s["7102"]?.images?.length === 1, JSON.stringify(s));
      await page.close();
    }

    // ---------- 小红书 ----------
    for (const images of [false, true]) {
      const page = await open(`${BASE}/fakex/xhs/note_img.html?jevimg=0.9`, images);
      const s = await page.evaluate(sent);
      const k = (n) => "xh_6f20000000000000000c000" + n;
      const folded = await page.evaluate(() => [...document.querySelectorAll(".comment-item")].map((c) => [c.id.slice(-1), !!c.querySelector(".ff-bar"),
        getComputedStyle(c.querySelector(".comment-picture") || document.body).display === "none"]));
      if (!images) {
        ok("小红书 看图片关着：配图不发；只有配图的不判", s[k(1)] && !s[k(1)].images && !s[k(2)] && s[k(3)], JSON.stringify(s));
      } else {
        ok("小红书 看图片开着：配图网址一起发（http 的 xhscdn）、只有配图的也发", JSON.stringify(s[k(1)]?.images) === '["http://sns-webpic-qc.xhscdn.com/fake/m1"]' &&
          s[k(2)]?.text === "" && s[k(2)]?.images?.length === 1 && s[k(3)] && !s[k(3)].images, JSON.stringify(s));
        ok("小红书 只有配图的按分折：配图藏起来", JSON.stringify(folded.find((x) => x[0] === "2")) === '["2",true,true]', JSON.stringify(folded));
      }
      await page.close();
    }

    // ---------- Reddit ----------
    for (const images of [false, true]) {
      const page = await open(`${BASE}/fakex/reddit/post_img.html`, images);
      const s = await page.evaluate(sent);
      if (!images) ok("Reddit 看图片关着：评论里的图不发；只有图的不判", s.t1_i1 && !s.t1_i1.images && !s.t1_i2 && s.t1_i3, JSON.stringify(s));
      else ok("Reddit 看图片开着：评论里的图网址一起发、只有图的也发", JSON.stringify(s.t1_i1?.images) === '["https://preview.redd.it/fake_i1.jpg"]' &&
        s.t1_i2?.text === "" && s.t1_i2?.images?.length === 1 && s.t1_i3 && !s.t1_i3.images, JSON.stringify(s));
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(out.join("\n"));
  const fails = out.filter((l) => !l.startsWith("PASS")).length;
  console.log(fails ? `${fails} 项没过` : `全过（${out.length} 项）`);
  process.exit(fails ? 1 : 0);
})();
