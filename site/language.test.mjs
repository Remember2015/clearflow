import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import worker, { pick } from "./worker.js";
import { LANGS } from "./locales.mjs";

for (const [header, expected] of [
  ["zh-CN,zh;q=0.9,en;q=0.8", "zh"],
  ["ja-JP,en;q=0.8", "ja"],
  ["en-GB", "en"],
  ["ko-KR,ja;q=0.8,en;q=0.6", "ko"],
  ["tr-TR", "tr"],
  ["fr-CA", "fr"],
  ["pt-PT", "pt"],
  ["pt-BR", "pt"],
  ["de-DE,ja;q=0.8", "ja"],
  ["zh;q=0,ja;q=0.8", "ja"],
  ["en;q=0.5,ja;q=0.9", "ja"],
  [null, "en"],
]) assert.equal(pick(header), expected, String(header));

for (const [key, lang] of Object.entries(LANGS)) assert.equal(pick(lang.html), key);

const env = { ASSETS: { fetch: async () => new Response("static page") } };
for (const [path, expected] of [["/", "/ja/"], ["/keys", "/ja/keys/"], ["/privacy/", "/ja/privacy/"], ["/pricing", "/ja/pricing/"], ["/terms/", "/ja/terms/"], ["/account", "/ja/account/"], ["/paid/", "/ja/paid/"]]) {
  const response = await worker.fetch(new Request(`https://example.com${path}?ref=test`, { headers: { "Accept-Language": "ja-JP" } }), env);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), `https://example.com${expected}?ref=test`);
  assert.equal(response.headers.get("Vary"), "Accept-Language");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
}
// Explicit language URLs must remain usable regardless of the browser preference.
const explicit = await worker.fetch(new Request("https://example.com/en/keys/", { headers: { "Accept-Language": "zh-CN" } }), env);
assert.equal(await explicit.text(), "static page");

// Run the actual static-entry fallback; unsupported preferences should try the next language.
const source = fs.readFileSync(new URL("./main.js", import.meta.url), "utf8");
const links = Object.entries(LANGS).map(([key, value]) => ({ hreflang: value.html, pathname: `/${key}/` }));
for (const [languages, expected] of [[["ja-JP"], "ja"], [["zh-TW"], "zh"], [["ko", "ja"], "ko"], [["tr"], "tr"], [["fr-CA"], "fr"], [["pt-PT"], "pt"], [["de-DE"], "en"], [[], "en"]]) {
  let destination;
  vm.runInNewContext(source, {
    document: { querySelector: () => ({ querySelectorAll: () => links }), querySelectorAll: () => [] },
    navigator: { languages, language: "en-US" },
    location: { search: "?ref=test", hash: "#cost", replace: (url) => { destination = url; } },
  });
  assert.equal(destination, `/${expected}/?ref=test#cost`);
}
console.log("PASS: language priority, entry redirects, explicit URLs and static fallback");

// The shared 404 respects explicit routes, then browser preferences.
for (const [pathname, languages, expected] of [["/ko/missing", ["fr"], "ko"], ["/missing", ["pt-BR"], "pt"], ["/missing", ["de"], "en"]]) {
  const nodes = Object.entries(LANGS).map(([key, lang]) => ({ dataset: { notFoundCopy: key }, lang: lang.html, hidden: key !== "en" }));
  const root = { lang: "en" };
  vm.runInNewContext(source, {
    document: { documentElement: root, querySelector: () => null, querySelectorAll: (selector) => selector === "[data-not-found-copy]" ? nodes : [] },
    navigator: { languages, language: "en-US" }, location: { pathname },
  });
  assert.deepEqual(nodes.filter((node) => !node.hidden).map((node) => node.dataset.notFoundCopy), [expected]);
  assert.equal(root.lang, LANGS[expected].html);
}
console.log("PASS: localized 404 and browser-language fallback");
