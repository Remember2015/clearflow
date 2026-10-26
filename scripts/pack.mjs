// Packs the extension for the Chrome Web Store: dist/clearflow-<version>.zip.
// Takes everything in extension/ except tests, docs and dotfiles, adds LICENSE, and checks that every file the manifest
// (and the two HTML pages) references is in the zip. Run `npm run build` first so ui/ and the notices are current.
// Usage: node scripts/pack.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const EXT = path.join(ROOT, "extension");
const manifest = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));
const EXCLUDE = [/^test\//, /\.md$/i, /(^|\/)\./];

function walk(dir, base = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = base ? `${base}/${e.name}` : e.name;
    return e.isDirectory() ? walk(path.join(dir, e.name), rel) : [rel];
  });
}
const files = walk(EXT).filter((f) => !EXCLUDE.some((re) => re.test(f))).sort();

// Everything the manifest and the extension pages point at must be packed
const refs = new Set(["manifest.json", manifest.background.service_worker, manifest.action.default_popup, manifest.options_page,
  ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon || {}),
  ...manifest.content_scripts.flatMap((c) => [...(c.js || []), ...(c.css || [])])]);
for (const page of [manifest.action.default_popup, manifest.options_page]) {
  const html = fs.readFileSync(path.join(EXT, page), "utf8");
  for (const m of html.matchAll(/(?:src|href)="([^":#]+)"/g)) refs.add(m[1].replace(/^\.\//, ""));
}
// ES module imports from the background worker and the bundles
const seen = new Set();
(function imports(file) {
  if (seen.has(file) || !file.endsWith(".js")) return;
  seen.add(file);
  const src = fs.readFileSync(path.join(EXT, file), "utf8");
  for (const m of src.matchAll(/(?:import|from)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) {
    const dep = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1]));
    refs.add(dep); imports(dep);
  }
})(manifest.background.service_worker);
for (const f of files.filter((f) => f.startsWith("ui/") && f.endsWith(".js"))) {
  const src = fs.readFileSync(path.join(EXT, f), "utf8");
  for (const m of src.matchAll(/from\s*["'](\.\/[^"']+)["']|import\s*["'](\.\/[^"']+)["']/g)) refs.add(path.posix.join("ui", (m[1] || m[2]).slice(2)));
}
const missing = [...refs].filter((r) => !files.includes(r));
if (missing.length) { console.error(`Referenced but not packed: ${missing.join(", ")}`); process.exit(1); }
for (const need of ["THIRD_PARTY_NOTICES.txt", "_locales/en/messages.json"]) if (!files.includes(need)) { console.error(`Missing ${need} (run npm run build)`); process.exit(1); }

const out = path.join(ROOT, "dist", `clearflow-${manifest.version}.zip`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "clearflow-pack-"));
try {
  for (const f of files) { fs.mkdirSync(path.join(stage, path.dirname(f)), { recursive: true }); fs.copyFileSync(path.join(EXT, f), path.join(stage, f)); }
  // 开源仓库里 LICENSE 在根目录，这个总仓库里在 public/（和 store-desc.py 找 descriptions 一样）
  fs.copyFileSync(fs.existsSync(path.join(ROOT, "LICENSE")) ? path.join(ROOT, "LICENSE") : path.join(ROOT, "public/LICENSE"), path.join(stage, "LICENSE"));
  execFileSync("zip", ["-q", "-X", "-r", out, "."], { cwd: stage });
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`${path.relative(ROOT, out)}: ${files.length + 1} files, ${kb} KB (version ${manifest.version})`);
