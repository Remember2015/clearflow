// Renders the images for the website (site/, https://clearflow.ohmyai.app) into site/assets/<locale>/: the same showcase pages as the
// store screenshots (scripts/showcase.mjs, every post and comment invented), each shot twice — without the extension and with it — so the
// page can switch between "before" and "after"; the "mark one, the rest go" page after marking; the real popup and settings page;
// and a 1200×630 link-preview image per language.
// Needs Google Chrome (CHROME_PATH) and `npm run setup`.
// Usage: node scripts/site-assets.mjs [--locales en,zh-CN,ja]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { sitePages, fontOf } from "./showcase.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const EXT = path.join(ROOT, "extension"), UI = path.join(ROOT, "ui"), OUT = path.join(ROOT, "site/assets");
const SITE_LOCALES = ["en", "zh-CN", "ja"];
const ONLY = process.argv.includes("--locales") ? process.argv[process.argv.indexOf("--locales") + 1].split(",") : SITE_LOCALES;
const SYS_LANG = { en: "en_US", "zh-CN": "zh_CN", ja: "ja_JP" };
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const puppeteer = createRequire(import.meta.url)(path.join(UI, "node_modules/puppeteer-core"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
execFileSync("python3", ["test/build_inject_bundle.py"], { cwd: EXT, stdio: "ignore" });

// how much of each page the before/after pair shows (CSS px): both shots get the same height so they line up when switching
const CROP = { x: 860, xnews: 980, xhs: 980, reddit: 980, yt: 980, hn: 900 };
// "before": the same page without the line that loads the extension
const unplug = (html) => html.replace(/const sc = document\.createElement\("script"\);[^<]*/, "");
const OG = {
  en: ["Comment sections without the junk", "Spam and bot replies cleaned up — each says why. Foreign-language comments translated in place."],
  "zh-CN": ["评论区，清清爽爽", "垃圾回复自动清理、写明原因；外文评论原地翻成中文。"],
  ja: ["返信欄を、すっきりと", "スパムやボットの返信を理由つきで片付け、外国語のコメントはその場で日本語に。"],
};
// Boxes the website draws over the before/after pair (CSS px from the top left of the shot, cut at its height), plus counts for the
// whole page. Before: each junk comment (its whole item: spam / filler / abuse / sexual) and each foreign text (just the text).
// After: the extension's own notices (.ff-bar, the "nice"/"+1" line) and each translation (its note plus the translated text under it).
function findBefore({ marks, foreign, item, height }) {
  const norm = (t) => String(t).replace(/\s+/g, " ").trim();
  const block = (e) => { while (e && getComputedStyle(e).display.startsWith("inline")) e = e.parentElement; return e; };
  const els = [...document.body.querySelectorAll("*")].filter((e) => !["SCRIPT", "STYLE"].includes(e.tagName));
  // elements whose own text is this text (the innermost one), every occurrence
  const find = (t) => { const want = norm(t); return els.filter((e) => norm(e.textContent) === want && ![...e.children].some((c) => norm(c.textContent) === want)); };
  const box = (e, kind) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), kind }; };
  const out = [], counts = { clean: 0, filler: 0, tx: 0 }, seen = new Set();
  const add = (e, kind, key) => { if (!e || seen.has(e)) return; seen.add(e); out.push(box(e, kind)); counts[key]++; };
  for (const [t, kind] of marks) for (const e of find(t)) add(e.closest(item) || block(e), kind, kind === "filler" ? "filler" : "clean");
  // a foreign text that is a bare text node (the first paragraph of an HN comment, the words around a code block): box the text itself
  const bare = (t) => { const want = norm(t), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), out = []; let n;
    while ((n = w.nextNode())) if (norm(n.nodeValue) === want) out.push(n);
    return out; };
  for (const t of foreign) {
    const els = find(t);
    for (const e of els) add(block(e), "foreign", "tx");
    if (els.length) continue;
    for (const n of bare(t)) {
      if (seen.has(n)) continue;
      seen.add(n);
      const rg = document.createRange(); rg.selectNodeContents(n);
      const r = rg.getBoundingClientRect();
      out.push({ x: Math.round(r.left - 2), y: Math.round(r.top + scrollY - 2), w: Math.round(r.width + 4), h: Math.round(r.height + 4), kind: "foreign" });
      counts.tx++;
    }
  }
  return { boxes: out.filter((b) => b.h > 0 && b.y < height).map((b) => ({ ...b, h: Math.min(b.h, height - b.y) })), counts };
}
function findAfter({ height }) {
  const box = (r, kind) => ({ x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.right - r.left), h: Math.round(r.bottom - r.top), kind });
  const out = [];
  for (const e of document.querySelectorAll(".ff-bar")) {
    const r = e.getBoundingClientRect();
    if (r.height >= 1) out.push(box(r, e.querySelector(".ff-tag-abuse") && !e.querySelector(".ff-tag:not(.ff-tag-abuse)") ? "abuse" : "spam"));
  }
  for (const e of document.querySelectorAll(".ff-fill-line")) { const r = e.getBoundingClientRect(); if (r.height >= 1) out.push(box(r, "filler")); }
  // a translation: its note, and the first visible text after it that isn't part of a note
  for (const note of document.querySelectorAll(".ff-tx-note")) {
    const nr = note.getBoundingClientRect();
    if (nr.height < 1) continue;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    w.currentNode = note;
    let n, tb = null;
    while ((n = w.nextNode())) {
      const el = n.parentElement;
      if (!n.nodeValue.trim() || note.contains(el) || el.closest(".ff-tx-note, .ff-bar")) continue;
      if (el.getBoundingClientRect().height < 1) continue;
      let b = el; while (b && getComputedStyle(b).display.startsWith("inline")) b = b.parentElement;
      tb = b.getBoundingClientRect(); break;
    }
    const r = tb ? { left: Math.min(nr.left, tb.left), top: Math.min(nr.top, tb.top), right: Math.max(nr.right, tb.right), bottom: Math.max(nr.bottom, tb.bottom) } : nr;
    out.push(box(r, "tx"));
  }
  return { boxes: out.filter((b) => b.h > 0 && b.y < height).map((b) => ({ ...b, h: Math.min(b.h, height - b.y) })) };
}
const b64 = (buf, type = "png") => `data:image/${type};base64,${Buffer.from(buf).toString("base64")}`;
const ICON = b64(fs.readFileSync(path.join(EXT, "icons/icon-128.png")));

