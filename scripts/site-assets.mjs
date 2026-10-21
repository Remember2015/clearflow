// Renders the images for the website (site/, https://clearflow.ohmyai.app) into site/assets/<locale>/: the showcase pages of
// scripts/showcase.mjs (every post and comment invented) with the real extension, each shot without and with it; the boxes the website
// draws over each pair and small before/after crops of single comments for the case walls (marks.json); the "mark one, the rest go"
// pages before and after marking; the real popup and settings page; and a 1200×630 link-preview image per language.
// Needs Google Chrome (CHROME_PATH), cwebp, and `npm run setup`.
// Usage: node scripts/site-assets.mjs [--locales en,zh-CN,ja] [--og-only]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { sitePages, fontOf } from "./showcase.mjs";
import { COPY, LANGS } from "../site/copy.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const EXT = path.join(ROOT, "extension"), UI = path.join(ROOT, "ui"), OUT = path.join(ROOT, "site/assets");
const SITE_LOCALES = ["en", "zh-CN", "ja"];
const ONLY = process.argv.includes("--locales") ? process.argv[process.argv.indexOf("--locales") + 1].split(",") : SITE_LOCALES;
const SYS_LANG = { en: "en_US", "zh-CN": "zh_CN", ja: "ja_JP" };
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const puppeteer = createRequire(import.meta.url)(path.join(UI, "node_modules/puppeteer-core"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const OG_ONLY = process.argv.includes("--og-only");
if (!OG_ONLY) execFileSync("python3", ["test/build_inject_bundle.py"], { cwd: EXT, stdio: "ignore" });

// how much of each page the before/after pair shows (CSS px): both shots get the same height so they line up side by side
const CROP = { x: 860, xnews: 980, xsex: 980, xhs: 980, reddit: 980, yt: 980, hn: 900 };
const MAX_CASES = { clean: 5, tx: 5 }; // crops per page for the case walls
// "before": the same page without the line that loads the extension
const unplug = (html) => html.replace(/const sc = document\.createElement\("script"\);[^<]*/, "");
const OG = Object.fromEntries(Object.entries(LANGS).map(([lang, L]) => [L.assets, [COPY[lang].hero.h1, COPY[lang].hero.lede]]));
// ---- run inside the page ----
// Before: a box per junk comment (its own part: spam / filler / abuse / sexual; target / same on the marking pages) and per foreign
// text (just the text), counts for the whole page, and the rectangles of the comments the case crops need.
function findBefore({ marks, foreign, item, own, height, need }) {
  const norm = (t) => String(t).replace(/\s+/g, " ").trim();
  const block = (e) => { while (e && getComputedStyle(e).display.startsWith("inline")) e = e.parentElement; return e; };
  const items = [...document.querySelectorAll(item)];
  const parts = (it) => own ? [...it.querySelectorAll(own)].filter((e) => e.closest(item) === it) : [it];
  const rectOf = (els) => { const rs = els.map((e) => e.getBoundingClientRect()).filter((r) => r.height >= 1); if (!rs.length) return null;
    const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top)), r = Math.max(...rs.map((x) => x.right)), b = Math.max(...rs.map((x) => x.bottom));
    return { x: Math.round(l), y: Math.round(t + scrollY), w: Math.round(r - l), h: Math.round(b - t) }; };
  const els = [...document.body.querySelectorAll("*")].filter((e) => !["SCRIPT", "STYLE"].includes(e.tagName));
  const find = (t) => { const want = norm(t); return els.filter((e) => norm(e.textContent) === want && ![...e.children].some((c) => norm(c.textContent) === want)); };
  const out = [], counts = { clean: 0, filler: 0, tx: 0 }, seen = new Set();
  const add = (e, kind, key) => { if (!e || seen.has(e)) return; seen.add(e); const r = rectOf([e]); if (r) out.push({ ...r, kind }); if (key) counts[key]++; };
  for (const [t, kind] of marks) for (const e of find(t)) {
    const it = e.closest(item);
    const r = it ? rectOf(parts(it)) : null;
    if (it && seen.has(it)) continue;
    if (it && r) { seen.add(it); out.push({ ...r, kind }); counts[kind === "filler" ? "filler" : kind === "target" || kind === "same" ? "clean" : "clean"]++; }
    else add(block(e), kind, "clean");
  }
  const bare = (t) => { const want = norm(t), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), res = []; let n;
    while ((n = w.nextNode())) if (norm(n.nodeValue) === want) res.push(n);
    return res; };
  for (const t of foreign) {
    const hits = find(t);
    for (const e of hits) add(block(e), "foreign", "tx");
    if (hits.length) continue;
    for (const n of bare(t)) { // a foreign text that is a bare text node (first paragraph of an HN comment, words around a code block)
      const rg = document.createRange(); rg.selectNodeContents(n);
      const r = rg.getBoundingClientRect();
      out.push({ x: Math.round(r.left - 2), y: Math.round(r.top + scrollY - 2), w: Math.round(r.width + 4), h: Math.round(r.height + 4), kind: "foreign" });
      counts.tx++;
    }
  }
  const crops = Object.fromEntries((need || []).map((i) => [i, items[i] ? rectOf(parts(items[i])) : null]));
  return { boxes: out.filter((b) => b.h > 0 && b.y < height).map((b) => ({ ...b, h: Math.min(b.h, height - b.y) })), counts, crops };
}
// After: a box per notice the extension put up (.ff-bar, the "nice"/"+1" line) and per translation (its note and the translated text),
// the undo notice on the marking pages, and the cases: which comments each notice stands for (by their index among the page's
// comments, the same index in the "before" page) and what to crop.
function findAfter({ marks, item, own, height, learn }) {
  const norm = (t) => String(t).replace(/\s+/g, " ").trim();
  const items = [...document.querySelectorAll(item)];
  const parts = (it) => own ? [...it.querySelectorAll(own)].filter((e) => e.closest(item) === it) : [it];
  const rectOf = (els, pad = 0) => { const rs = els.map((e) => e.getBoundingClientRect()).filter((r) => r.height >= 1); if (!rs.length) return null;
    const l = Math.min(...rs.map((r) => r.left)) - pad, t = Math.min(...rs.map((r) => r.top)) - pad, r = Math.max(...rs.map((x) => x.right)) + pad, b = Math.max(...rs.map((x) => x.bottom)) + pad;
    return { x: Math.round(Math.max(0, l)), y: Math.round(t + scrollY), w: Math.round(Math.min(innerWidth, r) - Math.max(0, l)), h: Math.round(b - t) }; };
  const vis = (e) => e.getBoundingClientRect().height >= 1;
  const ownText = (it) => norm(parts(it).map((e) => e.textContent).join(" "));
  const kindOf = (it) => { const t = ownText(it); const m = marks.find(([s]) => t.includes(norm(s))); return m ? m[1] : null; };
  const bars = [...document.querySelectorAll(".ff-bar")].filter(vis);
  const tagsOf = (b) => [...b.querySelectorAll(".ff-tag")].map((t) => norm(t.textContent));
  const boxes = [];
  bars.forEach((b, k) => {
    const r = rectOf([b]);
    const kind = learn ? (k === 0 ? "marked" : "learned") : b.querySelector(".ff-tag-abuse") && !b.querySelector(".ff-tag:not(.ff-tag-abuse)") ? "abuse" : "spam";
    boxes.push({ ...r, kind });
  });
  const line = [...document.querySelectorAll(".ff-fill-line")].find(vis);
  if (line) boxes.push({ ...rectOf([line]), kind: "filler" });
  const toast = [...document.querySelectorAll(".ff-toast-on")].find(vis);
  if (toast) boxes.push({ ...rectOf([toast], 2), kind: "undo" });
  // translations: the note and the first visible text after it that isn't part of a note
  const txItems = [];
  for (const note of document.querySelectorAll(".ff-tx-note")) {
    if (!vis(note)) continue;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    w.currentNode = note;
    let n, tb = null;
    while ((n = w.nextNode())) {
      const el = n.parentElement;
      if (!n.nodeValue.trim() || note.contains(el) || el.closest(".ff-tx-note, .ff-bar")) continue;
      if (!vis(el)) continue;
      let b = el; while (b && getComputedStyle(b).display.startsWith("inline")) b = b.parentElement;
      tb = b; break;
    }
    boxes.push({ ...rectOf(tb ? [note, tb] : [note]), kind: "tx" });
    const it = note.closest(item);
    if (it && parts(it).some((p) => p.contains(note))) txItems.push({ i: items.indexOf(it), note: norm(note.textContent) });
  }
  // cleaning cases: walk the notices and the comments in page order. A notice inside a comment stands for that comment; one outside
  // (X's, or a merged run) stands for the hidden junk comments after it, up to the next comment that is still shown.
  const nodes = [...bars.map((b) => ({ b })), ...items.map((it, i) => ({ it, i }))]
    .sort((p, q) => { const a = p.b || p.it, c = q.b || q.it; return a === c ? 0 : a.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; });
  const clean = [], byBar = new Map(), filler = [];
  let cur = null;
  for (const n of nodes) {
    if (n.b) { if (!n.b.closest(item)) cur = n.b; continue; }
    const it = n.it, k = kindOf(it), inner = bars.find((b) => b.closest(item) === it);
    if (k === "filler") { filler.push(n.i); continue; }
    if (!k) { if (vis(it) && !inner) cur = null; continue; }
    const bar = inner || cur;
    if (!bar) continue;
    if (!byBar.has(bar)) { const c = { items: [], rect: inner ? rectOf(parts(it), 4) : rectOf([bar], 6), tags: tagsOf(bar) }; byBar.set(bar, c); clean.push(c); }
    byBar.get(bar).items.push(n.i);
  }
  const cases = learn ? [] : [
    ...clean.map((c) => ({ type: "clean", items: c.items, rect: c.rect, tags: c.tags })),
    ...(line && filler.length ? [{ type: "filler", items: filler, rect: rectOf([line], 6), tags: [] }] : []),
    ...txItems.map((t) => ({ type: "tx", items: [t.i], rect: rectOf(parts(items[t.i]), 4), note: t.note })),
  ];
  return { boxes: boxes.filter((b) => b.h > 0 && b.y < height).map((b) => ({ ...b, h: Math.min(b.h, height - b.y) })), cases };
}
const b64 = (buf, type = "png") => `data:image/${type};base64,${Buffer.from(buf).toString("base64")}`;
const ICON = b64(fs.readFileSync(path.join(EXT, "icons/icon-128.png")));

