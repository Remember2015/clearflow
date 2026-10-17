// Renders the Chrome Web Store images into docs/store/assets/: five 1280×800 screenshots per listing language in <locale>/
// (English, Simplified and Traditional Chinese, Japanese, Korean) and the 440×280 promo tile (one for all languages: the store can't
// localize it), plus the 300×300 PNG logo Edge Add-ons asks for. Screenshots and tile are JPEG, no alpha. Everything shown is the real extension running on showcase pages with invented posts and comments
// (scripts/showcase.mjs) — X, Reddit, YouTube, marking one spam reply on Reddit — plus the real popup and settings page.
// Needs Google Chrome (CHROME_PATH) and `npm run setup`.
// Usage: node scripts/store-assets.mjs [output dir] [--raw] [--locales ja,ko]   (--raw also keeps the unframed shots)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { pages, LOCALES, fontOf } from "./showcase.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const EXT = path.join(ROOT, "extension"), UI = path.join(ROOT, "ui");
const OUT = path.resolve(ROOT, process.argv.slice(2).find((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--locales") || "docs/store/assets");
const RAW = process.argv.includes("--raw");
const ONLY = process.argv.includes("--locales") ? process.argv[process.argv.indexOf("--locales") + 1].split(",") : LOCALES;
const SYS_LANG = { en: "en_US", "zh-CN": "zh_CN", "zh-TW": "zh_TW", ja: "ja_JP", ko: "ko_KR" };
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const puppeteer = createRequire(import.meta.url)(path.join(UI, "node_modules/puppeteer-core"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
execFileSync("python3", ["test/build_inject_bundle.py"], { cwd: EXT, stdio: "ignore" });

const COPY = {
  en: { brand: "ClearFlow", tagline: "Cleaner comment sections,<br>in your language.",
    x: ["Junk replies, cleaned up", "Bots, spam, abuse and sexual replies are hidden — each says why. Runs of them merge into one line, and replies like “nice” or “+1” are tucked away."],
    reddit: ["Read every thread in your language", "Posts and comments in Japanese, German, Spanish, Chinese, French or Portuguese are translated in place. One click shows the original."],
    yt: ["Scam threads,<br>gone", "Fake “mentor” testimonials on YouTube are cleaned up, while comments in Korean, Portuguese, Hindi, Arabic or Japanese are translated for you."],
    mark: ["Mark one, the rest go", "Hide a spam reply yourself and ClearFlow learns from it: replies of the same kind — reworded, from other accounts, pushing the same scheme — are hidden too. Undo anytime."],
    ui: ["Your sites, your rules", "See what was cleaned on each page, turn ClearFlow on or off per site, and choose how strict each category is."] },
  "zh-CN": { brand: "清流",
    x: ["评论区，清清爽爽", "机器人、引流、辱骂、色情回复都清理掉，每条写明原因；连着的一串合成一条，「赞」「mark」这类也收起来。"],
    reddit: ["外文讨论，读成中文", "日语、德语、西班牙语、韩语、法语、葡萄牙语的帖子和评论原位置翻成中文，点一下就能看原文。"],
    yt: ["骗局评论，一扫而空", "YouTube 上冒充“导师”的托儿评论被清理掉，韩语、葡萄牙语、印地语、西班牙语、日语的评论翻成中文给你看。"],
    mark: ["标一条，同类都清理", "手动清理一条垃圾，清流就记住它：换了说法、换了账号、推同一套骗局的回复，以后也清理掉。随时能撤销。"],
    ui: ["每个网站，各自做主", "看这一页清理了什么，按网站开关清流，每一类清理得多严自己定。"] },
  "zh-TW": { brand: "清流",
    x: ["留言區，清清爽爽", "機器人、引流、辱罵、色情回覆都清理掉，每則寫明原因；連著的一串合成一條，「讚」「mark」這類也收起來。"],
    reddit: ["外文討論，讀成中文", "日文、德文、西班牙文、韓文、法文、葡萄牙文的貼文和留言原地翻成中文，點一下就能看原文。"],
    yt: ["詐騙留言，一掃而空", "YouTube 上冒充「導師」的假見證被清理掉，韓文、葡萄牙文、印地文、西班牙文、日文的留言翻成中文給你看。"],
    mark: ["標一則，同類都清理", "手動清理一則垃圾留言，清流就記住它：換了說法、換了帳號、推同一套騙局的留言，以後也清理掉。隨時能復原。"],
    ui: ["每個網站，各自做主", "看這一頁清理了什麼，按網站開關清流，每一類清理得多嚴自己決定。"] },
  ja: { brand: "ClearFlow",
    x: ["返信欄を、すっきりと", "ボット・スパム・誹謗中傷・性的な返信を非表示にして、それぞれ理由を表示。続けて並んだものは1行にまとめ、「いいね」「+1」だけの返信もたたみます。"],
    reddit: ["海外の議論も、日本語で", "英語・ドイツ語・スペイン語・韓国語・フランス語・ポルトガル語の投稿とコメントを、その場で日本語に。ワンクリックで原文に戻せます。"],
    yt: ["詐欺コメントを、一掃", "YouTubeで「メンター」を装ったサクラのコメントを片付け、韓国語・ポルトガル語・ヒンディー語・スペイン語・英語のコメントは日本語に翻訳します。"],
    mark: ["マークすれば、<br>同類も片付く", "スパムを自分で非表示にすると、ClearFlowが学習。言い回しやアカウントを変えて同じ手口を勧める返信も、今後は片付けます。いつでも取り消せます。"],
    ui: ["サイトごとに、自分で決める", "このページで何を片付けたかを確認でき、サイトごとにオン・オフ、項目ごとに厳しさを選べます。"] },
  ko: { brand: "ClearFlow",
    x: ["댓글창을 깔끔하게", "봇·스팸·욕설·음란 답글을 숨기고, 각각 이유를 보여줍니다. 연달아 숨긴 건 한 줄로 묶고, ‘좋아요’ ‘+1’ 같은 답글도 접어 둡니다."],
    reddit: ["해외 토론도 한국어로", "영어·독일어·스페인어·일본어·프랑스어·포르투갈어 글과 댓글을 그 자리에서 한국어로 번역합니다. 한 번 누르면 원문이 보여요."],
    yt: ["사기 댓글은 싹 정리", "YouTube에서 ‘멘토’를 사칭한 바람잡이 댓글은 정리하고, 포르투갈어·힌디어·스페인어·일본어 댓글은 한국어로 번역합니다."],
    mark: ["한 번 표시하면 비슷한 것도 정리", "스팸 답글을 직접 숨기면 ClearFlow가 배웁니다. 말이나 계정을 바꿔 같은 수법을 미는 답글도 앞으로 정리해요. 언제든 되돌릴 수 있어요."],
    ui: ["사이트마다 내 마음대로", "이 페이지에서 무엇을 정리했는지 보고, 사이트별로 켜고 끄고, 항목마다 얼마나 엄격할지 고릅니다."] },
};

const b64 = (buf) => `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
const ICON = b64(fs.readFileSync(path.join(EXT, "icons/icon-128.png")));
// frame: caption on the left, one or two shots on the right
async function frame(browser, file, { brand, title, sub, shots, loc }) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  const imgs = shots.map((s) => `<img src="${b64(s.png)}" style="width:${s.w}px">`).join("");
  await page.setContent(`<!doctype html><html lang="${loc}"><head><meta charset="utf-8"><style>
    body{margin:0;width:1280px;height:800px;overflow:hidden;background:linear-gradient(135deg,#eef3fd 0%,#dfe9fb 100%);font-family:-apple-system,"Segoe UI",Roboto,${fontOf(loc)},sans-serif;display:flex;align-items:center;gap:48px;padding:0 64px;box-sizing:border-box}
    .cap{flex:0 0 360px;color:#0b1b3f;word-break:${{ ja: "auto-phrase", ko: "keep-all" }[loc] || "normal"}} h1{font-size:42px;line-height:1.15;margin:0 0 20px;letter-spacing:-.4px;text-wrap:balance} p{font-size:20px;line-height:1.55;margin:0;color:#3c4a63;text-wrap:pretty}
    .brand{display:flex;align-items:center;gap:10px;margin-bottom:34px;font-weight:700;font-size:20px;color:#0b57d0} .brand img{width:36px;height:36px}
    .shot{flex:1;display:flex;justify-content:center;align-items:center;gap:20px} .shot img{max-height:700px;object-fit:cover;object-position:top;border-radius:16px;box-shadow:0 20px 50px rgba(11,27,63,.18),0 2px 6px rgba(11,27,63,.08);background:#fff}
  </style></head><body><div class="cap"><div class="brand"><img src="${ICON}">${brand}</div><h1>${title}</h1><p>${sub}</p></div><div class="shot">${imgs}</div></body></html>`, { waitUntil: "load" });
  await page.screenshot({ path: file, type: "jpeg", quality: 92 });
  await page.close();
}

for (const loc of ONLY) {
  const C = COPY[loc], dir = path.join(OUT, loc);
  fs.mkdirSync(dir, { recursive: true });
  const showcase = new Map(pages(loc).map((p) => [p.path, p]));
  const server = http.createServer((req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    const sc = showcase.get(p.replace(/\/$/, ""));
    if (sc) { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(sc.html); return; }
    const f = path.join(EXT, "test", p);
    if (!f.startsWith(path.join(EXT, "test")) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const BASE = `http://localhost:${server.address().port}`;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", pipe: true,
    args: ["--enable-unsafe-extension-debugging", "--no-first-run", `--lang=${loc}`], ignoreDefaultArgs: ["--disable-extensions"], env: { ...process.env, LANG: `${SYS_LANG[loc]}.UTF-8` } });
  try {
    let i = 0;
    // ① – ④ the sites
    for (const sc of showcase.values()) {
      const page = await browser.newPage();
      const warns = [];
      page.on("console", (m) => { if (m.type() === "warning" && /no translation/.test(m.text())) warns.push(m.text()); });
      await page.evaluateOnNewDocument((l) => { window.__ffUiLang = l; }, loc);
      await page.setViewport({ width: sc.width, height: 1300, deviceScaleFactor: 2 });
      await page.goto(BASE + sc.path, { waitUntil: "load" });
      await wait(4500);
      // 标一条、同类都清理（0.26）：点第一条骗局的漏斗，等另外两条清理掉；视口高度改成页面内容那么高（提示条贴着底部），再把鼠标放到另一条评论上露出它的漏斗
      if (sc.markTarget) {
        await page.hover(`shreddit-comment[thingid="${sc.markTarget}"] [slot="comment"]`);
        await page.click(`shreddit-comment[thingid="${sc.markTarget}"] .ff-mark`);
        await wait(1500);
        const bottom = await page.evaluate(() => Math.ceil(document.querySelector(".wrap").getBoundingClientRect().bottom));
        await page.setViewport({ width: sc.width, height: bottom, deviceScaleFactor: 2 });
        await wait(400);
        await page.hover(`shreddit-comment[thingid="${sc.hoverAfter}"] [slot="comment"]`);
        await page.hover(`shreddit-comment[thingid="${sc.hoverAfter}"] .ff-mark`); // 停在漏斗上：亮起来、带悬停的底色
        await wait(400);
      }
      // 量内容的底边，不量 scrollHeight（页面比视口矮时它等于视口高，截出一大块白底）
      const h = await page.evaluate(() => Math.ceil(Math.max(...[...document.body.children].filter((e) => e.tagName !== "SCRIPT").map((e) => e.getBoundingClientRect().bottom))) + 12);
      const png = await page.screenshot({ clip: { x: 0, y: 0, width: sc.width, height: Math.min(h, sc.key === "x" ? 900 : 1150) } });
      if (RAW) fs.writeFileSync(path.join(dir, `raw-${sc.key}.png`), png);
      if (warns.length) console.warn(`${loc} ${sc.key}: ${warns.length} texts had no stand-in translation`, warns.slice(0, 3));
      await page.close();
      const w = sc.key === "x" ? 560 : 640;
      await frame(browser, path.join(dir, `${++i}-${sc.key}.jpg`), { brand: C.brand, title: C[sc.key][0], sub: C[sc.key][1], shots: [{ png, w }], loc });
    }
    // ⑤ the real popup and the Reddit settings page, side by side
    const { id } = await (await browser.target().createCDPSession()).send("Extensions.loadUnpacked", { path: EXT });
    await wait(1200);
    for (const p of await browser.pages()) if (p.url().includes("#welcome")) await p.close();
    const ext = await browser.newPage();
    await ext.goto(`chrome-extension://${id}/options.html`, { waitUntil: "load" });
    const day = (k) => new Date(Date.now() - k * 864e5).toLocaleDateString("sv-SE");
    await ext.evaluate((seed) => chrome.storage.local.set(seed), {
      ff_key: "demo", ff_or_key: "demo", ff_onboarded: Date.now(),
      ff_stats: Object.fromEntries([6, 5, 4, 3, 2, 1, 0].map((d, k) => [day(d), { posts: 9 + k * 2, seen: 300 + k * 40, fold_jev: 12 + ((k * 7) % 9), fold_dup: 3 + (k % 3), fold_m1: 2 + (k % 4),
        fold_abuse: 1 + (k % 2), fold_sexual: k % 2, fold_filler: 10 + ((k * 5) % 11), tx_replaced: 4 + k, tx_fill: 6 + k, tokens: 60000 + k * 9000, tx_usd: 0.001 * (k + 1) }])),
    });
    const pop = await browser.newPage();
    await pop.evaluateOnNewDocument(() => {
      chrome.tabs.query = async () => [{ id: 1, url: "https://www.reddit.com/r/bicycletouring/comments/sc1/hokkaido/" }];
      chrome.tabs.sendMessage = (t, m, cb) => setTimeout(() => cb({ site: "reddit", kind: "status", enabled: true, folds: { spam: 1, abuse: 0, sexual: 0 }, filler: 1, pending: 0, seen: 8, tx: { improved: 0, filled: 9 } }), 10);
    });
    await pop.setViewport({ width: 340, height: 600, deviceScaleFactor: 2 });
    await pop.goto(`chrome-extension://${id}/popup.html?uilang=${loc}`, { waitUntil: "load" });
    await wait(800);
    const ph = await pop.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
    const popup = await pop.screenshot({ clip: { x: 0, y: 0, width: 340, height: Math.min(ph, 600) } });
    await ext.setViewport({ width: 600, height: 1000, deviceScaleFactor: 2 });
    await ext.goto(`chrome-extension://${id}/options.html?uilang=${loc}#site=reddit`, { waitUntil: "load" });
    await wait(900);
    const bottom = await ext.evaluate(() => Math.ceil(document.querySelector("main").lastElementChild.getBoundingClientRect().bottom) + 24);
    const settings = await ext.screenshot({ clip: { x: 0, y: 0, width: 600, height: Math.min(bottom, 900) } });
    if (RAW) { fs.writeFileSync(path.join(dir, "raw-popup.png"), popup); fs.writeFileSync(path.join(dir, "raw-settings.png"), settings); }
    await frame(browser, path.join(dir, "5-ui.jpg"), { brand: C.brand, title: C.ui[0], sub: C.ui[1], shots: [{ png: popup, w: 300 }, { png: settings, w: 400 }], loc });

    // promo tile 440×280: one for every language (the store can't localize it), in English
    if (loc === "en") {
      const tile = await browser.newPage();
      await tile.setViewport({ width: 440, height: 280, deviceScaleFactor: 1 });
      await tile.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;width:440px;height:280px;background:linear-gradient(135deg,#0b57d0,#2f6fe0);font-family:-apple-system,'Segoe UI',Roboto,'PingFang SC',sans-serif;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 40px;box-sizing:border-box">
        <div style="display:flex;align-items:center;gap:14px"><img src="${b64(fs.readFileSync(path.join(EXT, "icons/dark-128.png")))}" style="width:64px;height:64px"><span style="font-size:36px;font-weight:700;letter-spacing:-.5px">${C.brand}</span></div>
        <p style="font-size:20px;line-height:1.45;margin:22px 0 0;opacity:.95">${C.tagline}</p></body></html>`, { waitUntil: "load" });
      await tile.screenshot({ path: path.join(OUT, "promo-440x280.jpg"), type: "jpeg", quality: 92 });
      // Edge Add-ons wants a 300×300 store logo per language (the 128 icon is too small there): the same icon.svg the extension's icons come from, light colours
      const svg = fs.readFileSync(path.join(UI, "icons/icon.svg"), "utf8").replaceAll("BADGE", "#0B57D0").replaceAll("GLYPH", "#FFFFFF");
      await tile.setViewport({ width: 300, height: 300, deviceScaleFactor: 1 });
      await tile.setContent(`<html><body style="margin:0;background:transparent"><img width="300" height="300" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"></body></html>`, { waitUntil: "load" });
      await tile.screenshot({ path: path.join(OUT, "logo-300.png"), omitBackground: true, clip: { x: 0, y: 0, width: 300, height: 300 } });
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`${loc}: ${fs.readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort().join(", ")}`);
}
