// 读 X 页面的地方全在这里：选择器、页面结构上的推断、网址格式、X 接口返回的数据格式、React 组件数据。
// X 改版时只改这一个文件；test/x_probe.js（test/build_probe.py 用这个文件拼出来）在登录的真 X 页面上逐项核对这里的每一条还对不对。
// 不碰 chrome.*：插件的隔离环境（content.js、translate.js）和页面环境（pagedata.js）各加载一份。
// 每条依赖的稳不稳，见 README 的"X 改版"一节：data-testid 和网址最稳，结构推断其次，React 组件数据最脆（所以 pagedata.js 先用接口数据）。
(() => {
  if (globalThis.FFX) return;

  // ---------- 选择器（X 的 data-testid、role 之类） ----------
  const SEL = {
    article: 'article[data-testid="tweet"]', // 一条帖子
    text: '[data-testid="tweetText"]', // 正文；lang 属性是这段文字的语言（X 自动翻译时是界面语言）
    userName: '[data-testid="User-Name"]', // 作者那一栏：名字、@账号、时间
    cell: '[data-testid="cellInnerDiv"]', // 时间线的一格（帖子、"显示更多回复"、分段标题……）
    column: '[data-testid="primaryColumn"]', // 中间那一栏
    more: '[data-testid="tweet-text-show-more-link"]', // 长帖的"显示更多"（按钮，点了原地展开）
    caret: '[data-testid="caret"]', // 帖子右上角的"…"
    dropdown: '[data-testid="Dropdown"]', // 点"…"后挂在 #layers 里的菜单
    menuItem: '[role="menuitem"]',
    layers: "#layers", // 菜单、浮层挂在这里
    photo: '[data-testid="tweetPhoto"]',
    video: '[data-testid="videoPlayer"], [data-testid="videoComponent"]',
    adWrap: '[data-testid="placementTracking"]', // 广告整条包在这里面（帖子里的视频也有这个标记，但在帖子里面）
    verified: '[data-testid="icon-verified"]',
    quote: 'div[role="link"]', // 引用卡片：role=link 的块，里面有被引用帖子的作者栏和正文
    profileName: '[data-testid="UserName"]', // 用户主页顶上的名字和账号
    selfLink: '[data-testid="AppTabBar_Profile_Link"]', // 左边栏的"个人资料"：指向你自己的主页
    heading: 'h2, [role="heading"]',
  };
  // 界面上的字（只作兜底：X 是别的语言界面时靠结构）
  const STOP_RE = /^(发现更多|Discover more|更多帖子|More posts)/; // 帖子页下面推荐的别的帖子，不算这条对话
  const AD_RE = /(^|\n)(广告|Ad|Promoted)(\n|$)/;

  // ---------- 网址 ----------
  // /用户/status/数字 是帖子详情页；后面跟 /photo/N、/video/N 是盖在当前页面上的图片 / 视频层（底下可能还是首页）；
  // /quotes、/retweets 之类的子页不是回复列表。/home 是首页。/search?q=… 和 /hashtag/话题 是搜索结果（query 是搜的词，话题前面加 #）。
  // /账号（和它的"回复""精选""文章""媒体""喜欢"几个标签）是用户主页：第一段是 X 自己的页面（explore、notifications、settings……）的不算，
  // 这些名字 X 不让人注册成账号
  const RESERVED = new Set(["home", "explore", "notifications", "messages", "search", "settings", "i", "compose", "login", "logout",
    "signup", "tos", "privacy", "rules", "jobs", "premium", "premium_sign_up", "communities", "lists", "bookmarks", "account",
    "intent", "hashtag", "share", "download", "about", "grok", "topics", "verified", "help", "welcome", "oauth", "sessions",
    "safety", "display", "keyboard_shortcuts", "following", "followers", "flow", "spaces", "live", "events", "moments", "x", "twitter"]);
  const PROFILE_RE = /^\/([A-Za-z0-9_]{1,15})(?:\/(?:with_replies|highlights|articles|media|likes|superfollows))?\/?$/;
  function route(path = location.pathname, search = location.search) {
    if (path === "/home") return { kind: "home", pid: null, media: false };
    const m = path.match(/^\/[^/]+\/status\/(\d+)(\/(?:photo|video)\/\d+)?\/?$/);
    if (m) return { kind: "status", pid: m[1], media: !!m[2] };
    if (path === "/search" || path === "/search/") return { kind: "search", pid: null, media: false, query: (new URLSearchParams(search).get("q") || "").trim() };
    const h = path.match(/^\/hashtag\/([^/]+)\/?$/);
    if (h) { let tag = h[1]; try { tag = decodeURIComponent(tag); } catch (e) { /* 坏的编码就用原样 */ } return { kind: "search", pid: null, media: false, query: "#" + tag }; }
    const u = path.match(PROFILE_RE);
    if (u && !RESERVED.has(u[1].toLowerCase())) return { kind: "profile", pid: null, media: false, user: u[1].toLowerCase() };
    return { kind: "other", pid: null, media: false };
  }
  // 你自己的账号（小写、不带 @）：左边栏"个人资料"链接；认不出是 null
  const selfHandle = () => ((document.querySelector(SEL.selfLink)?.getAttribute("href") || "").match(/^\/([A-Za-z0-9_]{1,15})$/) || [])[1]?.toLowerCase() || null;
  // 用户主页顶上的名字（第一行）
  const profileName = () => (document.querySelector(`${SEL.column} ${SEL.profileName}`)?.innerText || "").split("\n").map((x) => x.trim()).find(Boolean) || "";

  // ---------- 一条帖子 ----------
  const column = () => document.querySelector(SEL.column) || document.body;
  const inLayers = (el) => !!(el.closest && el.closest(SEL.layers));
  // 帖子自己的链接：指向 /status/数字、里面有 <time> 的那个（引用卡片里的时间不是链接；广告没有）
  const statusLink = (a) => [...a.querySelectorAll('a[href*="/status/"]')].find((x) => x.querySelector("time")) || null;
  const statusId = (a) => ((statusLink(a)?.getAttribute("href") || "").match(/\/status\/(\d+)/) || [])[1] || null;
  const postTime = (a) => statusLink(a)?.querySelector("time")?.getAttribute("datetime") || null;
  // 页面上 id 是这个的帖子（链接里带这个 id 的 <time>）
  const articlesFor = (id) => [...document.querySelectorAll(`${SEL.article} a[href*="/status/${id}"] time`)].map((t) => t.closest(SEL.article)).filter(Boolean);
  // 作者那一栏按行拆：第一行名字，"@" 开头的是账号（innerText 会触发布局，调用方自己缓存）
  function userLines(el) {
    const un = el && (el.matches && el.matches(SEL.userName) ? el : el.querySelector(SEL.userName));
    return un ? un.innerText.split("\n").map((s) => s.trim()).filter(Boolean) : [];
  }
  function author(a) {
    const lines = userLines(a);
    const un = a.querySelector(SEL.userName);
    return { name: lines[0] || "", handle: lines.find((s) => s.startsWith("@")) || "", verified: !!(un && un.querySelector(SEL.verified)) };
  }
  // 作者账号（小写、不带 @）：作者那一栏里指向 /账号 的链接，不用 innerText
  function authorId(a) {
    for (const x of a.querySelectorAll(`${SEL.userName} a[href^="/"]`)) {
      const m = x.getAttribute("href").match(/^\/([A-Za-z0-9_]{1,15})$/);
      if (m) return m[1].toLowerCase();
    }
    return null;
  }
  const textEl = (a) => a.querySelector(SEL.text); // 第一段正文（回复自己没写字时，是引用卡片里那条的）
  const textLang = (tt) => (tt && tt.getAttribute("lang") || "").toLowerCase(); // 正文的语言（X 标的；自动翻译时是界面语言）
  // 引用卡片和回复自己的正文（卡片外面那段）
  const quoteCard = (a) => [...a.querySelectorAll(SEL.quote)].find((d) => d.querySelector(SEL.userName)) || null;
  function ownTextEl(a) {
    const q = quoteCard(a);
    return [...a.querySelectorAll(SEL.text)].find((x) => !(q && q.contains(x))) || null;
  }
  const quoteHandle = (a) => { const q = quoteCard(a); return q ? userLines(q).find((s) => s.startsWith("@")) || "" : ""; };
  const hasMedia = (a) => !!a.querySelector(`${SEL.photo}, ${SEL.video}`);
  // 看图片（0.18）：这条帖子自己的图（引用卡片里被引用帖子的图不算），视频取封面；只要 pbs.twimg.com 上的
  function photoUrls(a) {
    const q = quoteCard(a);
    const urls = [...a.querySelectorAll(`${SEL.photo} img`)].filter((i) => !(q && q.contains(i))).map((i) => i.currentSrc || i.src)
      .concat([...a.querySelectorAll("video[poster]")].filter((v) => !(q && q.contains(v))).map((v) => v.poster));
    return [...new Set(urls.filter((u) => /^https:\/\/pbs\.twimg\.com\//.test(u || "")))];
  }
  const moreLink = (a) => a.querySelector(SEL.more);
  // 广告：整条包在 placementTracking 里，或者正文外面单独一行"广告 / Promoted"（inner：调用方已经取过的 innerText）
  const isAd = (a, inner) => !!a.closest(SEL.adWrap) || AD_RE.test(inner ?? a.innerText);
  const caretOf = (target) => (target && target.closest ? target.closest(SEL.caret) : null);
  // 新挂上来的节点里有没有"…"菜单：先认 Dropdown 标记，没有的话认 #layers 里新出现的 role=menu
  function menuIn(n) {
    if (n.matches(`${SEL.dropdown}, ${SEL.layers} [role="menu"]`)) return n;
    return n.querySelector(SEL.dropdown) || (inLayers(n) && n.querySelector('[role="menu"]')) || null;
  }
  const menuTemplate = (dd) => dd.querySelector(`${SEL.menuItem}:not(.ff-menuitem)`); // 原生选项（当外观模板）

  // ---------- 时间线 ----------
  const cells = (root) => root.querySelectorAll(SEL.cell);
  // 分段标题（"发现更多"之类，什么语言都行）：不带帖子、认字或者有标题元素的格子
  const isSectionHeader = (cell) => !cell.querySelector(SEL.article) && (STOP_RE.test((cell.textContent || "").trim()) || !!cell.querySelector(SEL.heading));
  // 帖子所在的那块时间线
  const timelineOf = (a) => { const cell = a.closest(SEL.cell); return a.closest("section") || (cell && cell.parentElement) || null; };

  // ---------- X 的自动翻译 ----------
  // X 的界面语言 = X 把帖子翻成的语言
  const uiLang = () => (document.documentElement.lang || navigator.language || "en").trim() || "en";
  const primaryLang = (l) => String(l || "").toLowerCase().split("-")[0];
  const sameLang = (a, b) => !!a && !!b && primaryLang(a) === primaryLang(b);
  // 翻译那一行：正文元素正上面那个、带按钮和图标的（跳过插件自己插在前面的 .ff-tx）
  function translationRow(tt) {
    let r = tt && tt.previousElementSibling;
    while (r && r.classList.contains("ff-tx")) r = r.previousElementSibling;
    return r && r.querySelector("button") && r.querySelector("svg") ? r : null;
  }
  // auto 正显示着 X 的译文；off 自动翻过、切回了原文（两个按钮：显示翻译、关于自动翻译）；
  // demand 能按需翻、还没翻（只有一个"显示翻译"；点了之后 X 出译文那一两秒也是这样）；none 没有翻译那一行
  function translationState(a, lang = uiLang()) {
    const tt = textEl(a), row = translationRow(tt);
    if (!row) return "none";
    if (sameLang(tt.getAttribute("lang"), lang)) return "auto";
    return row.querySelectorAll("button").length >= 2 ? "off" : "demand";
  }
  const translationToggle = (a) => translationRow(textEl(a))?.querySelector("button") || null; // 显示原文 / 显示翻译
  // 正文转成纯文字（不靠 innerText：被藏起来的元素 innerText 拿不到换行）。X 的正文换行就是文字里的 \n；
  // 表情是 <img alt>；链接被拆成几段（"https://" "域名路径" "…"），拼回一段
  function textOf(el) {
    let out = "";
    const walk = (n) => {
      if (n.nodeType === 3) { out += n.nodeValue; return; }
      if (n.nodeType !== 1) return;
      if (n.tagName === "IMG") { out += n.getAttribute("alt") || ""; return; }
      if (n.tagName === "BR") { out += "\n"; return; }
      if (n.tagName === "A") { out += (n.textContent || "").replace(/\s+/g, ""); return; }
      for (const c of n.childNodes) walk(c);
    };
    walk(el);
    return out.replace(/\n{3,}/g, "\n\n").trim();
  }

  // ---------- 主题 ----------
  // X 的主题（浅色 / 暗蓝 / 纯黑）跟系统设置无关：按页面底色判断
  function darkTheme() {
    const m = (getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) || []).map(Number);
    return m.length >= 3 && (m[3] ?? 1) > 0 && 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2] < 128;
  }

  // ---------- 页面数据：长帖全文、X 的完整译文 ----------
  // 两个来源，都整理成同一种记录 {id, lang, full, range, urls, media, note: {text, urls}, tr: {text, preview, src, dest, urls}, quoteId}：
  // ① X 自己的接口返回（/i/api/graphql/…，时间线、帖子详情、搜索都是这个格式）——前后端之间的数据格式，最稳，pagedata.js 先用它；
  // ② React 交给帖子组件的数据（article 上 __reactFiber$… 往上找 memoizedProps.tweet）——React 内部的东西，最脆，只作后备。
  // 两者只在页面环境（MAIN world）里读得到。
  const API_URL = /\/i\/api\/graphql\//;
  const mediaOf = (entities, extended) => [...((entities && entities.media) || []), ...((extended && extended.media) || [])].map((x) => x && x.url).filter((u) => typeof u === "string" && u);
  // 接口里的一条帖子：{__typename: "Tweet", rest_id, legacy: {full_text, display_text_range, entities, extended_entities, lang},
  //   note_tweet: {note_tweet_results: {result: {text, entity_set}}}, grok_translated_post_with_availability: {data: {translation, preview_translation, source_language, destination_language, entities}},
  //   quoted_status_result: {result: …}}
  function apiRecord(o) {
    const L = o.legacy;
    const nr = o.note_tweet && o.note_tweet.note_tweet_results && o.note_tweet.note_tweet_results.result;
    const g = o.grok_translated_post_with_availability && o.grok_translated_post_with_availability.data;
    const q = o.quoted_status_result && o.quoted_status_result.result;
    return {
      id: o.rest_id, lang: L.lang || null, full: L.full_text, range: Array.isArray(L.display_text_range) ? L.display_text_range : null,
      urls: (L.entities && L.entities.urls) || [], media: mediaOf(L.entities, L.extended_entities),
      note: nr && typeof nr.text === "string" ? { text: nr.text, urls: (nr.entity_set && nr.entity_set.urls) || [] } : null,
      tr: g && typeof g.translation === "string" ? { text: g.translation, preview: typeof g.preview_translation === "string" ? g.preview_translation : null,
        src: g.source_language || null, dest: g.destination_language || null, urls: (g.entities && g.entities.urls) || [] } : null,
      quoteId: (q && (q.rest_id || (q.tweet && q.tweet.rest_id))) || null,
    };
  }
  const isApiTweet = (o) => typeof o.rest_id === "string" && o.legacy && typeof o.legacy.full_text === "string";
  // 一份接口返回里的所有帖子（引用的、转帖的也算）；不递归，免得太深的 JSON 把栈撑爆
  function apiTweets(json, cb) {
    const stack = [json];
    let n = 0;
    while (stack.length) {
      const o = stack.pop();
      if (!o || typeof o !== "object") continue;
      if (isApiTweet(o)) { cb(apiRecord(o)); n++; }
      for (const k in o) { const v = o[k]; if (v && typeof v === "object") stack.push(v); }
    }
    return n;
  }
  // React 组件数据里的那条（字段名和接口不一样：note_tweet.text、grok_translated_post、id_str）
  function fiberTweet(a, id) {
    let f = null;
    for (const k in a) if (k.startsWith("__reactFiber$")) { f = a[k]; break; }
    for (let i = 0; i < 60 && f; i++, f = f.return) {
      const t = f.memoizedProps && f.memoizedProps.tweet;
      if (t && (t.id_str === id || t.rest_id === id)) return t;
    }
    return null;
  }
  function fiberRecord(t) {
    const g = t.grok_translated_post, n = t.note_tweet;
    return {
      id: t.id_str || t.rest_id, lang: t.lang || null, full: typeof t.full_text === "string" ? t.full_text : null,
      range: Array.isArray(t.display_text_range) ? t.display_text_range : null, urls: (t.entities && t.entities.urls) || [], media: mediaOf(t.entities, t.extended_entities),
      note: n && typeof n.text === "string" ? { text: n.text, urls: (n.entity_set && n.entity_set.urls) || [] } : null,
      tr: g && typeof g.translation === "string" ? { text: g.translation, preview: typeof g.preview_translation === "string" ? g.preview_translation : null,
        src: g.source_language || null, dest: g.destination_language || null, urls: (g.entities && g.entities.urls) || [] } : null,
      quoteId: null,
    };
  }

  globalThis.FFX = Object.freeze({
    SEL, STOP_RE, AD_RE, route, selfHandle, profileName, column, inLayers, statusLink, statusId, postTime, articlesFor, userLines, author, authorId,
    textEl, textLang, quoteCard, ownTextEl, quoteHandle, hasMedia, photoUrls, moreLink, isAd, caretOf, menuIn, menuTemplate,
    cells, isSectionHeader, timelineOf, uiLang, primaryLang, sameLang, translationRow, translationState, translationToggle, textOf,
    darkTheme, API_URL, apiRecord, isApiTweet, apiTweets, fiberTweet, fiberRecord,
  });
})();
