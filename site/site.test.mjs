import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { COPY, LANGS } from "./copy.mjs";
import { pricingFor } from "./copy.pricing.mjs";
import { API } from "./copy.account.mjs";

const DIST = path.resolve("dist");
const read = (...parts) => fs.readFileSync(path.join(DIST, ...parts), "utf8");
const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

for (const lang of Object.keys(LANGS)) {
  test(`${lang}: home has readable cases and decision sections in order`, () => {
    const C = COPY[lang];
    const html = read(lang, "index.html");
    assert.ok(html.includes(`<p class="eyebrow">${esc(C.hero.eyebrow)}</p>`));
    assert.ok(html.includes('class="hero-proof"'));
    assert.ok(html.includes(esc(C.demo.full)));
    assert.ok(!html.includes("undefined"));
    assert.ok(!html.includes("result-demo"));

    const panels = html.split('<div class="scene"').slice(1);
    assert.equal(panels.length, C.clean.scenes.length + C.tx.scenes.length);
    // the hero's link to the examples names the kind of junk without a bare count
    const proof = html.match(/<span class="proof-tag">([^<]*)<\/span>/);
    assert.ok(proof && !/\d\s*$/.test(proof[1]));
    // cleaning: X shows spam, abuse and sexual content; translation: X's own translation improved comes first
    const xClean = panels[0];
    const kinds = new Set([...xClean.matchAll(/<span class="case-tag [a-z]+">([^<]*)<\/span>/g)].map((m) => m[1].replace(/\s*\d+/g, "")));
    assert.ok(kinds.size >= 3, [...kinds].join(" | ")); // e.g. spam, abuse, sexual content
    assert.ok(panels[C.clean.scenes.length].includes('data-scene="xtx"'));
    // a comment in a language the reader may not know carries what it means (Xiaohongshu outside the Chinese page)
    if (lang !== "zh") assert.ok(html.includes('class="case-gloss"'));
    for (const panel of panels) {
      const cases = panel.match(/<figure class="case /g) || [];
      assert.ok(cases.length >= 1 && cases.length <= 4);
      assert.equal((panel.match(/<details class="full-view">/g) || []).length, 1);
      assert.ok(panel.includes("aria-describedby="));
      for (const picture of panel.match(/<picture>[\s\S]*?<\/picture>/g) || []) {
        assert.ok(picture.includes('<source media="(max-width: 599px)"'));
        assert.ok(/<source[^>]+width="\d+" height="\d+"/.test(picture));
        const source = picture.match(/<source[^>]+srcset="([^"]+)"/);
        assert.ok(source && source[1].includes("-mobile-"));
        assert.ok(fs.existsSync(path.join(DIST, source[1].split("?")[0].replace(/^\/+/, ""))));
        const alt = picture.match(/<img[^>]+alt="([^"]*)"/);
        assert.ok(alt && alt[1].trim().length > 0);
      }
    }

    // no link leaves the page for a bare screenshot: "View full size" opens it in the page's dialog; marking is shown in place
    const imageLinks = [...html.matchAll(/<a\b[^>]*href="\/assets\/[^"]+"[^>]*>/g)].map((m) => m[0]);
    assert.ok(imageLinks.every((tag) => tag.includes('class="enlarge"')), imageLinks.filter((t) => !t.includes('class="enlarge"')).join("\n"));
    assert.ok(html.includes('<dialog class="lightbox"') && html.includes(esc(C.demo.close)));
    const learn = html.slice(html.indexOf('id="learn"'), html.indexOf("</section>", html.indexOf('id="learn"')));
    assert.ok(learn.includes("learn-mark-b0.webp") && learn.includes("learn-mark-after.webp") && learn.includes(esc(C.learn.after)));
    const sections = ['id="clean"', 'id="translate"', 'class="sec spot"', 'id="cost"', 'id="privacy"', 'id="learn"', 'class="sec how"', 'id="faq"'];
    const positions = sections.map((marker) => html.indexOf(marker));
    assert.ok(positions.every((position) => position >= 0));
    assert.ok(positions.every((position, i) => i === 0 || position > positions[i - 1]));
  });

  test(`${lang}: required key is expanded and optional key is a disclosure`, () => {
    const html = read(lang, "keys", "index.html");
    assert.equal((html.match(/class="card key-card"/g) || []).length, 2);
    assert.equal((html.match(/<details class="key-optional">/g) || []).length, 1);
    assert.ok(html.includes('<summary class="key-head">'));
    assert.ok(!html.includes("undefined"));
  });
}

