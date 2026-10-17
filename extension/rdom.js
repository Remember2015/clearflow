// 读 Reddit（新版 www.reddit.com，shreddit 那一套自定义元素）页面的地方全在这里，和 X 的 xdom.js 分开。
// 结构是 2026-10-12 在真页面上记下来的（当时的结构探针只记结构不记内容，0.24 删了）：
// - 帖子页 /r/版块/comments/id/…：主帖是 <shreddit-post id="t3_…" author post-title post-language is-translatable>，
//   它有 shadow DOM，里面的东西要带 slot 才显示：标题 <h1 slot=title>（字直接在里面），
//   正文 <shreddit-post-text-body slot=text-body> 里的 <div slot=text-body>；评论是 <shreddit-comment thingid="t1_…" author depth is-op is-translatable created>，
//   没有可读的 shadow DOM，内容都在普通 DOM 里：<details>（Reddit 自己的折叠）里有作者栏 [slot=commentMeta]、
//   正文 [slot=comment]、操作栏 [slot=actionRow]，回复（下一层 shreddit-comment）也嵌在这条评论里面。
//   评论区里的广告是单独的 <shreddit-comment-tree-ad>、<shreddit-comments-page-ad>，不是评论。
// - 帖子列表（首页、版块）：<shreddit-feed> 里一条一个 <article data-post-id> 包着 <shreddit-post>，标题是 <a slot=title>，
//   整张卡片上盖着一个透明的 <a slot=full-post-link class="absolute inset-0">（点卡片哪里都进帖子），
//   正文摘要在 <shreddit-post-text-body slot=text-body> 里。
// - 年度帖子页（/posts/2026/global/、/posts/2026/en/ 这些，"Reddit 最佳"，一页 250 条）：不是 <shreddit-post>，一条是
//   <div class="py-md …"> 一张卡片：版块和时间一行、指向帖子的链接里 <div class="i18n-list-item-post-content" post-id="t3_…">，
//   里面标题 <h3 class="i18n-list-item-post-title line-clamp-2">；缩略图、票数评论数。当帖子列表管（2026-10-13 记下的）。
// - 搜索结果（"帖子"那一栏）：一条一个 <search-telemetry-tracker data-testid=search-sdui-post data-thingid="t3_…">，里面
//   <div data-testid=search-post-unit class="flex … relative"> 一行三格：① 一个盖住整条的透明链接
//   <h2><a data-testid=post-title class="absolute inset-0">（只有读屏的字）</a></h2>；② <div data-testid=sdui-post-unit>
//   竖着排版块、看得见的标题 <a data-testid=post-title-text>（搜的词加粗）、票数评论数；③ 缩略图。
//   带正文摘要的另是一种：里面是 <div data-testid=search-post-with-content-preview>，最外层那个 tracker 没有 data-thingid
//   （2026-10-13 记下的：一页 7 条里 3 条是这种，0.13.11 以前不认，这几条没翻、没判）。所以一条结果从看得见的标题往上找，id 从链接里取。
// - 搜索的"媒体"那一栏（?type=media）：<search-media-feed> 里一条一个 <search-telemetry-tracker view-events data-measured style=…>
//   （瀑布流，Reddit 量好高度排的），里面 <div data-id>：图片链接（里面有"1/6"这种页数）、版块那一行 <div class=mt-2xs> 里
//   <faceplate-hovercard>、标题 <a class="… line-clamp-2" href=…/comments/…>。
// 读正文、标题一律走 readText（ffdom.js）：自己走一遍 DOM 拼文字，不用 innerText——innerText 跟着显示走，元素藏起来（折叠了）以后
// 读到的是 textContent，空白、换行都不一样，reddit.js 会当成新内容重判、判的时候先展开，就一闪一闪的（0.13.2 修）。
// 插件自己加进页面的东西（折叠条、译文、说明、克隆的标题）都跳过：带 OWN 这个 class 或者是 .ff-bar；
// 换成译文时原来的只是藏起来，照样读得到，所以读到的永远是原文。
// 不碰 chrome.*；reddit.js（折叠）、rtranslate.js（翻译）用它。
(() => {
  if (globalThis.FFRD) return;
  const { OWN, readText } = globalThis.FFDom;
  const SEL = {
    post: "shreddit-post",
    comment: "shreddit-comment",
    body: '[slot="comment"]',
    meta: '[slot="commentMeta"]',
    actionRow: '[slot="actionRow"]',
    postTitle: '[slot="title"]',
    postBody: '[slot="text-body"]',
    feed: "shreddit-feed",
    listItem: ".i18n-list-item-post-content[post-id]", // 年度帖子页的一条
    listTitle: "h3.i18n-list-item-post-title",
    searchUnit: 'search-telemetry-tracker[data-thingid^="t3_"]',
    unitTitle: 'a[data-testid="post-title-text"]', // 搜索结果看得见的标题
    unitPreview: '[data-testid="search-post-with-content-preview"]', // 带正文摘要的那种结果
    mediaFeed: "search-media-feed", // 搜索的"媒体"那一栏
    ad: "shreddit-ad-post, shreddit-comment-tree-ad, shreddit-comments-page-ad, shreddit-sidebar-ad",
  };
  // 网址：帖子页（pid 是 t3_ 开头的帖子 id）、搜索结果、帖子列表（首页、版块、热门之类的排序）、用户页、别的。
  // 别的页面里要是有 Reddit 标准的帖子列表（<shreddit-feed> 里的 <shreddit-post>，比如 /news/）也当帖子列表（page 是这一页的路径）
  function route(path = location.pathname, search = location.search) {
    const r = routeOf(path, search);
    if (r.kind === "other" && path === location.pathname && document.querySelector(`${SEL.feed} ${SEL.post}`))
      return { kind: "feed", sub: "", page: path.replace(/^\/+|\/+$/g, "").replace(/[^\w.~-]+/g, "-").slice(0, 60) || "home" };
    return r;
  }
  function routeOf(path, search) {
    let m = path.match(/^\/posts\/(\d{4})(?:\/([\w-]+))?\/?$/i); // 年度帖子页：当帖子列表，每个年份、语言一页
    if (m) return { kind: "feed", sub: "", page: `posts-${m[1]}-${(m[2] || "global").toLowerCase()}` };
    m = path.match(/^\/r\/([^/]+)\/comments\/([a-z0-9]+)/i);
    if (m) return { kind: "post", pid: "t3_" + m[2].toLowerCase(), sub: m[1].toLowerCase() };
    m = path.match(/^\/(?:r\/([^/]+)\/)?search\/?$/i); // 版块里搜（/r/版块/search/）也算
    if (m) { const q = new URLSearchParams(search); return { kind: "search", query: (q.get("q") || "").trim(), type: (q.get("type") || "").toLowerCase(), sub: (m[1] || "").toLowerCase() }; }
    m = path.match(/^\/(?:r\/([^/]+)\/?)?(?:(?:hot|new|top|rising|best|controversial)\/?)?$/i);
    if (m) return { kind: "feed", sub: (m[1] || "").toLowerCase() };
    m = path.match(/^\/(?:user|u)\/([^/]+)/i);
    if (m) return { kind: "user", user: m[1].toLowerCase() };
    return { kind: "other" };
  }
  const mine = (el) => el.classList.contains(OWN);
  // 一条评论自己的那一块：回复嵌在它里面，按"往上最近的那条评论是不是它"挑
  const own = (c, sel) => [...c.querySelectorAll(sel)].find((e) => e.closest(SEL.comment) === c && !mine(e)) || null;
  const commentId = (c) => c.getAttribute("thingid") || null;
  const commentAuthor = (c) => c.getAttribute("author") || "";
  const commentIsOp = (c) => c.hasAttribute("is-op");
  const commentBody = (c) => own(c, SEL.body);
  const commentActionRow = (c) => own(c, SEL.actionRow);
  const commentText = (c) => readText(commentBody(c));
  // 看图片（0.18）：评论里贴的图、帖子卡片上的图（只要用户传到 Reddit 的：i.redd.it、preview.redd.it；头像、徽章、表情不算）
  const REDDIT_IMG = /^https:\/\/(i|preview)\.redd\.it\//;
  const imagesIn = (el) => (el ? [...new Set([...el.querySelectorAll("img")].filter((i) => !i.closest(`.${OWN}`)).map((i) => i.currentSrc || i.src).filter((u) => REDDIT_IMG.test(u)))] : []);
  const commentImages = (c) => imagesIn(commentBody(c));
  const commentTime = (c) => { const t = Date.parse(c.getAttribute("created") || ""); return Number.isFinite(t) ? t : null; };
  const comments = (root = document) => root.querySelectorAll(SEL.comment);
  // 帖子页的主帖：id 和网址里的一样的那个（页面上可能还有推荐的帖子）
  const mainPost = (pid) => document.querySelector(`${SEL.post}[id="${pid}"]`) || document.querySelector(SEL.post);
  const postId = (p) => p.getAttribute("id") || p.getAttribute("post-id") || null;
  const postAuthor = (p) => p.getAttribute("author") || "";
  // 标题那个元素：帖子自己的孩子里带 slot=title 的（不是插件放的）
  const postTitleEl = (p) => [...p.children].find((e) => e.matches(SEL.postTitle) && !mine(e)) || p.querySelector(`${SEL.postTitle}:not(.${OWN}), ${SEL.listTitle}:not(.${OWN})`);
  const postTitle = (p) => (p.getAttribute("post-title") || readText(postTitleEl(p))).trim();
  const postBodyEl = (p) => p.querySelector(`${SEL.postBody}:not(.${OWN})`);
  // 正文真正装内容的那一格：<shreddit-post-text-body> 里面的 <div slot=text-body>，没有就是它自己
  const postBodyBox = (p) => { const b = postBodyEl(p); return b ? b.querySelector(`:scope > ${SEL.postBody}:not(.${OWN})`) || b : null; };
  const postBody = (p) => readText(postBodyEl(p));
  const postText = (p) => [postTitle(p), postBody(p)].filter(Boolean).join("\n");
  const postLang = (p) => (p.getAttribute("post-language") || "").toLowerCase();
  // 帖子列表里的帖子（不算广告；年度帖子页的一条条也算）；搜索结果的每一条
  const feedPosts = () => [...document.querySelectorAll(`${SEL.feed} ${SEL.post}, ${SEL.listItem}`)].filter((p) => !isAd(p));
  // 一条帖子的整张卡片（折叠时藏它）：<shreddit-post> 就是它自己；年度帖子页的是往上走、走到里面开始有别的帖子为止的那一层
  const cards = new WeakMap();
  function cardOf(el) {
    if (el.matches(SEL.post)) return el;
    if (cards.has(el)) return cards.get(el);
    let card = el;
    for (let e = el.parentElement; e && e !== document.body && e.tagName !== "MAIN"; e = e.parentElement) {
      if (e.querySelectorAll(SEL.listItem).length > 1) break;
      card = e;
    }
    cards.set(el, card);
    return card;
  }
  // 搜索的哪几栏管：帖子（不带 type，或 posts、link）、媒体。评论那一栏的结构还没记下来，先不管（一条是评论不是帖子，按帖子认会认错）
  const SEARCH_TABS = new Set(["", "posts", "link", "media"]);
  const searchTabOk = (r = route()) => r.kind === "search" && SEARCH_TABS.has(r.type || "");
  const pidOf = (a) => { const m = /\/comments\/([a-z0-9]+)/i.exec((a && a.getAttribute("href")) || ""); return m ? "t3_" + m[1].toLowerCase() : null; };
  // 搜索结果的标题：看得见的那个链接（post-title-text）。盖住整条的透明链接（post-title，absolute inset-0）不能拿：
  // 0.13.3 以前拿的是它，克隆出来的标题浮在左上角、说明挤进左边那一格、原来的标题还在（2026-10-13 用户截图）。
  // 没有 post-title-text 的（媒体那一栏）：指向帖子、字最多的那个链接（图片链接里只有"1/6"这种页数，没有字母）
  const overlay = (a) => /(^|\s)inset-0(\s|$)/.test(a.className || "");
  function unitTitleEl(u) {
    const t = u.querySelector(`${SEL.unitTitle}:not(.${OWN})`);
    if (t) return t;
    let best = null, n = 0;
    for (const a of u.querySelectorAll(`a[href*="/comments/"]:not(.${OWN})`)) {
      const s = overlay(a) ? "" : readText(a);
      if (/\p{L}/u.test(s) && s.length > n) { best = a; n = s.length; }
    }
    return best;
  }
  const unitTitle = (u) => readText(unitTitleEl(u));
  // 帖子那一栏的一条：从看得见的标题往上走，走到再往上就包进了别的结果为止；途中最外面那个"一条结果"的容器就是它
  // （带 view-events 的 search-telemetry-tracker、search-sdui-post、search-post-unit、search-post-with-content-preview）
  const UNIT_BOX = `search-telemetry-tracker[view-events], [data-testid="search-sdui-post"], [data-testid="search-post-unit"], ${SEL.unitPreview}`;
  const unitCache = new WeakMap();
  function unitOf(title) {
    if (unitCache.has(title)) return unitCache.get(title);
    let best = null;
    for (let e = title.parentElement; e && e !== document.body && e.tagName !== "MAIN"; e = e.parentElement) {
      if (e.matches(SEL.mediaFeed) || e.querySelectorAll(`${SEL.unitTitle}:not(.${OWN})`).length > 1) break;
      if (e.matches(UNIT_BOX)) best = e;
    }
    if (best) unitCache.set(title, best);
    return best;
  }
  // 这一页的一条条结果（从上往下）：帖子那一栏两种都算，媒体那一栏是 <search-media-feed> 的每个孩子（里面有指向帖子的链接）
  function searchUnits(r = route()) {
    if (!searchTabOk(r)) return [];
    const out = new Set();
    for (const t of document.querySelectorAll(`${SEL.unitTitle}:not(.${OWN})`)) { const u = unitOf(t); if (u && !isAd(u)) out.add(u); }
    for (const u of document.querySelectorAll(SEL.searchUnit)) if (!out.has(u) && ![...out].some((x) => x.contains(u) || u.contains(x))) out.add(u);
    for (const f of document.querySelectorAll(SEL.mediaFeed)) for (const u of f.children) if (!mine(u) && u.querySelector('a[href*="/comments/"]')) out.add(u);
    return [...out];
  }
  const isMediaUnit = (u) => !!(u.parentElement && u.parentElement.matches(SEL.mediaFeed));
  const unitId = (u) => {
    const own = u.getAttribute("data-thingid") || u.querySelector('[data-thingid^="t3_"]')?.getAttribute("data-thingid") || "";
    if (/^t3_/.test(own)) return own;
    return pidOf(unitTitleEl(u)) || pidOf(u.querySelector('a[href*="/comments/"]'));
  };
  // 媒体那一栏一条里版块那一行（<faceplate-hovercard> 所在的那一层）：说明放在它右边
  const unitMetaRow = (u) => u.querySelector("faceplate-hovercard")?.parentElement || null;
  // 带摘要的那种的摘要：标题后面、字最多的那一块（不是票数评论数、版块那一行，不是插件放的），往上到不包着标题、票数那一行为止。
  // 摘要具体是什么元素还没记下来（2026-10-13 只知道有这种块），所以按位置找；不带摘要的结果不找（免得把标签当成摘要）
  const NOT_SNIPPET = `.${OWN}, .ff-bar, [data-testid="search-counter-row"], .post-credit-row, faceplate-screen-reader-content, faceplate-hovercard, [hidden], h1, h2, h3, button`;
  function unitSnippetEl(u) {
    if (!(u.matches(SEL.unitPreview) || u.querySelector(SEL.unitPreview))) return null;
    const title = unitTitleEl(u);
    if (!title) return null;
    const boxes = new Map();
    const walker = document.createTreeWalker(u, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const p = t.parentElement;
      if (!p || !/\p{L}/u.test(t.nodeValue) || title.contains(p) || !(title.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) || p.closest(NOT_SNIPPET)) continue;
      let box = p; // 往上走，走到包着标题、票数那一行或者图片（缩略图不能跟着摘要藏起来）为止
      for (let e = p.parentElement; e && e !== u && !e.contains(title) && !e.querySelector('[data-testid="search-counter-row"], img, faceplate-img, video, picture'); e = e.parentElement) box = e;
      if (!boxes.has(box)) boxes.set(box, readText(box).length);
    }
    let best = null, n = 0;
    for (const [box, len] of boxes) if (len > n) { best = box; n = len; }
    return best;
  }
  const unitSnippet = (u) => readText(unitSnippetEl(u));
  // 一条结果要藏的那一块：媒体那一栏藏里面的内容（折叠条放在这一格里面，不然折叠条自己会变成瀑布流里的一格），别的整条
  const unitFoldEl = (u) => (isMediaUnit(u) ? [...u.children].find((k) => !mine(k) && !k.classList.contains("ff-bar")) || u : u);
  const isAd = (el) => !!(el.closest && el.closest(SEL.ad)) || (el.hasAttribute && el.hasAttribute("promoted"));
  const uiLang = globalThis.FFDom.uiLang;
  // Reddit 的深浅色：<html> 上的 theme-dark，没有就按页面底色
  function darkTheme() {
    const h = document.documentElement;
    if (h.classList.contains("theme-dark")) return true;
    if (h.classList.contains("theme-light")) return false;
    return globalThis.FFDom.darkByBg();
  }
  globalThis.FFRD = Object.freeze({
    SEL, OWN, readText, route, comments, commentId, commentAuthor, commentIsOp, commentBody, commentActionRow, commentText, commentTime, commentImages, imagesIn,
    mainPost, postId, postAuthor, postTitleEl, postTitle, cardOf, postBodyEl, postBodyBox, postBody, postText, postLang, feedPosts, searchUnits, unitId,
    searchTabOk, unitTitleEl, unitTitle, unitSnippetEl, unitSnippet, unitMetaRow, unitFoldEl, isMediaUnit, isAd, uiLang, darkTheme,
  });
})();
