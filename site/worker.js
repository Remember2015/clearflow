// Answers "/" (and /keys, /privacy, /pricing, /terms without a language) by sending the visitor to the best supported browser language, falling back to /en/.
// Everything else is a static file from dist/ (wrangler.jsonc: assets, run_worker_first only for these paths).
import { LANGS } from "./locales.mjs";
const PAGES = { "/": "", "/keys": "keys/", "/keys/": "keys/", "/privacy": "privacy/", "/privacy/": "privacy/",
  "/pricing": "pricing/", "/pricing/": "pricing/", "/terms": "terms/", "/terms/": "terms/",
  "/account": "account/", "/account/": "account/", "/paid": "paid/", "/paid/": "paid/", "/activate": "activate/", "/activate/": "activate/" };

export function pick(acceptLanguage) {
  const prefs = String(acceptLanguage || "")
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag, q: q ? Number(q.slice(2)) || 0 : 1, i };
    })
    .filter((p) => p.tag && p.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of prefs) {
    const base = tag.split("-")[0];
    const match = Object.entries(LANGS).find(([, lang]) => lang.html.toLowerCase() === tag)
      || Object.entries(LANGS).find(([, lang]) => lang.html.toLowerCase().split("-")[0] === base);
    if (match) return match[0];
  }
  return "en";
}

// Waffo 店铺的域名验证标签（build.mjs 的 WAFFO_VERIFY 同一个）。验证程序可能不跟跳转：不带 Accept-Language 的请求（程序，不是浏览器）
// 首页直接给语言选择页（dist/index.html，带这个标签），跳转的正文里也放一份
const WAFFO_VERIFY = '<meta name="waffo-verify" content="91a96e4d9ff50ffca40ac751a9a7fee1">';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" && !request.headers.get("accept-language")) return env.ASSETS.fetch(request);
    if (url.pathname in PAGES) {
      const to = new URL(`/${pick(request.headers.get("accept-language"))}/${PAGES[url.pathname]}${url.search}`, url);
      const body = `<!doctype html><html><head><meta charset="utf-8">${WAFFO_VERIFY}<title>ClearFlow</title></head><body><a href="${to.href}">ClearFlow</a></body></html>`;
      return new Response(body, { status: 302, headers: { Location: to.href, Vary: "Accept-Language", "Cache-Control": "private, no-store", "Content-Type": "text/html; charset=utf-8" } });
    }
    return env.ASSETS.fetch(request);
  },
};