for (const loc of ONLY) {
  const dir = path.join(OUT, loc);
  fs.mkdirSync(dir, { recursive: true });
  const list = OG_ONLY ? [] : sitePages(loc);
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
    const open = async (sc, off) => {
      const page = await browser.newPage();
      await light(page);
      page.on("console", (m) => { if (m.type() === "warning" && /no translation/.test(m.text())) console.warn(`${loc} ${sc.key}${off ? " (before)" : ""}:`, m.text().slice(0, 120)); });
      page.on("pageerror", (e) => console.warn(`${loc} ${sc.key}: page error`, e.message));
      await page.evaluateOnNewDocument((l) => { window.__ffUiLang = l; }, loc);
      await page.setViewport({ width: sc.width, height: 1300, deviceScaleFactor: 2 });
      await page.goto(BASE + sc.path + (off ? "/off" : ""), { waitUntil: "load" });
      await wait(off ? 600 : 4500);
      return page;
    };
    // the lowest comment still shown (X's main is min-height 100vh, cleaned posts are display:none)
    const bottomOf = (page, sc) => page.evaluate((item) => Math.ceil(Math.max(...[...document.querySelectorAll(item)].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0).map((r) => r.bottom)) + scrollY), sc.item);
    const crop = async (page, file, r, width) => {
      const clip = { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(width, r.x + r.w) - Math.max(0, r.x), height: r.h };
      await page.screenshot({ path: path.join(dir, file), type: "webp", quality: 85, clip, captureBeyondViewport: true });
      sizes[file] = [Math.round(clip.width), Math.round(clip.height)];
      return file;
    };
    for (const sc of list) {
      const M = (MARKS[sc.key] = {});
      if (sc.markUi) {
        // marking: one page with the extension — hover the first scam comment (its funnel shows), shoot, click the funnel, shoot again
        // with the undo notice (the viewport ends just under the comments, so the notice sits right below them)
        const page = await open(sc, false), U = sc.markUi;
        await page.hover(U.hover); await wait(400);
        const hB = (await bottomOf(page, sc)) + 76; // room for a sticky footer (Xiaohongshu's comment bar) under the last comment
        await page.setViewport({ width: sc.width, height: hB, deviceScaleFactor: 2 }); await page.hover(U.hover); await wait(300);
        await shot(`${sc.key}-before.webp`, page, { x: 0, y: 0, width: sc.width, height: hB });
        M.before = await page.evaluate(findBefore, { marks: sc.marks, foreign: [], item: sc.item, own: sc.own, height: hB });
        await page.click(U.click); await wait(1600);
        const hA = (await bottomOf(page, sc)) + 76;
        await page.setViewport({ width: sc.width, height: hA, deviceScaleFactor: 2 });
        await page.hover(U.after); await page.hover(U.afterIcon).catch(() => {}); await wait(500);
        await shot(`${sc.key}-after.webp`, page, { x: 0, y: 0, width: sc.width, height: hA });
        M.after = await page.evaluate(findAfter, { marks: sc.marks, item: sc.item, own: sc.own, height: hA, learn: true });
        await page.close();
        continue;
      }
      // the pair: "after" first (its height sets both), then "before"
      const after = await open(sc, false);
      const cropH = Math.min((await bottomOf(after, sc)) + 1, CROP[sc.key]);
      await after.setViewport({ width: sc.width, height: Math.max(cropH, 1300), deviceScaleFactor: 2 });
      await shot(`${sc.key}-after.webp`, after, { x: 0, y: 0, width: sc.width, height: cropH });
      const A = await after.evaluate(findAfter, { marks: sc.marks, item: sc.item, own: sc.own, height: cropH, learn: false });
      M.after = { boxes: A.boxes };
      // the case crops: up to MAX_CASES of each kind per page (cleaning: the notices; translation: one per source language)
      const picked = [...A.cases.filter((c) => c.type !== "tx").slice(0, MAX_CASES.clean), ...A.cases.filter((c) => c.type === "tx").slice(0, MAX_CASES.tx)].filter((c) => c.rect && c.rect.h > 0);
      M.cases = [];
      for (const [n, c] of picked.entries()) M.cases.push({ type: c.type, tags: c.tags || [], note: c.note || "", items: c.items.slice(0, 3), after: await crop(after, `case-${sc.key}-${n}-after.webp`, c.rect, sc.width) });
      await after.close();
      const before = await open(sc, true);
      await before.setViewport({ width: sc.width, height: Math.max(cropH, 1300), deviceScaleFactor: 2 });
      await shot(`${sc.key}-before.webp`, before, { x: 0, y: 0, width: sc.width, height: cropH });
      const need = [...new Set(M.cases.flatMap((c) => c.items))];
      const B = await before.evaluate(findBefore, { marks: sc.marks, foreign: sc.foreign, item: sc.item, own: sc.own, height: cropH, need });
      M.before = { boxes: B.boxes, counts: B.counts };
      for (const [n, c] of M.cases.entries()) {
        c.before = [];
        for (const [j, i] of c.items.entries()) if (B.crops[i]) c.before.push(await crop(before, `case-${sc.key}-${n}-b${j}.webp`, { ...B.crops[i], x: B.crops[i].x - 4, y: B.crops[i].y - 4, w: B.crops[i].w + 8, h: B.crops[i].h + 8 }, sc.width));
        delete c.items;
      }
      M.cases = M.cases.filter((c) => c.before.length);
      await before.close();
    }
    if (!OG_ONLY) {
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
    }

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
  if (!OG_ONLY) {
    fs.writeFileSync(path.join(dir, "sizes.json"), JSON.stringify(sizes, null, 1) + "\n");
    fs.writeFileSync(path.join(dir, "marks.json"), JSON.stringify(MARKS) + "\n");
  }
  console.log(`${loc}: ${OG_ONLY ? "updated og.png" : `${Object.keys(sizes).length} screenshots and og.png`}`);
}

if (!OG_ONLY) execFileSync(process.execPath, [path.join(ROOT, "scripts/site-previews.mjs"), ...ONLY], { stdio: "inherit" });
