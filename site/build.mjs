// Builds the website (https://clearflow.ohmyai.app) into site/dist/: /zh/, /en/, /ja/ (home, keys/, privacy/), 404.html,
// sitemap, robots, icons. Copy lives in copy.mjs, images in assets/ (rendered by scripts/site-assets.mjs), the privacy page is
// PRIVACY.md (public/PRIVACY.md in the monorepo, PRIVACY.md at the root of the public repo). "/" is answered by worker.js.
// Usage: node site/build.mjs        Deploy: site/deploy.sh
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { COPY, LANGS, STORE, REPO, MAIL } from "./copy.mjs";

const SITE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(SITE, "..");
const DIST = path.join(SITE, "dist");
const ORIGIN = "https://clearflow.ohmyai.app";
const PRIVACY = [path.join(ROOT, "public/PRIVACY.md"), path.join(ROOT, "PRIVACY.md")].find((f) => fs.existsSync(f));
const ICON_SVG = [path.join(ROOT, "ui/icons/icon.svg")].find((f) => fs.existsSync(f));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 10);
const write = (rel, body) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
const store = (lang, medium) => `${STORE}?utm_source=clearflow.ohmyai.app&utm_medium=${medium}&utm_campaign=site-${lang}`;

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// static files: styles and script get a content hash in the URL, images keep their names
const css = fs.readFileSync(path.join(SITE, "style.css"), "utf8");
const js = fs.readFileSync(path.join(SITE, "main.js"), "utf8");
write("style.css", css);
write("main.js", js);
const CSS_URL = `/style.css?v=${hash(css)}`, JS_URL = `/main.js?v=${hash(js)}`;
// one inline line before first paint: mark that scripts run, so the no-script fallback (cleaned shots, no switches) isn't used
const BOOT = `document.documentElement.className="js"`;
const BOOT_HASH = crypto.createHash("sha256").update(BOOT).digest("base64");
fs.cpSync(path.join(SITE, "assets"), path.join(DIST, "assets"), { recursive: true, filter: (f) => !/(sizes|marks)\.json$/.test(f) });
const svg = fs.readFileSync(ICON_SVG, "utf8").replace(/<!--[\s\S]*?-->\s*/, "").replaceAll("BADGE", "#0B57D0").replaceAll("GLYPH", "#FFFFFF");
write("icon.svg", svg);
for (const [from, to] of [["icon-32.png", "favicon-32.png"], ["icon-128.png", "icon-128.png"]]) fs.copyFileSync(path.join(ROOT, "extension/icons", from), path.join(DIST, to));
const SIZES = Object.fromEntries(Object.values(LANGS).map((l) => [l.assets, JSON.parse(fs.readFileSync(path.join(SITE, "assets", l.assets, "sizes.json"), "utf8"))]));

