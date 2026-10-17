// 界面文字：19 种主流语言（X 的"显示语言"里用的人最多的那些，见 feed-filter/i18n/build.py；文字在 feed-filter/i18n/<语言>.json，
// 构建成 i18n_page.js / i18n_all.js，放在 globalThis.FFI18nStrings 里），别的语言和缺的键用英文。
// X 页面上（内容脚本）跟 X 的界面语言（<html lang>）走，插件插进页面的字和 X 自己的字是同一种语言；
// 插件自己的页面（弹窗、设置页、回顾页）和后台跟浏览器的界面语言走（chrome.i18n.getUILanguage）。
// 用法：FFI18n.t("键", {变量})；静态页面上 data-i18n="键"（换文字）、data-i18n-title / -placeholder / -aria-label（换属性），
// 调 FFI18n.apply() 套上（顺便设好 lang 和从右往左的 dir）。语言名用浏览器自带的 Intl.DisplayNames，按界面语言说。
(function () {
  const strings = () => globalThis.FFI18nStrings || { en: {} };
  // X 和浏览器给的语言代码 → 我们的语言：ar-x-fm（阿拉伯语阴性）、en-gb、pt-BR 这类取前半截；印尼语的老代码是 in
  const ALIAS = { in: "id" };
  const RTL = new Set(["ar", "fa", "he", "ur"]); // 从右往左的语言（界面里现在只有阿拉伯语，别的几种退回英文）
  function pick(l) {
    const s = String(l || "").toLowerCase().replace(/_/g, "-");
    const S = strings();
    if (/^zh-(tw|hk|mo|hant)/.test(s)) return S["zh-TW"] ? "zh-TW" : "zh-CN" in S ? "zh-CN" : "en";
    if (/^zh/.test(s)) return S["zh-CN"] ? "zh-CN" : "en";
    const p = s.split("-")[0];
    const code = ALIAS[p] || p;
    return S[code] ? code : "en";
  }
  // 网页里（内容脚本在 X 上，或测试用的仿 X 页）看这个页面的 <html lang>；页面本身没有多语言的站点（Hacker News 永远是 en）
  // 由站点的脚本给 globalThis.FFPageLang（浏览器界面语言）；插件自己的页面（chrome-extension://）和后台看浏览器界面语言
  function uiLang() {
    try {
      const inPage = typeof document !== "undefined" && typeof location !== "undefined" && location.protocol !== "chrome-extension:";
      if (inPage) return pick((globalThis.FFPageLang && globalThis.FFPageLang()) || document.documentElement.lang || navigator.language);
      // 插件自己的页面上网址带 ?uilang=xx 就用那种语言（测试用：一个浏览器里挨个看 19 种语言放不放得下，见 test/i18n_headless.cjs）
      const forced = typeof location !== "undefined" && location.protocol === "chrome-extension:" && new URLSearchParams(location.search).get("uilang");
      if (forced) return pick(forced);
      if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getUILanguage) return pick(chrome.i18n.getUILanguage());
    } catch (e) { /* 拿不到就按浏览器 */ }
    return pick(typeof navigator !== "undefined" ? navigator.language : "en");
  }
  // 从右往左的语言里，插进句子的值（@账号、模型名、链接、英文报错）前后加 Unicode 隔离符（FSI … PDI，Fluent 也这么做），
  // 不然 "@user" 会显示成 "user@"，括号也会跟着反过来
  // 单复数（0.24："Cleared 1 replies"）：vars 里有数字 n 时按这种语言的复数规则（Intl.PluralRules：one / few / many / other）
  // 先找 键.规则（filler.line.one），没有就用键本身。只给名词跟着数字变的那几句加了变体（i18n/*.json）
  function plural(table, l, key, vars) {
    if (!table || !vars || typeof vars.n !== "number") return null;
    let rule = "other";
    try { rule = new Intl.PluralRules(l).select(vars.n); } catch (e) { /* 认不得的语言代码 */ }
    return table[`${key}.${rule}`] ?? null;
  }
  function t(key, vars) {
    const l = uiLang(), S = strings();
    const own = S[l] || {};
    const s = plural(own, l, key, vars) ?? own[key] ?? plural(S.en, "en", key, vars) ?? S.en[key];
    if (s == null) return key;
    const rtl = RTL.has(l);
    return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : rtl ? `\u2068${vars[k]}\u2069` : String(vars[k]))) : s;
  }
  // X 有几个老的语言代码（in = 印尼语、iw = 希伯来语）
  const LEGACY = { in: "id", iw: "he", ji: "yi" };
  function langName(code, inLang = uiLang()) {
    const c = LEGACY[String(code || "").toLowerCase()] || code;
    try { return new Intl.DisplayNames([inLang], { type: "language" }).of(c) || code; } catch (e) { return code; }
  }
  function apply(root = document) {
    for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
    for (const attr of ["title", "placeholder", "aria-label"]) {
      for (const el of root.querySelectorAll(`[data-i18n-${attr}]`)) el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)));
    }
    if (root === document) {
      const l = uiLang();
      document.documentElement.lang = l;
      document.documentElement.dir = RTL.has(l) ? "rtl" : "ltr";
    }
  }
  // 后台回的错误（{error, code}）：认得的 code 用这边的话说，认不得的照原文
  function errText(r) {
    const code = r && r.code, msg = String((r && (r.error || r.message)) || "").slice(0, 120);
    if (code && strings().en[`err.${code}`] != null) return t(`err.${code}`, { msg });
    return msg || t("c.notDone");
  }
  globalThis.FFI18n = { t, uiLang, pick, langName, apply, errText, isRtl: () => RTL.has(uiLang()), locales: () => Object.keys(strings()) };
})();
