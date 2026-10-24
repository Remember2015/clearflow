// Builds the website (https://clearflow.ohmyai.app) into site/dist/: one route per language (home, keys/, privacy/), 404.html,
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
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  gh: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  spark: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>',
};
const icon = (k, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;

// ---------- page shell ----------
function shell({ lang, C, title, description, pathFor, body }) {
  const L = LANGS[lang];
  const url = ORIGIN + pathFor(lang);
  const alternates = Object.entries(LANGS).map(([k, v]) => `<link rel="alternate" hreflang="${v.html}" href="${ORIGIN}${pathFor(k)}">`).join("")
    + `<link rel="alternate" hreflang="x-default" href="${ORIGIN}${pathFor("en")}">`;
  const flag = (L) => `<img class="language-flag" src="/assets/flags/${L.flag}.svg" width="20" height="15" alt="">`;
  const langNav = Object.entries(LANGS).map(([k, v]) => `<a href="${pathFor(k)}" hreflang="${v.html}" lang="${v.html}"${k === lang ? ' aria-current="true"' : ""}>${flag(v)}<span>${v.name}</span>${k === lang ? icon("check", "i language-check") : ""}</a>`).join("");
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
<link rel="stylesheet" href="${CSS_URL}">
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
    <details class="langs">
      <summary aria-label="${esc(C.languageLabel)}: ${esc(L.name)}">${flag(L)}<span lang="${L.html}">${L.shortName || L.name}</span>${icon("chevron", "i language-chevron")}</summary>
      <nav class="language-options" aria-label="${esc(C.languageLabel)}">${langNav}</nav>
    </details>
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

// Let the browser wrap natural phrases for each language.
const phrases = (_lang, text) => esc(text);
const cta = (lang, C, medium, label, cls = "btn primary") =>
  `<a class="${cls}" href="${store(lang, medium)}">${icon("plus")}<span>${esc(label)}</span>${C.hero.ctaNote ? `<span class="btn-note">${esc(C.hero.ctaNote)}</span>` : ""}</a>`;
const img = (loc, file, alt, { eager = false, cls = "", sizes = "", describedBy = "" } = {}) => {
  const [w, h] = SIZES[loc][file];
  const v = hash(fs.readFileSync(path.join(SITE, "assets", loc, file)));
  const preview = file.replace(/\.webp$/, "-preview.webp");
  const previewPath = path.join(SITE, "assets", loc, preview);
  const responsive = sizes && fs.existsSync(previewPath)
    ? ` srcset="/assets/${loc}/${preview}?v=${hash(fs.readFileSync(previewPath))} 800w, /assets/${loc}/${file}?v=${v} ${w * 2}w" sizes="${sizes}"` : "";
  return `<img${cls ? ` class="${cls}"` : ""} src="/assets/${loc}/${file}?v=${v}"${responsive} width="${w}" height="${h}" alt="${esc(alt)}"${describedBy ? ` aria-describedby="${esc(describedBy)}"` : ""}${eager ? "" : ' loading="lazy"'} decoding="async">`;
};

// ---------- home ----------
// Screenshot metadata generated by scripts/site-assets.mjs includes the displayed counts and readable case text.
const MARKS = Object.fromEntries(Object.values(LANGS).map((l) => [l.assets, JSON.parse(fs.readFileSync(path.join(SITE, "assets", l.assets, "marks.json"), "utf8"))]));
const DOMAIN = { x: "x.com", xtx: "x.com", xnews: "x.com", xsex: "x.com", xhs: "xiaohongshu.com", xhsmark: "xiaohongshu.com", reddit: "reddit.com", mark: "reddit.com", yt: "youtube.com", hn: "news.ycombinator.com" };
const fmt = (t, vars) => String(t).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const platformLogo = (scene) => {
  const key = { xnews: "x", xsex: "x", xtx: "x", mark: "reddit", xhsmark: "xhs" }[scene] || scene;
  return `<img class="platform-logo" src="/assets/logos/${key}.svg" width="24" height="24" alt="">`;
};

function side(loc, key, which, head, enlarge, captionId) {
  const sizes = "(max-width: 599px) calc(100vw - 70px), (max-width: 899px) min(640px, calc(100vw - 106px)), (max-width: 1223px) calc(50vw - 69px), 543px";
  const file = `${key}-${which}.webp`;
  return `<div class="side ${which}"><div class="side-head"><span class="dot" aria-hidden="true"></span>${esc(head)}<a class="enlarge" href="/assets/${loc}/${file}" target="_blank" rel="noopener" data-label="${esc(head)}" aria-label="${esc(`${DOMAIN[key]} · ${head} · ${enlarge}`)}">${esc(enlarge)}</a></div>
    <div class="shot-wrap">${img(loc, file, `${DOMAIN[key]} · ${head}`, { sizes, describedBy: captionId })}</div></div>`;
}

// Within one case the "before" and "after" crops share one scale, set by the widest of them: a narrow crop (the "nice"-line notice)
// stays as small as it is next to the comments it replaced instead of being blown up to the column. --w on wide screens, --wm on phones.
const mobileOf = (file) => file.replace(/-after\.webp$/, "-mobile-after.webp").replace(/-b(\d+)\.webp$/, "-mobile-b$1.webp");
function caseImage(loc, file, alt, describedBy = "", base = null) {
  const mobile = mobileOf(file);
  const [mw, mh] = SIZES[loc][mobile];
  const v = hash(fs.readFileSync(path.join(SITE, "assets", loc, mobile)));
  const [w] = SIZES[loc][file];
  const pct = (x, of) => (of ? Math.min(100, Math.round((x / of) * 1000) / 10) : 100);
  const share = pct(w, base && base.w), shareM = pct(mw, base && base.wm);
  const style = share < 98 || shareM < 98 ? ` style="--w:${share}%;--wm:${shareM}%"` : "";
  return `<picture><source media="(max-width: 599px)" srcset="/assets/${loc}/${mobile}?v=${v}" width="${mw}" height="${mh}">${img(loc, file, alt, { describedBy }).replace("<img", `<img${style}`)}</picture>`;
}

// A translation's note as the extension shows it ("Translated from German · Show original"): the case's tag is just its first part.
// The link words come from the extension's own strings in the page's language (i18n/<lang>.json).
const UI_STR = Object.fromEntries(Object.entries(LANGS).map(([lang, L]) => {
  const f = path.join(ROOT, "i18n", `${L.assets}.json`);
  return [lang, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {}];
}));
const noteLabel = (lang, note) => {
  const S = UI_STR[lang] || {};
  let t = String(note || "");
  for (const k of ["tx.seeOriginal", "tx.seeGrok"]) if (S[k] && t.endsWith(S[k])) t = t.slice(0, -S[k].length);
  return t.replace(/[\s·]+$/, "");
};
function caseFigure(lang, loc, key, c, heads, captionId) {
  const C = COPY[lang];
  const label = c.type === "tx" ? noteLabel(lang, c.note) : c.type === "filler" ? C.clean.points[1][0] : c.tags.join(" · ");
  // translation cases: the image's text alternative is the note and the translated text (afterText also has the hidden original)
  const afterText = c.type === "tx" ? (c.translated ? `${c.note} · ${c.translated}` : c.afterText) : label;
  // a comment in a language the reader may not know (Xiaohongshu on the English page, an English scam on the Japanese one):
  // what it means, in the page's language, under its "before" crop
  const files = [...c.before, c.after], base = { w: Math.max(...files.map((f) => SIZES[loc][f][0])), wm: Math.max(...files.map((f) => SIZES[loc][mobileOf(f)][0])) };
  const gloss = (i) => (c.gloss && c.gloss[i] ? `<p class="case-gloss"><span class="gloss-k">${esc(C.demo.gloss)}</span> ${esc(c.gloss[i])}</p>` : "");
  const before = c.before.map((file, i) => caseImage(loc, file, c.beforeText[i] || `${DOMAIN[key]} · ${heads[0]}`, "", base) + gloss(i)).join("");
  return `<figure class="case ${c.type}">
    <figcaption class="case-head"><span class="case-tag ${c.type}">${esc(label)}</span></figcaption>
    <div class="case-compare">
      <div class="case-side before"><span class="case-label">${esc(heads[0])}</span><div class="case-images">${before}</div></div>
      <div class="case-side after"><span class="case-label">${esc(heads[1])}</span><div class="case-images">${caseImage(loc, c.after, afterText || `${DOMAIN[key]} · ${heads[1]}`, captionId, base)}</div></div>
    </div>
  </figure>`;
}

// Which cases a tab shows: up to 4 cleaning cases (3 translations), one of each kind first (spam / abuse / sexual / "nice"-type),
// then more of the same; fewer images per case first. The kind is the notice's labels without their counts.
const kindOf = (c) => c.type === "tx" ? c.note : c.type === "filler" ? "filler" : c.tags.map((t) => t.replace(/\s*\d+$/, "")).sort().join("+");
function pickCases(all, sec) {
  const list = all.filter((c) => (sec === "tx" ? c.type === "tx" : c.type !== "tx"));
  const max = sec === "tx" ? 3 : 4, seen = new Set(), first = [], rest = [];
  for (const c of list) (seen.has(kindOf(c)) ? rest : first).push(c), seen.add(kindOf(c));
  return [...first, ...rest].slice(0, max).sort((a, b) => a.before.length - b.before.length);
}

// Marking, shown in place: the scam reply with its funnel and the two like it before, the same stretch after marking (scripts/site-assets.mjs
// crops it from the marking page as learn-mark-b0 / learn-mark-after). It used to be a link that opened the full screenshot on its own.
function learnFigure(lang, loc) {
  const C = COPY[lang], L = MARKS[loc].mark && MARKS[loc].mark.learn;
  if (!L || !L.before || !L.after) throw new Error(`${loc}: no marking crops (node scripts/site-assets.mjs --pages mark,xhsmark)`);
  const files = [L.before, L.after];
  const base = { w: Math.max(...files.map((f) => SIZES[loc][f][0])), wm: Math.max(...files.map((f) => SIZES[loc][mobileOf(f)][0])) };
  return `<figure class="case learn-case"><div class="case-compare">
      <div class="case-side before"><span class="case-label">${esc(C.learn.before)}</span><div class="case-images">${caseImage(loc, L.before, `${DOMAIN.mark} · ${C.learn.before}`, "", base)}</div></div>
      <div class="case-side after"><span class="case-label">${esc(C.learn.after)}</span><div class="case-images">${caseImage(loc, L.after, `${DOMAIN.mark} · ${C.learn.after}`, "", base)}</div></div>
    </div></figure>`;
}

// Readable case crops come first; the full-page comparison is available on demand.
function viewer(lang, loc, sec, scenes, captions, heads) {
  const C = COPY[lang];
  const tabs = scenes.map((k, i) => `<button type="button" role="tab" id="${sec}-tab-${k}" aria-controls="${sec}-scene-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-scene="${k}">${platformLogo(k)}<span>${esc(C.demo.tabs[k])}</span></button>`).join("");
  const panels = scenes.map((k, i) => {
    const n = MARKS[loc][k].before.counts || {};
    const keys = sec === "tx" ? ["tx"] : ["clean", "filler"];
    const sum = keys.filter((x) => n[x]).map((x) => `<span class="chip ${x}">${esc(fmt(C.demo.sum[x], { n: n[x] }))}</span>`).join("");
    const captionId = `${sec}-${k}-caption`;
    const cases = pickCases(MARKS[loc][k].cases || [], sec);
    return `<div class="scene" role="tabpanel" tabindex="0" id="${sec}-scene-${k}" aria-labelledby="${sec}-tab-${k}" data-scene="${k}"${i ? " hidden" : ""}>
      <div class="scene-footer"><p class="scene-cap" id="${captionId}">${esc(captions[k])}</p>${sum ? `<div class="chips">${sum}</div>` : ""}</div>
      <div class="cases">${cases.map((c) => caseFigure(lang, loc, k, c, heads, captionId)).join("")}</div>
      <details class="full-view"><summary>${esc(C.demo.full)}${icon("chevron", "i full-i")}</summary>
        <div class="cmp" data-show="after">
          <div class="flip" role="group" aria-label="${esc(C.demo.label)}"><button type="button" data-show="before" aria-pressed="false">${esc(heads[0])}</button><button type="button" data-show="after" aria-pressed="true">${esc(heads[1])}</button></div>
          ${side(loc, k, "before", heads[0], C.demo.enlarge, captionId)}
          ${side(loc, k, "after", heads[1], C.demo.enlarge, captionId)}
        </div>
      </details>
    </div>`;
  }).join("\n");
  return `<div class="demo" aria-label="${esc(C.demo.label)}">
    <div class="scenes" role="tablist" aria-label="${esc(C.demo.label)}">${tabs}</div>
    ${panels}
    <p class="note">${esc(C.demo.note)}</p>
  </div>`;
}

function home(lang) {
  const C = COPY[lang], loc = LANGS[lang].assets;
  const have = (list) => {
    for (const key of list) if (!MARKS[loc][key]) throw new Error(`Missing showcase: ${loc}/${key}`);
    return list;
  };
  const pointsOf = (items, icons) => `<ul class="mod-points">${items.map(([h, p], i) => `<li>${icon(icons[i], "i mp-i")}<div><h3>${phrases(lang, h)}</h3><p>${esc(p)}</p></div></li>`).join("")}</ul>`;
  const steps = C.how.steps.map(([h, p], i) => `<li class="step"><span class="step-n">${i + 1}</span><h3>${phrases(lang, h)}</h3><p>${esc(p)}</p></li>`).join("\n      ");
  const learnSteps = C.learn.steps.map(([h, p], i) => `<li><span class="ls-n">${i + 1}</span><div><h3>${phrases(lang, h)}</h3><p>${esc(p)}</p></div></li>`).join("");
  const PRIV_ICON = ["eyeOff", "send", "key", "code"];
  const priv = C.privacy.items.map(([h, p], i) => `<li class="pv">${icon(PRIV_ICON[i], "i pv-i")}<div><h3>${phrases(lang, h)}</h3><p>${esc(p)}</p></div></li>`).join("\n      ");
  const faq = C.faq.items.map(([q, a]) => `<details class="qa"><summary>${esc(q)}${icon("chevron", "i qa-i")}</summary><p>${a}</p></details>`).join("\n      ");
  const points = C.cost.points.map((p) => `<li>${icon("check", "i ok")}<span>${esc(p)}</span></li>`).join("");
  const trust = C.hero.trust.map((t) => `<li>${icon("check", "i ok")}<span>${esc(t)}</span></li>`).join("");
  const platforms = Object.entries(C.platforms.names).map(([key, name]) => `<li>${platformLogo(key)}<span>${esc(name)}</span></li>`).join("");
  const [h1a, h1b] = C.hero.h1Parts;
  const cleanScenes = have(C.clean.scenes), txScenes = have(C.tx.scenes);
  const proofCase = MARKS[loc].x.cases.find((c) => c.type === "clean");
  // the kind of junk without its count ("Likely spam", not "Likely spam 3": a bare number reads as nothing out of context)
  const proofTag = proofCase ? proofCase.tags[0].replace(/\s*\d+$/, "") : C.clean.points[0][0];
  const ctrl = C.control.points.map((t) => `<li>${icon("check", "i ok")}<span>${esc(t)}</span></li>`).join("");
  const body = `
<section class="hero">
  <div class="wrap hero-copy">
    <p class="eyebrow">${esc(C.hero.eyebrow)}</p>
    <h1><span class="ph">${esc(h1a)}</span>${["zh", "ja"].includes(lang) ? "" : " "}<span class="ph accent">${esc(h1b)}</span></h1>
    <p class="lede">${phrases(lang, C.hero.lede)}</p>
    <div class="ctas">
      ${cta(lang, C, "hero", C.hero.cta)}
    </div>
    <a class="hero-proof" href="#clean"><span class="proof-tag">${esc(proofTag)}</span><span class="proof-text">${esc(C.clean.points[0][0])}</span>${icon("eye", "i")}</a>
    <ul class="trust">${trust}</ul>
  </div>
  <div class="wrap">
    <div class="platforms" aria-label="${esc(C.platforms.label)}">
      <p>${esc(C.platforms.label)}</p>
      <ul>${platforms}</ul>
    </div>
  </div>
</section>

<section id="clean" class="sec mod">
  <div class="wrap">
    <div class="mod-head"><h2>${phrases(lang, C.clean.h2)}</h2><p class="mod-lede">${esc(C.clean.lede)}</p></div>
    ${viewer(lang, loc, "clean", cleanScenes, C.clean.captions, [C.demo.before, C.demo.after])}
    ${pointsOf(C.clean.points, ["reason", "filler", "merge"])}
    ${cta(lang, C, "clean", C.hero.cta, "btn ghost section-cta")}
  </div>
</section>

<section id="translate" class="sec mod alt">
  <div class="wrap">
    <div class="mod-head"><h2>${phrases(lang, C.tx.h2)}</h2><p class="mod-lede">${esc(C.tx.lede)}</p></div>
    ${viewer(lang, loc, "tx", txScenes, C.tx.captions, [C.demo.before, C.demo.after])}
    ${pointsOf(C.tx.points, ["translate", "eye", "spark"])}
  </div>
</section>

<section class="sec spot">
  <div class="wrap spot-grid">
    <div class="spot-copy"><h2>${phrases(lang, C.control.h2)}</h2><p>${esc(C.control.body)}</p><ul class="points">${ctrl}</ul></div>
    <div class="stage pair">${img(loc, "popup.webp", C.control.altPopup, { cls: "popup" })}${img(loc, "settings.webp", C.control.altSettings, { cls: "settings" })}</div>
  </div>
</section>

<section id="cost" class="sec">
  <div class="wrap cost-grid">
    <div class="cost-copy">
      <h2>${phrases(lang, C.cost.h2)}</h2>
      <p>${esc(C.cost.body)}</p>
      <ul class="points">${points}</ul>
      <div class="cost-actions">${cta(lang, C, "cost", C.hero.cta)}<a class="link" href="keys/">${esc(C.cost.cta)}${icon("arrow", "i")}</a></div>
    </div>
    <div class="stat"><span class="stat-n">${esc(C.cost.stat)}</span><p>${esc(C.cost.statLabel)}</p></div>
  </div>
</section>

<section id="privacy" class="sec dark">
  <div class="wrap">
    <h2>${phrases(lang, C.privacy.h2)}</h2>
    <ul class="pvs">
      ${priv}
    </ul>
    <a class="link" href="privacy/">${esc(C.privacy.more)}${icon("arrow", "i")}</a>
  </div>
</section>

<section id="learn" class="sec mod learn-compact">
  <div class="wrap">
    <div class="learn-grid">
      <div class="learn-copy">
        <div class="mod-head"><h2>${phrases(lang, C.learn.h2)}</h2><p class="mod-lede">${esc(C.learn.lede)}</p></div>
      </div>
      <ol class="learn-steps">${learnSteps}</ol>
    </div>
    ${learnFigure(lang, loc)}
  </div>
</section>

<section class="sec how">
  <div class="wrap">
    <h2>${phrases(lang, C.how.h2)}</h2>
    <ol class="steps">
      ${steps}
    </ol>
  </div>
</section>

<dialog class="lightbox" aria-label="${esc(C.demo.enlarge)}"><button type="button" class="lightbox-close" aria-label="${esc(C.demo.close)}">${icon("x", "i")}</button><p class="lightbox-cap"></p><img alt=""></dialog>

<section id="faq" class="sec">
  <div class="wrap faq-grid">
    <div class="faq-head"><h2>${phrases(lang, C.faq.h2)}</h2></div>
    <div class="qas">
      ${faq}
    </div>
  </div>
</section>

<section class="final">
  <div class="wrap final-in">
    <img src="/icon.svg" alt="" width="64" height="64">
    <h2>${phrases(lang, C.final.h2)}</h2>
    ${cta(lang, C, "final", C.final.cta, "btn light")}
  </div>
</section>`;
  return shell({ lang, C, title: C.title, description: C.description, pathFor: (l) => `/${l}/`, body });
}

// ---------- keys ----------
function keys(lang) {
  const C = COPY[lang], K = C.keys;
  const secs = K.sections.map((s, i) => {
    const steps = `<ol class="key-steps">${s.steps.map((t) => `<li><span>${t}</span></li>`).join("")}</ol><p class="key-note">${esc(s.note)}</p>`;
    if (i === 0) return `<section class="card key-card"><div class="key-head"><h2>${phrases(lang, s.h2)}</h2><span class="tag">${esc(s.tag)}</span></div>${steps}</section>`;
    return `<section class="card key-card"><details class="key-optional"><summary class="key-head"><span class="key-summary-title">${phrases(lang, s.h2)}</span><span class="tag">${esc(s.tag)}</span>${icon("chevron", "i key-chevron")}</summary>${steps}</details></section>`;
  }).join("\n    ");
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
  const part = (lang === "zh" ? zh : lang === "en" ? en : fs.readFileSync(path.join(SITE, `privacy.${lang}.md`), "utf8")).replace(/\s*·\s*\[中文版本见下方\]\(#中文\)/, "");
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
const chooser = (h1, p, auto = false, recovery = false) => `<!doctype html><html lang="en" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(h1)}</title><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="${CSS_URL}"></head>
<body><main class="chooser"${auto ? ' data-language-entry' : ""}><img src="/icon.svg" alt="" width="56" height="56"><h1>${h1}</h1><p>${p}</p>
<p class="choose">${recovery ? Object.entries(COPY).map(([k, C]) => `<a class="btn primary" data-not-found-copy="${k}" href="/${k}/" lang="${LANGS[k].html}"${k === "en" ? "" : " hidden"}>${esc(C.notFound.home)}</a>`).join("") : Object.entries(LANGS).map(([k, v]) => `<a class="btn ghost" href="/${k}/" hreflang="${v.html}" lang="${v.html}">${v.name}</a>`).join("")}</p></main><script src="${JS_URL}" defer></script></body></html>
`;
write("404.html", chooser("404", Object.entries(COPY).map(([lang, C]) => `<span data-not-found-copy="${lang}" lang="${LANGS[lang].html}"${lang === "en" ? "" : " hidden"}>${esc(C.notFound.body)}</span>`).join(""), false, true));
write("index.html", chooser("ClearFlow · 清流", "Choose a language · 选择语言 · 言語を選択", true));
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
const pagesFor = ["/", "/keys/", "/privacy/"];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pagesFor.flatMap((p) => Object.keys(LANGS).map((l) => `<url><loc>${ORIGIN}/${l}${p}</loc>${Object.entries(LANGS).map(([k, v]) => `<xhtml:link rel="alternate" hreflang="${v.html}" href="${ORIGIN}/${k}${p}"/>`).join("")}</url>`)).join("\n")}
</urlset>
`);
console.log(`built ${path.relative(process.cwd(), DIST)}`);
