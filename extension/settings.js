// 同一份设置约束供设置页、弹窗、内容脚本和后台使用。
(function () {
  // enabled、translate：0.20 以前是弹窗上的总开关（暂停、翻译增强），0.20 起界面上没有了，开关在各个网站里（下面的 sites）；
  // 这两个照旧留着、默认开，升级时关着的折进每个网站（background.js 的 migrate）
  const DEFAULTS = Object.freeze({ rev: 5, enabled: true, useJev: true, m1: true, dup: true, abuse: true, sexual: true,
    threshold: 0.6, recThreshold: 0.9, abuseThreshold: 0.7, sexualThreshold: 0.6,
    // m1MaxLen：M1 的长度上限，按汉字当量算（rules.js 的 units：大约 4 个字母算一个字）；0.15.3 以前按字符数、默认 15
    m1MaxLen: 10, bannerRatio: 0.5, cacheMB: 50, txCacheMB: 50, // 本地缓存上限（MB）：过滤结果（Jev）、译文分开算
    // 翻译增强：X 自带（Grok）的译文 Jev 判下来三问最低分低于 translateThreshold 才重译；
    // 重译的分要比 Grok 的至少高 translateMargin 才换上（0.28.3 起 0.05，以前 0.1：用户 10-18 报一条韩文帖子 Grok 翻得不好、插件没换——
    // 重译的只高 0.08。translate_eval 的数据上 0.1 → 0.05：中文 64 条换上 20 → 24、英文 157 条 40 → 55，整批分数不降）。
    // translateFill：帖子页补翻作者自己没被翻译的回复。模型调用时不开思考（见 translator.js）
    translate: true, translateFill: true, translateThreshold: 0.7, translateMargin: 0.05,
    translateModel: "openai/gpt-6-luna", translateFallback: "deepseek/deepseek-v4.1-flash",
    // images：回复里的图片也交给 Jev 一起判（0.18 起，默认关；打开时要用户给 IMAGE_ORIGINS 这几个图片网站的读取权限）
    images: false,
    // filler：清理「赞」「mark」这类回复（0.22 起，默认开）——只有几个字的夸、附和、谢谢、mark，不带图和链接；
    // 整条藏起来，评论区最上面一行"清理了 N 条…· 查看"。门槛每个网站自己定（站点的 fillerThreshold），不给用户调
    filler: true });
  // 看图片要读的图片网站（manifest 的 optional_host_permissions 也是这几个）：X 的 pbs.twimg.com、Reddit 用户传的图、
  // 小红书的 *.xhscdn.com（评论配图是 http 的，所以不限协议；海外版 rednote.com 也是这批 CDN）
  const IMAGE_ORIGINS = Object.freeze(["https://pbs.twimg.com/*", "https://i.redd.it/*", "https://preview.redd.it/*", "*://*.xhscdn.com/*"]);
  // 网站（0.20）：每个网站自己的开关——总开关 on（0.21：弹窗第一行就是它，关了这个网站上什么都不做）、清理 fold、翻译 translate，
  // 默认都开——和单独改过的规则（rules：这个网站用得上、能单独改的那几项）。
  // ff_settings.sites = { reddit: { fold: false, threshold: 0.5 }, … }，只存改过的；没改的跟着默认（设置页"清理规则"那张卡片）。
  // hosts：哪些网址算这个网站（弹窗认当前标签页，后台认消息是哪个网站发来的）；和 manifest 的 content_scripts 一致。
  // 只有一个网站有的设置（X 的 m1、translateFill）照旧是上面的普通设置，只在那个网站的页面上改。
  // Hacker News 不收起垃圾（hn.js），没有垃圾的档位和 D1；YouTube 的评论没有图。
  // filler（「赞」「mark」这类）X、Reddit、YouTube、小红书有；Hacker News 上这种回复很少（短回复只占 5%，其中三成是这种），不做
  const FOLD_RULES = ["threshold", "abuse", "abuseThreshold", "sexual", "sexualThreshold"];
  const SITES = Object.freeze([
    { id: "x", hosts: ["x.com", "twitter.com"], rules: [...FOLD_RULES, "filler", "images", "dup"] },
    { id: "reddit", hosts: ["www.reddit.com"], rules: [...FOLD_RULES, "filler", "images", "dup"] },
    { id: "yt", hosts: ["www.youtube.com"], rules: [...FOLD_RULES, "filler", "dup"] },
    { id: "xhs", hosts: ["www.xiaohongshu.com", "www.rednote.com"], rules: [...FOLD_RULES, "filler", "images", "dup"] },
    { id: "hn", hosts: ["news.ycombinator.com"], rules: ["abuse", "abuseThreshold", "sexual", "sexualThreshold"] },
  ].map((x) => Object.freeze(x)));
  const SITE = Object.fromEntries(SITES.map((x) => [x.id, x]));
  function siteOf(url) {
    try { const h = new URL(url).hostname; return (SITES.find((x) => x.hosts.includes(h)) || {}).id || null; } catch (e) { return null; }
  }
  const NUMBERS = {
    threshold: [0.1, 0.99, "垃圾回复的折叠阈值"], recThreshold: [0.1, 0.99, "求推荐类帖子的阈值"],
    abuseThreshold: [0.3, 0.99, "辱骂的折叠阈值"], sexualThreshold: [0.3, 0.99, "色情内容的折叠阈值"],
    m1MaxLen: [5, 40, "M1 长度上限", true], bannerRatio: [0.1, 1, "首屏垃圾回复占比"], cacheMB: [5, 500, "过滤结果的缓存上限"], txCacheMB: [5, 500, "翻译的缓存上限"],
    translateThreshold: [0.3, 0.95, "重译阈值"], translateMargin: [0, 0.5, "替换要求的分差"],
  };
  // 字符串设置：OpenRouter 的模型名，形如 厂商/型号；后备模型可以留空（不用后备）
  const STRINGS = {
    translateModel: [/^[a-z0-9][\w.-]*\/[\w.:-]+$/i, "翻译模型", false],
    translateFallback: [/^[a-z0-9][\w.-]*\/[\w.:-]+$/i, "后备翻译模型", true],
  };
  // 出错时的提示跟界面语言（i18n.js 加载了的话；Node 测试里没有，就用中文原句）
  const msg = (key, vars, zh) => (globalThis.FFI18n ? globalThis.FFI18n.t(key, vars) : zh);
  const nameOf = (key, zh) => msg(`set.${key}`, null, zh);
  function stringError(key, value) {
    const [re, zhName, optional] = STRINGS[key];
    const name = nameOf(key, zhName);
    if (typeof value !== "string") return msg("set.errText", { name }, `${name}必须是文字。`);
    if (optional && value === "") return null;
    return re.test(value) && value.length <= 100 ? null : msg("set.errModel", { name }, `${name}要写成 厂商/型号 的样子，比如 openai/gpt-6-luna。`);
  }
  function numberError(key, value) {
    const [min, max, zhName, integer] = NUMBERS[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value))) return null;
    const name = nameOf(key, zhName);
    return msg("set.errRange", { name, min, max, kind: msg(integer ? "set.int" : "set.num", null, integer ? "整数" : "数字") },
      `${name}必须是 ${min}–${max} 之间的${integer ? "整数" : "数字"}。`);
  }
  // 一个网站那一份里的一项对不对：fold、translate 是开关，别的只认这个网站的 rules（数字照上面的范围，别的是开关）
  const siteValueError = (id, key, value) => {
    if (key !== "on" && key !== "fold" && key !== "translate" && !SITE[id].rules.includes(key)) return msg("set.errBool", { key: `sites.${id}.${key}` }, `sites.${id}.${key} 不认识。`);
    if (NUMBERS[key]) return numberError(key, value);
    return typeof value === "boolean" ? null : msg("set.errBool", { key: `sites.${id}.${key}` }, `sites.${id}.${key} 必须是开关值。`);
  };
  // 读：不对的项丢掉（只留认识的网站、认识的项、合法的值）
  function normSites(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    for (const x of SITES) {
      const o = raw[x.id];
      if (!o || typeof o !== "object") continue;
      const keep = Object.fromEntries(Object.entries(o).filter(([k, v]) => !siteValueError(x.id, k, v)));
      if (Object.keys(keep).length) out[x.id] = keep;
    }
    return out;
  }
  function normalize(raw) {
    const out = { ...DEFAULTS };
    if (!raw || typeof raw !== "object") return { ...out, sites: {} };
    for (const key of Object.keys(DEFAULTS)) {
      if (key === "rev") continue;
      const ok = NUMBERS[key] ? !numberError(key, raw[key]) : STRINGS[key] ? !stringError(key, raw[key]) : typeof raw[key] === "boolean";
      if (ok) out[key] = raw[key];
    }
    out.sites = normSites(raw.sites);
    return out;
  }
  // 某个网站上实际用的设置：默认的那一份，盖上这个网站单独改过的规则；enabled = 这个网站开着、开着清理，translate = 开着、开着翻译。
  // 不认识的网站（插件自己的页面、测试）就是默认的那一份
  function forSite(raw, id) {
    const st = normalize(raw), x = SITE[id];
    if (!x) return st;
    const o = st.sites[id] || {}, out = { ...st };
    for (const k of x.rules) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = o[k];
    if (!x.rules.includes("filler")) out.filler = false; // 没有这一项的网站（Hacker News）不清理
    out.enabled = st.enabled && o.on !== false && o.fold !== false;
    out.translate = st.translate && o.on !== false && o.translate !== false;
    return out;
  }
  function validate(raw) {
    const out = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      if (key === "rev" || !Object.prototype.hasOwnProperty.call(raw || {}, key)) continue;
      let value = raw[key];
      if (NUMBERS[key]) {
        if (typeof value === "string" && value.trim()) value = Number(value);
        const error = numberError(key, value);
        if (error) return { settings: null, error };
      } else if (STRINGS[key]) {
        if (typeof value === "string") value = value.trim();
        const error = stringError(key, value);
        if (error) return { settings: null, error };
      } else if (typeof value !== "boolean") return { settings: null, error: msg("set.errBool", { key }, `${key} 必须是开关值。`) };
      out[key] = value;
    }
    out.sites = {};
    if (raw && raw.sites != null) {
      if (typeof raw.sites !== "object") return { settings: null, error: msg("set.errBool", { key: "sites" }, "sites 不对。") };
      for (const [id, o] of Object.entries(raw.sites)) {
        if (!SITE[id] || !o || typeof o !== "object") return { settings: null, error: msg("set.errBool", { key: `sites.${id}` }, `sites.${id} 不对。`) };
        for (const [k, v] of Object.entries(o)) { const error = siteValueError(id, k, v); if (error) return { settings: null, error }; }
        if (Object.keys(o).length) out.sites[id] = { ...o };
      }
    }
    return { settings: out, error: null };
  }
  // "和你标记过的垃圾是同一类"（0.26，Jev 的 marked 那一问，见 jev.js 的 MARKED_QUESTION）多少分折：YouTube 的数据上 0.6 一条没误伤
  const MARKED_THRESHOLD = 0.6;
  globalThis.FFSettings = Object.freeze({ DEFAULTS, normalize, validate, forSite, siteOf, SITES, IMAGE_ORIGINS, MARKED_THRESHOLD });
})();