for (const loc of ONLY) {
  const dir = path.join(OUT, loc);
  fs.mkdirSync(dir, { recursive: true });
  const list = sitePages(loc);
  const routes = new Map();
  for (const p of list) { routes.set(p.path, p.html); routes.set(p.path + "/off", unplug(p.html)); }
  const server = http.createServer((req, res) => {
    const p = new URL(req.url, "http://x").pathname.replace(/\/$/, "");
    if (routes.has(p)) { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(routes.get(p)); return; }
    const f = path.join(EXT, "test", p);
    if (!f.startsWith(path.join(EXT, "test")) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const BASE = `http://localhost:${server.address().port}`;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", pipe: true,
    args: ["--enable-unsafe-extension-debugging", "--no-first-run", `--lang=${loc}`], ignoreDefaultArgs: ["--disable-extensions"], env: { ...process.env, LANG: `${SYS_LANG[loc]}.UTF-8` } });
  // the extension's pages follow the system's dark mode; the site shows the light ones, like the store screenshots
  const light = (page) => page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  const sizes = {}, MARKS = {};
  const shot = async (file, page, clip) => {
    await page.screenshot({ path: path.join(dir, file), type: "webp", quality: 82, clip });
    sizes[file] = [clip.width, clip.height];
  };
  try {
    for (const sc of list) {
      let cropH = 0; // the before/after pair: as tall as the cleaned page's content (at most CROP), "after" goes first
      for (const off of sc.markTarget ? [false] : [false, true]) {
        const page = await browser.newPage();
        await light(page);
        const warns = [];
        page.on("console", (m) => { if (m.type() === "warning" && /no translation/.test(m.text())) warns.push(m.text()); });
        page.on("pageerror", (e) => console.warn(`${loc} ${sc.key}: page error`, e.message));
        // the page's own address (the stand-in route) is rewritten by the page itself, so load /off first and let it replaceState
        await page.evaluateOnNewDocument((l) => { window.__ffUiLang = l; }, loc);
        await page.setViewport({ width: sc.width, height: 1300, deviceScaleFactor: 2 });
        await page.goto(BASE + sc.path + (off ? "/off" : ""), { waitUntil: "load" });
        await wait(off ? 600 : 4500);
        if (sc.markTarget) {
          await page.hover(`shreddit-comment[thingid="${sc.markTarget}"] [slot="comment"]`);
          await page.click(`shreddit-comment[thingid="${sc.markTarget}"] .ff-mark`);
          await wait(1500);
          await page.hover(`shreddit-comment[thingid="${sc.hoverAfter}"] [slot="comment"]`);
          await page.hover(`shreddit-comment[thingid="${sc.hoverAfter}"] .ff-mark`);
          await wait(400);
        }
        const h = sc.markTarget ? await page.evaluate(() => Math.ceil(document.querySelector("shreddit-comment-tree").getBoundingClientRect().bottom) + 16)
          : await page.evaluate(() => {
            // X: main is min-height 100vh, so measure the lowest post that is still shown (cleaned ones are display:none)
            const cells = [...document.querySelectorAll('main [data-testid="cellInnerDiv"]')].map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0);
            if (cells.length) return Math.ceil(Math.max(...cells.map((r) => r.bottom)) + scrollY) + 1;
            return Math.ceil(Math.max(...[...document.body.children].filter((e) => e.tagName !== "SCRIPT").map((e) => e.getBoundingClientRect().bottom))) + 12;
          });
        const height = sc.markTarget ? Math.min(h, 1150) : off ? cropH : (cropH = Math.min(h, CROP[sc.key]));
        await page.setViewport({ width: sc.width, height: Math.max(height, 1300), deviceScaleFactor: 2 });
        await shot(`${sc.key}-${sc.markTarget ? "after" : off ? "before" : "after"}.webp`, page, { x: 0, y: 0, width: sc.width, height });
        if (sc.marks) (MARKS[sc.key] ||= {})[off ? "before" : "after"] = await page.evaluate(off ? findBefore : findAfter, { marks: sc.marks, foreign: sc.foreign, item: sc.item, height });
        if (warns.length) console.warn(`${loc} ${sc.key}${off ? " (before)" : ""}: ${warns.length} texts had no stand-in translation`, warns.slice(0, 4));
        await page.close();
      }
    }
    // the real popup and the Reddit settings page (same seed as the store screenshots)
    const { id } = await (await browser.target().createCDPSession()).send("Extensions.loadUnpacked", { path: EXT });
    await wait(1200);
    for (const p of await browser.pages()) if (p.url().includes("#welcome")) await p.close();
    const ext = await browser.newPage();
    await light(ext);
    await ext.goto(`chrome-extension://${id}/options.html`, { waitUntil: "load" });
    const day = (k) => new Date(Date.now() - k * 864e5).toLocaleDateString("sv-SE");
    await ext.evaluate((seed) => chrome.storage.local.set(seed), {
      ff_key: "demo", ff_or_key: "demo", ff_onboarded: Date.now(),
      ff_stats: Object.fromEntries([6, 5, 4, 3, 2, 1, 0].map((d, k) => [day(d), { posts: 9 + k * 2, seen: 300 + k * 40, fold_jev: 12 + ((k * 7) % 9), fold_dup: 3 + (k % 3), fold_m1: 2 + (k % 4),
        fold_abuse: 1 + (k % 2), fold_sexual: k % 2, fold_filler: 10 + ((k * 5) % 11), tx_replaced: 4 + k, tx_fill: 6 + k, tokens: 60000 + k * 9000, tx_usd: 0.001 * (k + 1) }])),
    });
    const pop = await browser.newPage();
    await light(pop);
    await pop.evaluateOnNewDocument(() => {
      chrome.tabs.query = async () => [{ id: 1, url: "https://www.reddit.com/r/bicycletouring/comments/sc1/hokkaido/" }];
      chrome.tabs.sendMessage = (t, m, cb) => setTimeout(() => cb({ site: "reddit", kind: "status", enabled: true, folds: { spam: 1, abuse: 0, sexual: 0 }, filler: 1, pending: 0, seen: 8, tx: { improved: 0, filled: 9 } }), 10);
    });
    await pop.setViewport({ width: 340, height: 600, deviceScaleFactor: 2 });
    await pop.goto(`chrome-extension://${id}/popup.html?uilang=${loc}`, { waitUntil: "load" });
    await wait(800);
    const ph = await pop.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
    await shot("popup.webp", pop, { x: 0, y: 0, width: 340, height: Math.min(ph, 600) });
    await ext.setViewport({ width: 600, height: 1000, deviceScaleFactor: 2 });
    await ext.goto(`chrome-extension://${id}/options.html?uilang=${loc}#site=reddit`, { waitUntil: "load" });
    await wait(900);
    const bottom = await ext.evaluate(() => Math.ceil(document.querySelector("main").lastElementChild.getBoundingClientRect().bottom) + 24);
    await shot("settings.webp", ext, { x: 0, y: 0, width: 600, height: Math.min(bottom, 900) });

    // link preview 1200×630: the name, one line, and the cleaned X page
    const og = await browser.newPage();
    await light(og);
    await og.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    const xAfter = b64(fs.readFileSync(path.join(dir, "x-after.webp")), "webp");
    await og.setContent(`<!doctype html><html lang="${loc}"><head><meta charset="utf-8"><style>
      body{margin:0;width:1200px;height:630px;overflow:hidden;background:linear-gradient(135deg,#eef3fd,#dfe9fb);font-family:-apple-system,"Segoe UI",Roboto,${fontOf(loc)},sans-serif;display:flex;align-items:center;gap:56px;padding:0 0 0 72px;box-sizing:border-box;word-break:${loc === "ja" ? "auto-phrase" : "normal"}}
      .cap{flex:0 0 520px;color:#0b1b3f} .brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:28px;color:#0b57d0;margin-bottom:36px} .brand img{width:48px;height:48px}
      h1{font-size:58px;line-height:1.12;margin:0 0 22px;letter-spacing:-.5px;text-wrap:balance} p{font-size:26px;line-height:1.5;margin:0;color:#3c4a63;text-wrap:pretty}
      .shot{flex:1;align-self:stretch;padding-top:60px} .shot img{width:520px;border-radius:18px 0 0 0;box-shadow:0 20px 50px rgba(11,27,63,.18)}
    </style></head><body><div class="cap"><div class="brand"><img src="${ICON}">${loc === "zh-CN" ? "清流" : "ClearFlow"}</div><h1>${OG[loc][0]}</h1><p>${OG[loc][1]}</p></div><div class="shot"><img src="${xAfter}"></div></body></html>`, { waitUntil: "load" });
    await og.screenshot({ path: path.join(dir, "og.png"), type: "png" });
    await og.close();
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(dir, "sizes.json"), JSON.stringify(sizes, null, 1) + "\n");
  fs.writeFileSync(path.join(dir, "marks.json"), JSON.stringify(MARKS) + "\n");
  console.log(`${loc}: ${fs.readdirSync(dir).sort().join(", ")}`);
}
