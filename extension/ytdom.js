// 读 YouTube（www.youtube.com）页面的地方全在这里。结构是 2026-10-13 在无头 Chrome 里打开公开页面看的（中文界面，不登录）：
// - 评论（视频页、Shorts 的评论面板）：一条一个 <ytd-comment-thread-renderer>，里面 <ytd-comment-view-model id=comment>（没有 shadow DOM）：
//   作者 a#author-text（@账号）、时间链接 #published-time-text a（带 &lc=<评论 id>）、正文 <yt-attributed-string id=content-text>
//   里一个 span（链接、表情图片、时间戳链接在里面；长评论整段都在，只是用"展开"收着）、点赞那一排 #action-buttons、"⋮"菜单 #action-menu。
//   回复在 <ytd-comment-replies-renderer> 里，点"N 条回复"（新版是 #more-replies-sub-thread）才加载，也是 ytd-comment-view-model。
//   名牌（#author-comment-badge）认证频道也有，不一定是频道主——是不是频道主看页面数据（ytdata.js 旁听来的 isCreator）。
// - 标题：链接里夹着一段字，链接本身限 2–3 行（display: flow-root + line-clamp）。换的时候留着链接、只换里面那段字：
//   搜索结果 ytd-video-renderer a#video-title > yt-formatted-string；推荐、首页的新卡片 yt-lockup-view-model a.ytLockupMetadataViewModelTitle > span；
//   老卡片 ytd-rich-grid-media / ytd-compact-video-renderer 的 #video-title；Shorts 卡片 a.shortsLockupViewModelHostEndpoint > span；
//   视频页的标题 ytd-watch-metadata h1 > yt-formatted-string。
// - 简介（视频页）：收起时只有前一百来字（#attributed-snippet-text 里的 span），点"…更多"以后全文在 #expanded 的 yt-attributed-string 里。
// - 站内跳转不换整页，YouTube 还会拿同一个元素换着显示别的视频、别的评论：每次都按链接里的 id 认，不按元素认。
// id：评论 "yt_<评论 id>"（回复的评论 id 里有点），视频 "yt_v_<视频 id>"；这一页的键 "yt:w:<视频 id>"（视频页）、"yt:s:<视频 id>"（Shorts）。
// 不碰 chrome.*；yt.js（折叠）、yttx.js（翻译）用它。
(() => {
  if (globalThis.FFYT) return;
  const { OWN, readText } = globalThis.FFDom;
  // ---------- 页面数据（ytdata.js 在页面自己的环境里旁听，用 postMessage 送过来）----------
  const authors = new Map(); // 评论 id → {channelId, name, creator, verified}
  let video = null; // {videoId, channelId, author}
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (e.source !== window || !d || d.source !== "ff-yt") return;
    if (d.type === "comments" && Array.isArray(d.items)) for (const c of d.items) if (c && typeof c.id === "string") authors.set(c.id, c);
    if (d.type === "video" && d.videoId) video = { videoId: d.videoId, channelId: d.channelId || "", author: d.author || "" };
  });
  window.postMessage({ source: "ff-yt-ask" }, location.origin); // 插件晚到（页面已经开着）：问一声这个视频是谁的

  function route(path = location.pathname, search = location.search) {
    if (path === "/watch") { const v = new URLSearchParams(search).get("v"); if (/^[\w-]{11}$/.test(v || "")) return { kind: "watch", vid: v }; }
    let m = path.match(/^\/shorts\/([\w-]{11})/);
    if (m) return { kind: "shorts", vid: m[1] };
    if (path === "/results") return { kind: "search" };
    if (path === "/" || path === "/feed/subscriptions" || path === "/feed/trending" || /^\/feed\//.test(path)) return { kind: "feed" };
    m = path.match(/^\/(@[^/]+|channel\/[\w-]+|c\/[^/]+|user\/[^/]+)/);
    if (m) return { kind: "channel" };
    return { kind: "other" };
  }
  const vidOf = (href) => { const s = String(href || ""); const m = s.match(/[?&]v=([\w-]{11})/) || s.match(/\/shorts\/([\w-]{11})/); return m ? m[1] : null; };
  // ---------- 评论 ----------
  const comments = () => [...document.querySelectorAll("ytd-comment-view-model")];
  const rawId = (c) => { const h = c.querySelector("#published-time-text a")?.getAttribute("href") || ""; const m = h.match(/[?&]lc=([\w.-]{4,100})/); return m ? m[1] : null; };
  const commentId = (c) => { const r = rawId(c); return r ? "yt_" + r : null; };
  const commentAuthor = (c) => (c.querySelector("#author-text")?.textContent || "").trim();
  const commentBodyHost = (c) => c.querySelector("#content-text");
  // 正文那一格：yt-attributed-string 里那个普通 span（换译文时整格克隆它，不克隆 YouTube 自己的组件）
  const commentBody = (c) => { const h = commentBodyHost(c); return h ? h.querySelector(`:scope > span:not(.${OWN})`) || h : null; };
  const commentInfo = (c) => authors.get(rawId(c) || "") || null;
  // YouTube 自己的"翻译成中文（中国）"按钮（评论上，Shorts 和视频页都有，登录了才有）：state 是 untoggled（原文）/ toggled（正文那一格
  // 原地换成了 Google 的译文，按钮写"查看原文（由 Google 翻译）"）。0.28.1 起插件替你点它（yttx.js）
  const translateButton = (c) => [...c.querySelectorAll("ytd-tri-state-button-view-model.translate-button")].find((b) => b.closest("ytd-comment-view-model") === c) || null;
  const ytTranslated = (c) => translateButton(c)?.getAttribute("state") === "toggled";
  // 正文的字。YouTube 翻过的（页面上是译文）读原文：没翻时读到的（插件替你点之前也记一次）优先，没有就用页面数据里的正文——
  // 不然清理那边以为字变了，每条都重判一次（0.28.1）
  const originals = new Map(); // 评论 id → 原文
  const rememberOriginal = (c) => {
    const id = rawId(c), t = readText(commentBody(c));
    if (!id || !t || ytTranslated(c)) return;
    if (originals.size > 5000) originals.clear();
    originals.set(id, t);
  };
  const commentText = (c) => {
    if (ytTranslated(c)) { const id = rawId(c); return (id && originals.get(id)) || commentInfo(c)?.text || readText(commentBody(c)); }
    rememberOriginal(c);
    return readText(commentBody(c));
  };
  // 折叠时藏的：正文那一块（带"展开"的 ytd-expander）和点赞那一排；作者那一行留着
  const commentFoldEls = (c) => [c.querySelector("#expander") || commentBodyHost(c), c.querySelector("#action-buttons")].filter(Boolean);
  const isReply = (c) => !!c.closest("ytd-comment-replies-renderer");
  // 作者那一行（@作者、徽章、时间）：评论的翻译说明放在这一行后面
  const commentHeader = (c) => c.querySelector("#header-author");
  // ---------- 这个视频 ----------
  const owner = () => {
    const a = document.querySelector("ytd-watch-metadata ytd-video-owner-renderer #channel-name a, ytd-reel-video-renderer[is-active] #channel-name a, #shorts-container .ytReelChannelBarViewModelChannelName a");
    const r = route();
    const v = video && video.videoId === r.vid ? video : null;
    return { name: (a?.textContent || v?.author || "").trim(), href: a?.getAttribute("href") || "", channelId: v ? v.channelId : "" };
  };
  const watchTitleEl = () => document.querySelector("ytd-watch-metadata #title h1 yt-formatted-string:not(.ff-own)");
  const watchTitle = () => readText(watchTitleEl());
  // ---------- 标题（列表里的、视频页的）----------
  // 一条：{key 视频 id、box 换字的那一段（链接里的那个 span / yt-formatted-string）、link 链接、card 这一张卡片（排先后用）}
  const TITLE_LINKS = [
    ["ytd-video-renderer a#video-title", "yt-formatted-string"],
    ["yt-lockup-view-model a.ytLockupMetadataViewModelTitle, yt-lockup-view-model a.yt-lockup-metadata-view-model__title", "span"],
    ["ytd-rich-grid-media a#video-title-link", "yt-formatted-string#video-title"],
    ["ytd-compact-video-renderer a:has(span#video-title)", "span#video-title"],
    ["ytm-shorts-lockup-view-model a.shortsLockupViewModelHostEndpoint, ytm-shorts-lockup-view-model-v2 a.shortsLockupViewModelHostEndpoint", "span"],
  ];
  const CARD = "ytd-video-renderer, yt-lockup-view-model, ytd-rich-item-renderer, ytd-rich-grid-media, ytd-compact-video-renderer, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2";
  function listTitles() {
    const out = [], seen = new Set();
    for (const [linkSel, boxSel] of TITLE_LINKS) {
      for (const link of document.querySelectorAll(linkSel)) {
        if (seen.has(link) || link.closest(`.${OWN}`)) continue;
        seen.add(link);
        const vid = vidOf(link.getAttribute("href"));
        const box = [...link.querySelectorAll(`:scope ${boxSel}`)].find((e) => !e.classList.contains(OWN)) || null;
        if (vid && box) out.push({ vid, id: "yt_v_" + vid, box, link, card: link.closest(CARD) || link });
      }
    }
    return out;
  }
  // 搜索结果标题下面那两行简介摘要
  const snippetOf = (card) => card.matches("ytd-video-renderer") ? card.querySelector(".metadata-snippet-container yt-formatted-string.metadata-snippet-text:not(.ff-own)") : null;
  // 视频页的简介：收起时的那一段、展开以后的全文（各自是 yt-attributed-string 里那个 span）
  const descBox = () => document.querySelector("ytd-watch-metadata ytd-text-inline-expander#description-inline-expander");
  const descSnippet = () => descBox()?.querySelector(`#attributed-snippet-text > span:not(.${OWN})`) || null;
  const descFull = () => { const e = descBox()?.querySelector(`#expanded yt-attributed-string > span:not(.${OWN})`); return e && readText(e) ? e : null; };
  const descExpanded = () => { const d = descBox(); return !!d && d.hasAttribute("is-expanded"); };
  // 这些地方一直在变（播放器每秒换进度时间、直播聊天、顶栏），插件不用跟着重扫
  const QUIET = "ytd-player, #movie_player, ytd-live-chat-frame, #chat-container, #masthead-container, tp-yt-paper-tooltip, ytd-miniplayer";
  // 深色主题：<html dark>
  const dark = () => document.documentElement.hasAttribute("dark");
  const uiLang = () => document.documentElement.lang || navigator.language || "en";
  globalThis.FFYT = Object.freeze({ route, vidOf, comments, rawId, commentId, commentAuthor, commentBody, commentBodyHost, commentText, commentInfo, commentFoldEls, isReply,
    translateButton, ytTranslated, rememberOriginal,
    commentHeader, owner, watchTitleEl, watchTitle, listTitles, snippetOf, descBox, descSnippet, descFull, descExpanded, dark, uiLang, readText, authors, QUIET });
})();