// Waffo's store review: pricing, terms and privacy reachable without signing in and linked from every page's footer
for (const lang of Object.keys(LANGS)) {
  test(`${lang}: pricing and terms pages exist and are linked from the footer`, () => {
    const { P } = pricingFor(lang);
    const pricing = read(lang, "pricing", "index.html"), terms = read(lang, "terms", "index.html");
    for (const price of ["$2.90", "$24"]) assert.ok(pricing.includes(price));
    assert.ok(!/class="soon"/.test(pricing), "membership is live: no coming-soon badge"); // 10-26
    assert.equal((pricing.match(/class="plan-cta"/g) || []).length, 3, "free and both paid plans have the install button");
    assert.ok(pricing.includes(`href="/${lang}/terms/"`) && pricing.includes(`href="/${lang}/privacy/"`));
    assert.ok(terms.includes("developer@ohmyai.app") && /7/.test(terms));
    // every site language has its own pricing, terms, privacy, account and payment pages now (10-24): no English fallback blocks
    assert.ok(terms.includes(`<article class="wrap narrow prose" lang="${LANGS[lang].html}">`), "terms in its own language");
    assert.ok(read(lang, "privacy", "index.html").includes(`<article class="wrap narrow prose" lang="${LANGS[lang].html}">`), "privacy in its own language");
    for (const page of [pricing, read(lang, "account", "index.html"), read(lang, "paid", "index.html")]) assert.ok(!/<(section|div) class="[^"]*" lang="en"/.test(page), "no English fallback");
    if (lang !== "en") assert.ok(!/Membership/.test(pricing + terms + read(lang, "account", "index.html")), "membership translated");
    for (const page of [read(lang, "index.html"), pricing, terms, read(lang, "privacy", "index.html")]) {
      const foot = page.slice(page.indexOf('<footer'));
      for (const href of [`/${lang}/pricing/`, `/${lang}/terms/`, `/${lang}/privacy/`]) assert.ok(foot.includes(`href="${href}"`), href);
      assert.ok(foot.includes("mailto:developer@ohmyai.app"));
      assert.ok(!page.includes("undefined"));
    }
  });
}

// account and payment result pages (account-page.js does the work): not indexed, data for the script parses, the API is allowed by the CSP
for (const lang of Object.keys(LANGS)) {
  test(`${lang}: account and payment result pages`, () => {
    for (const [page, slug] of [["account", "account"], ["paid", "paid"]]) {
      const html = read(lang, slug, "index.html");
      assert.ok(html.includes('<meta name="robots" content="noindex">'), slug);
      const data = JSON.parse(html.match(/<script type="application\/json" id="ffData">([^<]*)<\/script>/)[1]);
      assert.equal(data.page, page);
      assert.equal(data.api, API);
      assert.ok(/<script src="\/account\.js\?v=[0-9a-f]{10}" defer><\/script>/.test(html));
      assert.ok(!html.includes("undefined"));
    }
    assert.ok(read(lang, "paid", "index.html").includes('id="paidTitle"'));
    assert.ok(read(lang, "account", "index.html").includes('id="account"'));
    assert.ok(read(lang, "index.html").includes(`href="/${lang}/account/"`), "footer links the account page");
  });
}
test("CSP lets only the account script talk to the API", () => {
  const headers = fs.readFileSync(path.join(DIST, "_headers"), "utf8");
  assert.ok(headers.includes(`connect-src ${API};`));
  assert.ok(fs.existsSync(path.join(DIST, "account.js")));
});

test("404 offers a localized home action instead of a language picker", () => {
  const html = read("404.html");
  const links = [...html.matchAll(/<a class="btn primary" data-not-found-copy="([a-z]+)" href="\/([a-z]+)\/" lang="([^"]+)"( hidden)?>(.*?)<\/a>/g)];
  assert.equal(links.length, Object.keys(LANGS).length);
  assert.ok(!html.includes('class="btn ghost"'));
  assert.match(read("style.css"), /\.choose \[hidden\]\s*\{\s*display:\s*none;/);
  for (const [, lang, hrefLang, htmlLang, hidden, label] of links) {
    assert.equal(lang, hrefLang);
    assert.equal(htmlLang, LANGS[lang].html);
    assert.equal(label, esc(COPY[lang].notFound.home));
    assert.equal(Boolean(hidden), lang !== "en");
  }
});

test("root keeps its language chooser", () => {
  const html = read("index.html");
  assert.ok(html.includes("data-language-entry"));
  assert.equal((html.match(/hreflang=/g) || []).length, Object.keys(LANGS).length);
});
