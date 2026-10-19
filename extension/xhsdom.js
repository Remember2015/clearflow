// 读小红书页面的地方全在这里：www.xiaohongshu.com 和海外版 www.rednote.com 是同一套前端、同一批笔记和账号（国内账号在 rednote.com
// 登录会被送回 xiaohongshu.com）。结构是 2026-10-15 在浏览器里登录后看的（窄窗口、宽窗口都看了）：
// - 笔记：整页打开（/explore/<笔记 id>，海外版 /discovery/item/<笔记 id>）和从列表点开的浮层（.note-detail-mask，网址也变成 /explore/<id>，
//   下面的列表还在）都是 #noteContainer：标题 #detail-title（h1）、正文 #detail-desc > span.note-text（#话题 是 a.tag，表情是
//   img.note-content-emoji）、作者 .author-container a[href^="/user/profile/<用户 id>"]。
// - 评论：.comments-container > .list-container > .parent-comment，一条一级评论 .comment-item#comment-<评论 id>，它的回复在后面的
//   .reply-container 里（.comment-item.comment-item-sub#comment-<评论 id>，"展开 N 条回复"点了才加载），回复不在一级评论那个元素里面。
//   一条里：.comment-inner-container > .right > .author-wrapper > .author > a.name（data-user-id 是用户 id；作者自己的评论名字后面
//   还有 span.tag"作者"）、.content（回复楼中楼时先是"回复 某某："，正文在里面的 span.note-text）、.comment-picture（评论配图）、
//   .info（时间、属地、赞、回复）。
// - 列表（首页和频道 /explore、搜索 /search_result、主页 /user/profile/<用户 id>）：一张卡片 section.note-item，
//   标题 .footer > a.title > span，作者 .footer .author-wrapper span.name。
// - 页面上没有深浅色标记（<html> 只有 class），按页面底色认。<html lang> 是空的，界面语言按浏览器。
// id：评论 "xh_<评论 id>"、笔记 "xh_n_<笔记 id>"（后台认"两个字母_id"）；这一页的键 "xh:n:<笔记 id>"（笔记）、"xh:l:<类型>"（列表）。
// 不碰 chrome.*；xhs.js（折叠）、xhstx.js（翻译）用它。
(() => {
  if (globalThis.FFXHS) return;
  const { OWN, readText } = globalThis.FFDom;
  const HEX = /^[0-9a-f]{24}$/;

  function route(path = location.pathname) {
    let m = path.match(/^\/(?:explore|discovery\/item)\/([0-9a-f]{24})(?:\/|$)/) || path.match(/^\/user\/profile\/[0-9a-f]{24}\/([0-9a-f]{24})(?:\/|$)/);
    if (m) return { kind: "note", nid: m[1] };
    if (path === "/" || path === "/explore" || path.startsWith("/explore/") || path === "/discovery" || path.startsWith("/discovery/")) return { kind: "feed" };
    if (path.startsWith("/search_result")) return { kind: "search" };
    if (/^\/user\/profile\/[0-9a-f]{24}/.test(path)) return { kind: "profile" };
    return { kind: "other" };
  }
  // 笔记（整页、浮层一样）：没加载出来给 null
  const noteBox = () => document.querySelector("#noteContainer");
  const noteTitleEl = () => { const e = noteBox()?.querySelector("#detail-title"); return e && !e.classList.contains(OWN) ? e : null; };
  const noteDescBox = () => noteBox()?.querySelector("#detail-desc") || null;
  const noteDesc = () => noteDescBox()?.querySelector(`:scope > .note-text:not(.${OWN})`) || null;
  const uidOf = (href) => (String(href || "").match(/\/user\/profile\/([0-9a-f]{24})/) || [])[1] || "";
  function noteAuthor() {
    const box = noteBox();
    const a = box && (box.querySelector(".author-container a.name") || box.querySelector(".author-container a[href*='/user/profile/']"));
    if (!a) return null;
    const name = (a.querySelector(".username")?.textContent || a.textContent || "").trim();
    return { name, uid: uidOf(a.getAttribute("href")) };
  }
  // ---------- 评论 ----------
  const COMMENT = ".comments-container .comment-item";
  const comments = () => [...document.querySelectorAll(COMMENT)];
  const rawId = (c) => { const m = (c.id || "").match(/^comment-([0-9a-f]{24})$/); return m ? m[1] : null; };
  const commentId = (c) => { const r = rawId(c); return r ? "xh_" + r : null; };
  const inner = (c) => c.querySelector(":scope > .comment-inner-container") || c;
  const nameLink = (c) => inner(c).querySelector(".author-wrapper .author a.name");
  const commentAuthor = (c) => (nameLink(c)?.textContent || "").trim();
  const commentUid = (c) => { const a = nameLink(c); const id = a?.getAttribute("data-user-id") || uidOf(a?.getAttribute("href")); return HEX.test(id || "") ? id : ""; };
  const commentContent = (c) => inner(c).querySelector(":scope > .right > .content");
  // 正文那一格（span.note-text）：换译文时整格克隆它；"回复 某某："在它外面，不算正文
  const commentBody = (c) => commentContent(c)?.querySelector(`:scope > .note-text:not(.${OWN})`) || null;
  // 删掉了的评论（下面还有回复）只剩一句"原评论已删除"：不是谁写的字，当没字（不判、不翻）。海外版英文界面的这句话还没见过
  const DELETED = new Set(["原评论已删除"]);
  const commentText = (c) => { const t = readText(commentBody(c)); return DELETED.has(t) ? "" : t; };
  const isReply = (c) => c.classList.contains("comment-item-sub");
  // 看图片（0.18）：评论配图（.comment-picture 里的图；配图是 http 的 xhscdn 链接）
  const commentImages = (c) => [...new Set([...inner(c).querySelectorAll(":scope > .right > .comment-picture img")].map((i) => i.src || i.currentSrc).filter((u) => /^https?:\/\//.test(u)))];
  // 作者那一行（名字、"作者"标签）：评论的翻译说明放在这一行后面
  const commentHeader = (c) => inner(c).querySelector(":scope > .right > .author-wrapper > .author");
  // 折叠时藏的：正文和评论配图；作者那一行、时间赞回复那一行、下面的回复留着
  const commentFoldEls = (c) => { const r = inner(c).querySelector(":scope > .right"); return r ? [r.querySelector(":scope > .content"), r.querySelector(":scope > .comment-picture")].filter(Boolean) : []; };
  // ---------- 列表里的卡片标题 ----------
  // 一条：{nid, id, box 换字的那个 span, link 标题链接, card 这一张卡片}
  function listTitles() {
    const out = [];
    for (const card of document.querySelectorAll("section.note-item")) {
      if (card.closest(`.${OWN}`)) continue;
      const link = card.querySelector(".footer a.title");
      const href = link?.getAttribute("href") || card.querySelector("a.cover")?.getAttribute("href") || "";
      const nid = (href.match(/\/(?:explore|discovery\/item)\/([0-9a-f]{24})/) || href.match(/\/user\/profile\/[0-9a-f]{24}\/([0-9a-f]{24})/) || [])[1];
      const box = link && [...link.querySelectorAll(":scope > span")].find((e) => !e.classList.contains(OWN));
      if (nid && box && readText(box)) out.push({ nid, id: "xh_n_" + nid, box, link, card });
    }
    return out;
  }
  // 这些地方一直在变（视频播放器、轮播图、顶栏的搜索建议），插件不用跟着重扫
  const QUIET = ".player-container, .xgplayer, .media-container, .swiper-wrapper, .header-container .suggestion, .input-box";
  const uiLang = () => document.documentElement.lang || navigator.language || "zh-CN";
  globalThis.FFXHS = Object.freeze({ route, noteBox, noteTitleEl, noteDescBox, noteDesc, noteAuthor, comments, rawId, commentId, commentAuthor, commentUid,
    commentBody, commentText, isReply, commentImages, commentHeader, commentFoldEls, listTitles, uiLang, readText, QUIET });
})();
