import assert from "node:assert/strict";
import vm from "node:vm";
import { sitePages } from "./showcase.mjs";

const expected = ["x", "xtx", "xhs", "reddit", "yt", "mark", "xhsmark"];
const unescape = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
const bare = (s) => s.replace(/@[\w.]+/g, " "); // authored X comments only contain @handles
for (const loc of ["ko", "tr", "fr", "pt"]) {
  const pages = sitePages(loc);
  assert.deepEqual(pages.map((p) => p.key), expected);
  for (const p of pages) {
    assert.equal(p.path, `/sc/${loc}/${p.key}`);
    assert.match(p.html, new RegExp(`<html lang="${loc}"`));
    assert.ok(p.marks.length >= (p.key === "xtx" ? 0 : p.key.endsWith("mark") ? 3 : 2)); // xtx: X 的译文改进，没有要清理的
    if (p.dict) {
      assert.ok(p.foreign.length >= (p.key === "xtx" ? 2 : 4), `${loc}/${p.key}: no foreign translation samples`);
      assert.ok(Object.values(p.dict).every((tx) => typeof tx === "string" && tx.length));
    }
  }
  const script = pages[0].html.match(/<script>(window\.__ffDetect = .*?\n};)/s)?.[1];
  assert.ok(script);
  const detect = (p) => {
    const context = { window: {} };
    vm.runInNewContext(script, context);
    const own = p.html.match(/window\.__ffOwn = \{.*?\};/s)?.[0];
    if (own) vm.runInNewContext(own, context);
    return (text) => context.window.__ffDetect(text).languages[0]?.language;
  };
  for (const p of pages) {
    const language = detect(p);
    if (p.key === "x" || p.key === "mark") {
      const texts = p.key === "x"
        ? [...p.html.matchAll(/data-testid="tweetText">([^<]*)<\/div>/g)].map((m) => unescape(m[1]))
        : [...p.html.matchAll(/<h1 slot="title"[^>]*>([^<]*)<\/h1>|<p>([^<]*)<\/p>/g)].map((m) => unescape(m[1] || m[2]));
      assert.equal(texts.length, p.key === "x" ? 15 : 8); // X：14 条 + 色情回复（官网的例子要有色情这一类）
      for (const text of texts) {
        if (!/[\p{L}]/u.test(text)) continue;
        assert.equal(language(bare(text)), loc, `${loc}/${p.key}: ${text}`);
      }
    }
    // xtx 的 dict 是"X 的译文 → 改进后的译文"，两边都是这个语言，不按外文查
    for (const [src, tx] of Object.entries(p.key === "xtx" ? {} : p.dict || {})) {
      if (src === tx) assert.equal(language(src), loc, `${loc}/${p.key} same-language: ${src}`);
      else {
        assert.ok(language(src), `${loc}/${p.key} unknown foreign language: ${src}`);
        assert.notEqual(language(src), loc, `${loc}/${p.key} foreign: ${src}`);
      }
    }
  }
  console.log(`${loc}: ${pages.length} scenes, ${pages.reduce((sum, p) => sum + p.foreign.length, 0)} translation samples`);
}