// headers for everything the worker doesn't answer (worker.js sets its own)
const CSP = `default-src 'none'; img-src 'self'; style-src 'self'; script-src 'self' 'sha256-${BOOT_HASH}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
write("_headers", `/*
  Content-Security-Policy: ${CSP}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: interest-cohort=()
/assets/*
  Cache-Control: public, max-age=86400
/style.css
  Cache-Control: public, max-age=31536000, immutable
/main.js
  Cache-Control: public, max-age=31536000, immutable
`);

// ---------- icons (24×24, 1.75 stroke, currentColor) ----------
const I = {
  reason: '<path d="M4 5h16v11H9.5L5 19.5V16H4z"/><path d="M8 9h8M8 12.5h5"/>',
  filler: '<path d="M4 6h16M4 11h11M4 16h6"/><path d="M15 16l2.5 2.5L22 14"/>',
  merge: '<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5l8.5 4.5 8.5-4.5"/><path d="M3.5 16.5l8.5 4.5 8.5-4.5"/>',
  learn: '<path d="M3 5h13l-5 6.2V18l-3-1.6v-5.2z"/><path d="M19 4v6M16 7h6"/>',
  translate: '<path d="M4 6h9M8.5 4v2c0 4-2.2 7.2-4.8 8.8M6.3 10.2c1.4 2.3 3.5 3.8 6 4.4"/><path d="M13 20l4-9 4 9M14.4 17h5.2"/>',
  sites: '<path d="M4 7h9M18 7h2M4 17h3M12 17h8"/><circle cx="15.5" cy="7" r="2.3"/><circle cx="9.5" cy="17" r="2.3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.4 9.4 0 0 1 12 6c5 0 8.5 4 9.5 6a13.6 13.6 0 0 1-2.8 3.5M6.6 7.6A13.6 13.6 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  send: '<path d="M4 12h12M11 6.5L16.5 12 11 17.5"/><path d="M20 5v14"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3M13.5 9.5l2 2"/>',
  code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  gh: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  spark: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>',
};
const icon = (k, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;

// ---------- page shell ----------
function shell({ lang, C, title, description, pathFor, body, extraCss }) {
  const L = LANGS[lang];
  const url = ORIGIN + pathFor(lang);
  const alternates = Object.entries(LANGS).map(([k, v]) => `<link rel="alternate" hreflang="${v.html}" href="${ORIGIN}${pathFor(k)}">`).join("")
    + `<link rel="alternate" hreflang="x-default" href="${ORIGIN}${pathFor("en")}">`;
  const langNav = Object.entries(LANGS).map(([k, v]) => k === lang ? `<a href="${pathFor(k)}" aria-current="true" lang="${v.html}">${v.name}</a>` : `<a href="${pathFor(k)}" hreflang="${v.html}" lang="${v.html}">${v.name}</a>`).join("");
  const home = `/${lang}/`;
  return `<!doctype html>
<html lang="${L.html}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">${alternates}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(C.brand)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ORIGIN}/assets/${L.assets}/og.png?v=${hash(fs.readFileSync(path.join(SITE, "assets", L.assets, "og.png")))}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:locale" content="${L.og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#eef3fd" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0c1220" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/icon-128.png">
<link rel="stylesheet" href="${CSS_URL}">${extraCss ? `\n<link rel="stylesheet" href="${extraCss}">` : ""}
<script>${BOOT}</script>
<script src="${JS_URL}" defer></script>
</head>
<body>
<a class="skip" href="#main">${esc(C.skip)}</a>
<header class="top">
  <div class="wrap bar">
    <a class="logo" href="${home}"><img src="/icon.svg" alt="" width="28" height="28"><span>${esc(C.brand)}</span></a>
    <nav class="nav" aria-label="${esc(C.brand)}">
      <a href="${home}#clean">${esc(C.nav.clean)}</a>
      <a href="${home}#translate">${esc(C.nav.tx)}</a>
      <a href="${home}#cost">${esc(C.nav.cost)}</a>
      <a href="${home}#privacy">${esc(C.nav.privacy)}</a>
      <a href="${home}#faq">${esc(C.nav.faq)}</a>
      <a href="${REPO}">GitHub</a>
    </nav>
    <div class="langs">${langNav}</div>
    <a class="btn primary sm top-cta" href="${store(lang, "header")}">${icon("plus")}<span>${esc(C.hero.cta)}</span></a>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="wrap foot-grid">
    <div class="foot-brand"><img src="/icon.svg" alt="" width="24" height="24"><span>${esc(C.brand)}</span><span class="foot-tag">${esc(C.hero.h1)}</span></div>
    <nav class="foot-links">
      <a href="/${lang}/keys/">${esc(C.footer.keys)}</a>
      <a href="/${lang}/privacy/">${esc(C.footer.privacy)}</a>
      <a href="${REPO}">GitHub</a>
      <a href="mailto:${MAIL}">${MAIL}</a>
    </nav>
    <p class="fine">© 2026 OhMyAI · <a href="${REPO}/blob/main/LICENSE">${esc(C.footer.license)}</a> · ${esc(C.footer.disclaimer)}</p>
  </div>
</footer>
</body>
</html>
`;
}

// Chinese wraps between any two characters; centred lines read better broken only after punctuation, so each clause is one inline block
const phrases = (lang, text) => lang !== "zh" ? esc(text) : esc(text).split(/(?<=[，、。；：！？])/).map((p) => `<span class="ph">${p}</span>`).join("");
const cta = (lang, C, medium, label, cls = "btn primary") =>
  `<a class="${cls}" href="${store(lang, medium)}">${icon("plus")}<span>${esc(label)}</span>${C.hero.ctaNote ? `<span class="btn-note">${esc(C.hero.ctaNote)}</span>` : ""}</a>`;
const img = (loc, file, alt, { eager = false, cls = "" } = {}) => {
  const [w, h] = SIZES[loc][file];
  const v = hash(fs.readFileSync(path.join(SITE, "assets", loc, file)));
  return `<img${cls ? ` class="${cls}"` : ""} src="/assets/${loc}/${file}?v=${v}" width="${w}" height="${h}" alt="${esc(alt)}"${eager ? "" : ' loading="lazy"'} decoding="async">`;
};

// ---------- home ----------
// pages rendered by scripts/site-assets.mjs: boxes for each before/after pair and the case crops (marks.json)
const MARKS = Object.fromEntries(Object.values(LANGS).map((l) => [l.assets, JSON.parse(fs.readFileSync(path.join(SITE, "assets", l.assets, "marks.json"), "utf8"))]));
const UI_STR = Object.fromEntries(Object.values(LANGS).map((l) => [l.assets, JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", `${l.assets}.json`), "utf8"))]));
const DOMAIN = { x: "x.com", xnews: "x.com", xsex: "x.com", xhs: "xiaohongshu.com", xhsmark: "xiaohongshu.com", reddit: "reddit.com", mark: "reddit.com", yt: "youtube.com", hn: "news.ycombinator.com" };
const dom = (lang, k) => (lang === "en" && DOMAIN[k] === "xiaohongshu.com" ? "rednote.com" : DOMAIN[k]);
const fmt = (t, vars) => String(t).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
// the CSP has no 'unsafe-inline' for styles, so per-element positions go into a small stylesheet per language (home.css)
let RULES = [];
const rule = (decl) => { const i = RULES.indexOf(decl); return `r${i < 0 ? RULES.push(decl) - 1 : i}`; };

// which boxes each section draws, their colour and their label
const SHOW = {
  clean: { before: ["spam", "abuse", "sexual", "filler"], after: ["spam", "abuse", "filler"] },
  tx: { before: ["foreign"], after: ["tx"] },
  learn: { before: ["target", "same"], after: ["marked", "learned", "undo"] },
};
const TONE = { before: { foreign: "warn", same: "warn", target: "info" }, after: { tx: "info", undo: "info" } };
const LABEL = { after: { spam: "cleaned", abuse: "cleaned", filler: "tucked", tx: "tx", marked: "marked", learned: "learned", undo: "undo" } };

function side(lang, loc, sec, key, which, head, eager) {
  const C = COPY[lang], file = `${key}-${which}.webp`, [w, h] = SIZES[loc][file], T = C.demo.tags;
  const boxes = MARKS[loc][key][which].boxes.filter((b) => SHOW[sec][which].includes(b.kind)).map((b) => {
    const inset = 3, x = Math.max(b.x, inset), r = Math.min(b.x + b.w, w - inset);
    const tone = TONE[which][b.kind] || (which === "before" ? "bad" : "good");
    const pos = rule(`left:${(x / w * 100).toFixed(2)}%;top:${(b.y / h * 100).toFixed(2)}%;width:${((r - x) / w * 100).toFixed(2)}%;height:${(b.h / h * 100).toFixed(2)}%`);
    return `<span class="box ${tone} ${pos}"><span class="box-tag">${esc(T[(LABEL[which] || {})[b.kind] || b.kind])}</span></span>`;
  }).join("");
  return `<div class="side ${which}"><div class="side-head"><span class="dot"></span>${esc(head)}</div>`
    + `<div class="shot-wrap">${img(loc, file, `${C.demo.tabs[key]} · ${head}`, { eager })}<div class="boxes" aria-hidden="true">${boxes}</div></div></div>`;
}

// the whole-page before/after, one scene at a time
function viewer(lang, loc, sec, scenes, captions, heads) {
  const C = COPY[lang];
  const tabs = scenes.map((k, i) => `<button type="button" role="tab" id="${sec}-tab-${k}" aria-controls="${sec}-scene-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-scene="${k}"><span class="tab-name">${esc(C.demo.tabs[k])}</span><span class="tab-dom">${dom(lang, k)}</span></button>`).join("");
  const panels = scenes.map((k, i) => {
    const n = MARKS[loc][k].before.counts || {};
    const keys = sec === "tx" ? ["tx"] : sec === "clean" ? ["clean", "filler"] : [];
    const sum = keys.filter((x) => n[x]).map((x) => `<span class="chip ${x}">${esc(fmt(C.demo.sum[x], { n: n[x] }))}</span>`).join("");
    return `<div class="scene" role="tabpanel" id="${sec}-scene-${k}" aria-labelledby="${sec}-tab-${k}" data-scene="${k}"${i ? " hidden" : ""}>
        <p class="scene-cap">${phrases(lang, captions[k])}</p>
        ${sum ? `<div class="chips">${sum}</div>` : ""}
        <div class="cmp" data-show="before">
          <div class="flip" role="group" aria-label="${esc(C.demo.label)}"><button type="button" data-show="before" aria-pressed="true">${esc(heads[0])}</button><button type="button" data-show="after" aria-pressed="false">${esc(heads[1])}</button></div>
          ${side(lang, loc, sec, k, "before", heads[0], false)}
          ${side(lang, loc, sec, k, "after", heads[1], false)}
        </div>
      </div>`;
  }).join("\n      ");
  return `<div class="demo" aria-label="${esc(C.demo.label)}">
      <div class="scenes" role="tablist" aria-label="${esc(C.demo.label)}">${tabs}</div>
      ${panels}
      <p class="note">${esc(C.demo.note)}</p>
    </div>`;
}

// many small examples: one comment (or a run of them) as it was, and what ClearFlow made of it — crops of the same shots
const SHOWN_CASES = 6;
function caseWall(lang, loc, sec, scenes) {
  const C = COPY[lang], S = UI_STR[loc];
  const lists = scenes.map((k) => (MARKS[loc][k].cases || []).filter((c) => (sec === "tx" ? c.type === "tx" : c.type !== "tx")).map((c) => ({ ...c, k })));
  const all = [];
  let fillers = 0;
  for (let r = 0; lists.some((l) => l.length > r); r++) for (const l of lists) {
    const c = l[r];
    if (!c || (c.type === "filler" && ++fillers > 2)) continue;
    all.push(c);
  }
  const strip = (t) => String(t).replace(S["tx.seeOriginal"], "").replace(/[✦·\s]+$/u, "").replace(/^[✦·\s]+/u, "").trim();
  const card = (c, i) => {
    const what = c.type === "tx" ? strip(c.note) : c.type === "filler" ? S["opt.filler"] : c.tags.join(" · ");
    const tone = c.type === "tx" ? "info" : "good";
    return `<figure class="case${i >= SHOWN_CASES ? " extra" : ""}">
        <figcaption class="case-head"><span class="case-site">${esc(C.demo.site[c.k])}</span><span class="case-what">${esc(what)}</span></figcaption>
        <div class="case-shot before"><span class="case-lbl ${c.type === "tx" ? "warn" : "bad"}">${esc(C.demo.caseBefore)}</span>${c.before.map((f) => img(loc, f, `${C.demo.site[c.k]} · ${C.demo.caseBefore}`)).join("")}</div>
        <div class="case-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg></div>
        <div class="case-shot after"><span class="case-lbl ${tone}">${esc(C.demo.caseAfter)}</span>${img(loc, c.after, `${C.demo.site[c.k]} · ${C.demo.caseAfter}`)}</div>
      </figure>`;
  };
  const extra = all.length - SHOWN_CASES;
  return `<div class="cases" data-more="${extra > 0 ? "closed" : "none"}">
      ${all.map(card).join("\n      ")}
    </div>${extra > 0 ? `<button type="button" class="btn ghost more-btn" data-more-label="${esc(fmt(C.demo.more, { n: extra }))}" data-less-label="${esc(C.demo.less)}">${esc(fmt(C.demo.more, { n: extra }))}</button>` : ""}`;
}

function home(lang) {
  const C = COPY[lang], loc = LANGS[lang].assets;
  RULES = [];
  const have = (list) => list.filter((k) => MARKS[loc][k]);
  const pointsOf = (items, icons) => `<ul class="mod-points">${items.map(([h, p], i) => `<li>${icon(icons[i], "i mp-i")}<div><h3>${phrases(lang, h)}</h3><p>${esc(p)}</p></div></li>`).join("")}</ul>`;
  const steps = C.how.steps.map(([h, p], i) => `<li class="step"><span class="step-n">${i + 1}</span><h3>${phrases(lang, h)}</h3><p>${esc(p)}</p></li>`).join("\n      ");
  const learnSteps = C.learn.steps.map(([h, p], i) => `<li><span class="ls-n">${i + 1}</span><div><h3>${phrases(lang, h)}</h3><p>${esc(p)}</p></div></li>`).join("");
  const PRIV_ICON = ["eyeOff", "send", "key", "code"];
  const priv = C.privacy.items.map(([h, p], i) => `<li class="pv">${icon(PRIV_ICON[i], "i pv-i")}<div><h3>${phrases(lang, h)}</h3><p>${esc(p)}</p></div></li>`).join("\n      ");
  const faq = C.faq.items.map(([q, a]) => `<details class="qa"><summary>${esc(q)}${icon("chevron", "i qa-i")}</summary><p>${a}</p></details>`).join("\n      ");
  const points = C.cost.points.map((p) => `<li>${icon("check", "i ok")}<span>${esc(p)}</span></li>`).join("");
  const trust = C.hero.trust.map((t) => `<li>${icon("check", "i ok")}<span>${esc(t)}</span></li>`).join("");
  const ENTRY_ICON = { clean: "reason", learn: "learn", translate: "translate" };
  const entries = C.hero.entries.map(([id, h, p]) => `<a class="entry ${id}" href="#${id}">${icon(ENTRY_ICON[id], "i entry-i")}<span class="entry-t">${esc(h)}</span><span class="entry-p">${esc(p)}</span><span class="entry-go">${icon("chevron", "i")}</span></a>`).join("");
  const [h1a, h1b] = C.hero.h1Parts;
  const eb = (k) => `<p class="sec-eyebrow">${esc(C.eyebrow[k])}</p>`;
  const cleanScenes = have(C.clean.scenes), txScenes = have(C.tx.scenes), learnScenes = have(C.learn.scenes);
  const ctrl = C.control.points.map((t) => `<li>${icon("check", "i ok")}<span>${esc(t)}</span></li>`).join("");
  const body = `
<section class="hero">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="wrap hero-copy">
    <p class="eyebrow">${esc(C.hero.eyebrow)}</p>
    <h1><span class="ph">${esc(h1a)}</span>${lang === "en" ? " " : ""}<span class="ph accent">${esc(h1b)}</span></h1>
    <p class="lede">${phrases(lang, C.hero.lede)}</p>
    <div class="ctas">
      ${cta(lang, C, "hero", C.hero.cta)}
      <a class="btn ghost" href="${REPO}">${icon("gh")}<span>${esc(C.hero.repo)}</span></a>
    </div>
    <ul class="trust">${trust}</ul>
    <p class="fine">${esc(C.hero.fine)}</p>
  </div>
  <div class="wrap"><nav class="entries" aria-label="${esc(C.brand)}">${entries}</nav></div>
</section>

<section id="clean" class="sec mod">
  <div class="wrap">
    <div class="mod-head">${eb("clean")}<h2>${phrases(lang, C.clean.h2)}</h2><p class="mod-lede">${esc(C.clean.lede)}</p></div>
    ${pointsOf(C.clean.points, ["reason", "filler", "merge"])}
    <h3 class="mod-sub">${esc(C.clean.casesH)}</h3>
    ${caseWall(lang, loc, "clean", cleanScenes)}
    <h3 class="mod-sub">${esc(C.demo.whole)}</h3>
    ${viewer(lang, loc, "clean", cleanScenes, C.clean.captions, [C.demo.before, C.demo.after])}
  </div>
</section>

<section id="learn" class="sec mod alt">
  <div class="wrap">
    <div class="mod-head">${eb("learn")}<h2>${phrases(lang, C.learn.h2)}</h2><p class="mod-lede">${esc(C.learn.lede)}</p></div>
    <ol class="learn-steps">${learnSteps}</ol>
    ${viewer(lang, loc, "learn", learnScenes, C.learn.captions, [C.learn.before, C.learn.after])}
  </div>
</section>

<section id="translate" class="sec mod">
  <div class="wrap">
    <div class="mod-head">${eb("tx")}<h2>${phrases(lang, C.tx.h2)}</h2><p class="mod-lede">${esc(C.tx.lede)}</p></div>
    ${pointsOf(C.tx.points, ["translate", "eye", "spark"])}
    <h3 class="mod-sub">${esc(C.tx.casesH)}</h3>
    ${caseWall(lang, loc, "tx", txScenes)}
    <h3 class="mod-sub">${esc(C.demo.whole)}</h3>
    ${viewer(lang, loc, "tx", txScenes, C.tx.captions, [C.demo.before, C.demo.after])}
  </div>
</section>

<section class="sec spot">
  <div class="wrap spot-grid">
    <div class="spot-copy"><h2>${phrases(lang, C.control.h2)}</h2><p>${esc(C.control.body)}</p><ul class="points">${ctrl}</ul></div>
    <div class="stage pair">${img(loc, "popup.webp", C.control.altPopup, { cls: "popup" })}${img(loc, "settings.webp", C.control.altSettings, { cls: "settings" })}</div>
  </div>
</section>

<section class="sec how">
  <div class="wrap">
    ${eb("how")}
    <h2>${phrases(lang, C.how.h2)}</h2>
    <ol class="steps">
      ${steps}
    </ol>
  </div>
</section>

<section id="cost" class="sec">
  <div class="wrap cost-grid">
    <div class="cost-copy">
      ${eb("cost")}
      <h2>${phrases(lang, C.cost.h2)}</h2>
      <p>${esc(C.cost.body)}</p>
      <ul class="points">${points}</ul>
      <a class="link" href="keys/">${esc(C.cost.cta)}${icon("arrow", "i")}</a>
    </div>
    <div class="stat"><span class="stat-n">${esc(C.cost.stat)}</span><p>${esc(C.cost.statLabel)}</p></div>
  </div>
</section>

<section id="privacy" class="sec dark">
  <div class="wrap">
    ${eb("privacy")}
    <h2>${phrases(lang, C.privacy.h2)}</h2>
    <ul class="pvs">
      ${priv}
    </ul>
    <a class="link" href="privacy/">${esc(C.privacy.more)}${icon("arrow", "i")}</a>
  </div>
</section>

<section id="faq" class="sec">
  <div class="wrap faq-grid">
    <div class="faq-head"><h2>${phrases(lang, C.faq.h2)}</h2></div>
    <div class="qas">
      ${faq}
    </div>
  </div>
</section>

<section class="final">
  <div class="final-bg" aria-hidden="true"></div>
  <div class="wrap final-in">
    <img src="/icon.svg" alt="" width="64" height="64">
    <h2>${phrases(lang, C.final.h2)}</h2>
    ${cta(lang, C, "final", C.final.cta, "btn light")}
  </div>
</section>`;
  const homeCss = RULES.map((d, i) => `.r${i}{${d}}`).join("\n") + "\n";
  write(`${lang}/home.css`, homeCss);
  return shell({ lang, C, title: C.title, description: C.description, pathFor: (l) => `/${l}/`, body, extraCss: `/${lang}/home.css?v=${hash(homeCss)}` });
}

// ---------- keys ----------
function keys(lang) {
  const C = COPY[lang], K = C.keys;
  const secs = K.sections.map((s) => `<section class="card key-card">
      <div class="key-head"><h2>${phrases(lang, s.h2)}</h2><span class="tag">${esc(s.tag)}</span></div>
      <ol class="key-steps">${s.steps.map((t) => `<li><span>${t}</span></li>`).join("")}</ol>
      <p class="key-note">${esc(s.note)}</p>
    </section>`).join("\n    ");
  const after = K.after.map(([h, p]) => `<li><h3>${phrases(lang, h)}</h3><p>${esc(p)}</p></li>`).join("");
  const body = `
<section class="page-head">
  <div class="wrap narrow">
    <h1>${phrases(lang, K.h1)}</h1>
    <p class="lede">${esc(K.lede)}</p>
  </div>
</section>
<section class="sec tight">
  <div class="wrap narrow">
    ${secs}
    <ul class="key-after">${after}</ul>
    <div class="ctas">${cta(lang, C, "keys", C.hero.cta)}<a class="btn ghost" href="/${lang}/">${esc(K.back)}</a></div>
  </div>
</section>`;
  return shell({ lang, C, title: K.title, description: K.description, pathFor: (l) => `/${l}/keys/`, body });
}

// ---------- privacy: PRIVACY.md (English / Chinese), privacy.ja.md (Japanese) ----------
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a href="${u.replace(/&amp;/g, "&")}">${t}</a>`)
    .replace(/(^|[\s(（])(https:\/\/[^\s<)）]+[^\s<)）.,;:，。；])/g, '$1<a href="$2">$2</a>');
}
function markdown(md) {
  const out = [];
  let list = null, para = [];
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; }
    if (list) { out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`); list = null; }
  };
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{1,3}) (.*)$/))) { flush(); const n = m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if (/^---+$/.test(line)) { flush(); continue; }
    if (/^<a id=/.test(line)) { flush(); continue; }
    if ((m = line.match(/^- (.*)$/))) { if (para.length) flush(); (list ||= []).push(m[1]); continue; }
    if (list && /^\s+\S/.test(raw)) { list[list.length - 1] += " " + line.trim(); continue; }
    if (list) flush();
    para.push(line.trim());
  }
  flush();
  return out.join("\n");
}
function privacy(lang) {
  const C = COPY[lang], P = C.privacyPage;
  const md = fs.readFileSync(PRIVACY, "utf8");
  const [en, zh] = md.split(/<a id="中文"><\/a>/);
  const part = (lang === "ja" ? fs.readFileSync(path.join(SITE, "privacy.ja.md"), "utf8") : lang === "zh" ? zh : en).replace(/\s*·\s*\[中文版本见下方\]\(#中文\)/, "");
  const body = `
<section class="page-head">
  <div class="wrap narrow"><p class="src">${esc(P.source)} <a href="${REPO}/blob/main/PRIVACY.md">PRIVACY.md</a></p></div>
</section>
<section class="sec tight">
  <article class="wrap narrow prose" lang="${LANGS[lang].html}">
${markdown(part)}
  </article>
</section>`;
  return shell({ lang, C, title: P.title, description: P.description, pathFor: (l) => `/${l}/privacy/`, body });
}

for (const lang of Object.keys(LANGS)) {
  write(`${lang}/index.html`, home(lang));
  write(`${lang}/keys/index.html`, keys(lang));
  write(`${lang}/privacy/index.html`, privacy(lang));
}

// 404 (one page for every path) and a plain chooser at / in case the worker doesn't answer it
const chooser = (h1, p) => `<!doctype html><html lang="en" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(h1)}</title><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="${CSS_URL}"></head>
<body><main class="chooser"><img src="/icon.svg" alt="" width="56" height="56"><h1>${h1}</h1><p>${p}</p>
<p class="choose">${Object.entries(LANGS).map(([k, v]) => `<a class="btn ghost" href="/${k}/" lang="${v.html}">${v.name}</a>`).join("")}</p></main></body></html>
`;
write("404.html", chooser(Object.keys(LANGS).map((k) => COPY[k].notFound.title).join(" · "), Object.keys(LANGS).map((k) => esc(COPY[k].notFound.body)).join(" ")));
write("index.html", chooser("ClearFlow · 清流", "Choose a language · 选择语言 · 言語を選択"));
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
const pagesFor = ["/", "/keys/", "/privacy/"];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pagesFor.flatMap((p) => Object.keys(LANGS).map((l) => `<url><loc>${ORIGIN}/${l}${p}</loc>${Object.entries(LANGS).map(([k, v]) => `<xhtml:link rel="alternate" hreflang="${v.html}" href="${ORIGIN}/${k}${p}"/>`).join("")}</url>`)).join("\n")}
</urlset>
`);
console.log(`built ${path.relative(process.cwd(), DIST)}`);
