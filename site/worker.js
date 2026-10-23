// Answers "/" (and /keys, /privacy without a language) by sending the visitor to the best supported browser language, falling back to /en/.
// Everything else is a static file from dist/ (wrangler.jsonc: assets, run_worker_first only for these paths).
import { LANGS } from "./locales.mjs";
const PAGES = { "/": "", "/keys": "keys/", "/keys/": "keys/", "/privacy": "privacy/", "/privacy/": "privacy/" };

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname in PAGES) {
      const to = new URL(`/${pick(request.headers.get("accept-language"))}/${PAGES[url.pathname]}${url.search}`, url);
      return new Response(null, { status: 302, headers: { Location: to.href, Vary: "Accept-Language", "Cache-Control": "private, no-store" } });
    }
    return env.ASSETS.fetch(request);
  },
};
