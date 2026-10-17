// 把 icon.svg（48、128）、icon-32.svg、icon-16.svg（小尺寸各自按像素格对齐）渲染成插件里的 PNG：icons/icon-<尺寸>.png（浅色，manifest 里默认用）、
// icons/dark-<尺寸>.png（深色工具栏用，后台按页面报的 prefers-color-scheme 换，见 extension/theme.js、background.js）。
// 颜色照 Chrome：浅色主色 #0B57D0 底、白图形；深色主色 #A8C7FA 底、#062E6F 图形（cr_shared_vars.css 的 primary / on-primary）。
// 用本机的 Chrome 无头渲染（不用另装 SVG 工具）。用法：node icons/render.mjs [输出的插件目录，默认 ../extension]
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const here = path.dirname(new URL(import.meta.url).pathname);
const ext = path.resolve(process.argv[2] || path.join(here, "../../extension"));
const THEMES = {
  icon: { BADGE: "#0B57D0", GLYPH: "#FFFFFF" },
  dark: { BADGE: "#A8C7FA", GLYPH: "#062E6F" },
};
const SIZES = [16, 32, 48, 128];
const src = (file, colors) => Object.entries(colors).reduce((s, [k, v]) => s.replaceAll(k, v), fs.readFileSync(path.join(here, file), "utf8"));
fs.mkdirSync(path.join(ext, "icons"), { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
try {
  const page = await browser.newPage();
  for (const [name, colors] of Object.entries(THEMES)) {
    for (const size of SIZES) {
      const svg = src(size === 16 ? "icon-16.svg" : size === 32 ? "icon-32.svg" : "icon.svg", colors);
      await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
      await page.setContent(`<html><body style="margin:0;background:transparent"><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"></body></html>`);
      await page.waitForFunction(() => document.images[0].complete);
      const out = path.join(ext, "icons", `${name}-${size}.png`);
      await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
      console.log(out.replace(ext + "/", ""));
    }
  }
} finally { await browser.close(); }
