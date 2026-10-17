// 把弹窗、设置页（src/popup.jsx、src/options.jsx，React + shadcn/ui 的 maia 组件，底层 Base UI）打包成插件里的 ES 模块：
// <输出目录>/popup.js、options.js，两页共用的 React、Base UI 拆成一个 chunk-*.js；样式（src/app.css，Tailwind 4）编成 <输出目录>/ui.css。
// 插件页面（popup.html、options.html）先用普通 <script> 载入 i18n_all.js、i18n.js、settings.js（全局的 FFI18n、FFSettings），
// 再 <script type="module"> 载入这里的产物。不连网、不用 CDN（MV3 不许远程代码）。组件里的 @/... 由 tsconfig.json 的 paths 指到 src/。
// 用法：npm run build（输出到 ../extension/ui/）；node build.mjs --out <目录>（比如先打到副本里测）；npm run watch 改了就重打。
import * as esbuild from "esbuild";
import { execFileSync, spawn } from "node:child_process";
import { writeNotices } from "./notices.mjs";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : path.join(here, "../extension/ui"));
const watch = args.includes("--watch");

// 旧的产物（chunk 名里带哈希）先清掉，免得目录里越堆越多
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (f.endsWith(".js")) fs.rmSync(path.join(out, f));

const opts = {
  absWorkingDir: here,
  entryPoints: { popup: "src/popup.jsx", options: "src/options.jsx" },
  bundle: true,
  splitting: true,
  format: "esm",
  outdir: out,
  chunkNames: "chunk-[hash]",
  minify: true,
  target: "chrome120",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none", // 许可声明不留在产物里，统一写进插件根目录的 THIRD_PARTY_NOTICES.txt（notices.mjs）
  metafile: true,
  banner: { js: "// 由 ui/ 打包生成（npm run build），别直接改这里" },
  logLevel: "info",
};
// Tailwind 只扫 src/ 里用到的 class（app.css 里写了 @source），产物压缩
const tw = path.join(here, "node_modules/.bin/tailwindcss");
const twArgs = ["-i", path.join(here, "src/app.css"), "-o", path.join(out, "ui.css"), "--minify"];
if (watch) {
  await (await esbuild.context(opts)).watch();
  spawn(tw, [...twArgs, "--watch"], { cwd: here, stdio: "inherit" });
} else {
  const result = await esbuild.build(opts);
  execFileSync(tw, twArgs, { cwd: here, stdio: "inherit" });
  const n = writeNotices(result.metafile, path.join(out, "..", "THIRD_PARTY_NOTICES.txt"), path.join(here, "node_modules"));
  console.log(`THIRD_PARTY_NOTICES.txt：${n.packages} 个包 + ${n.vendored} 份拷进来的`);
}
