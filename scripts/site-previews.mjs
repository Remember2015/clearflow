// Smaller page previews; the original 2x screenshots remain available for zooming.
// Run after changing screenshots: node scripts/site-previews.mjs [en zh-CN ja]
// Requires cwebp (libwebp). The normal website build needs only Node.js.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { COPY, LANGS } from "../site/copy.mjs";

const assets = new URL("../site/assets/", import.meta.url);
const only = process.argv.slice(2);
let originalBytes = 0, previewBytes = 0, count = 0;
for (const [lang, L] of Object.entries(LANGS)) {
  if (only.length && !only.includes(L.assets)) continue;
  const C = COPY[lang], dir = path.join(assets.pathname, L.assets);
  const files = new Set([
    ...[...C.clean.scenes, ...C.tx.scenes].flatMap((scene) => [`${scene}-before.webp`, `${scene}-after.webp`]),
    ...C.learn.scenes.map((scene) => `${scene}-after.webp`),
  ]);
  for (const file of files) {
    const input = path.join(dir, file), output = input.replace(/\.webp$/, "-preview.webp");
    execFileSync("cwebp", ["-quiet", "-q", "85", "-resize", "800", "0", input, "-o", output]);
    originalBytes += fs.statSync(input).size;
    previewBytes += fs.statSync(output).size;
    count++;
  }
}
console.log(`${count} previews: ${Math.round(originalBytes / 1024)} → ${Math.round(previewBytes / 1024)} KiB (${Math.round(100 * (1 - previewBytes / originalBytes))}% smaller)`);
