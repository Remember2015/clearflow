// 读 Hacker News（news.ycombinator.com）页面的地方全在这里。结构是 2026-10-13 打开真页面看的：服务端直出的表格，没有框架、没有 shadow DOM，
// 几乎不改版，不登录也能看全。
// - 列表（首页 /、/news、/newest、/ask、/show、/best……）：一条两行——tr.athing.submission[id=帖子号]（标题 span.titleline > a，
//   后面跟着域名 span.sitebit），下一行 td.subtext（分数、作者 a.hnuser、时间、评论数）。一页 30 条，点 More 翻页。
// - 帖子页 /item?id=：上面一块 table.fatitem——是帖子的话有标题、subtext、正文 .toptext（Ask HN 这种）；打开的是一条评论的话
//   是那条评论（作者行 .comhead、正文 .commtext，"on: 帖子标题"）。下面是评论：一行一个 tr.athing.comtr[id]，**回复不嵌套**，
//   层级写在 td.ind[indent] 里；正文 div.comment > div.commtext（第一段是裸文字，后面的段落才是 <p>，还有 <pre><code>、<i>、链接），
//   作者那一行 span.comhead；HN 自己的折叠 a.togg（[–]）把后面缩进更大的几行一起藏起来。
// - 语言：HN 没有多语言，<html lang> 永远是 en。插件的说明文字和翻译的目标语言跟浏览器的界面语言走（FFPageLang）。
// id 一律加 "hn_"（帖子和评论在 HN 是同一套编号），这一页的键是 "hn:i:帖子号"（帖子页）、"hn:l:列表名"（列表）。
// 不碰 chrome.*（除了 getUILanguage）；hn.js（折叠）、hntx.js（翻译）用它。
(() => {
  if (globalThis.FFHN) return;
  const { readText } = globalThis.FFDom;
  // 浏览器的界面语言：插件说明文字（i18n.js 认 FFPageLang）和翻译的目标语言都用它
  const lang = () => { try { return chrome.i18n.getUILanguage() || navigator.language || "en"; } catch (e) { return navigator.language || "en"; } };
  globalThis.FFPageLang = lang;
  const LISTS = /^\/(news|newest|front|ask|show|best|active|classic|shownew|asknew|pool|launches|jobs)?$/;
  function route(path = location.pathname, search = location.search) {
    if (path === "/item") { const id = new URLSearchParams(search).get("id"); if (/^\d{1,12}$/.test(id || "")) return { kind: "item", id }; }
    const m = path.match(LISTS);
    if (m) return { kind: "list", list: m[1] || "news" };
    return { kind: "other" };
  }
  const hid = (id) => (/^\d{1,12}$/.test(id || "") ? "hn_" + id : null);
  // 列表的一条（标题那一行）
  const stories = () => [...document.querySelectorAll("tr.athing:not(.comtr)")].filter((r) => r.querySelector(".titleline") && !r.closest("table.fatitem"));
  const storyId = (row) => hid(row.id);
  const storyTitleEl = (row) => row.querySelector(".titleline > a:not(.ff-own)");
  const storyTitle = (row) => readText(storyTitleEl(row));
  // 帖子页上面那一块：帖子（有标题）或者打开的那一条评论
  const fatitem = () => document.querySelector("table.fatitem");
  const mainItem = () => fatitem()?.querySelector("tr.athing") || null;
  const mainBody = () => { const f = fatitem(); return (f && (f.querySelector(".toptext") || f.querySelector(".commtext:not(.ff-own)"))) || null; };
  const mainAuthor = () => fatitem()?.querySelector(".subtext a.hnuser, .comhead a.hnuser")?.textContent.trim() || "";
  // 评论
  const comments = () => [...document.querySelectorAll("tr.athing.comtr")];
  const commentId = (c) => hid(c.id);
  const commentBox = (c) => c.querySelector("div.comment"); // 正文和下面的 reply 链接
  const commentBody = (c) => c.querySelector("div.commtext:not(.ff-own)");
  const commentAuthor = (c) => c.querySelector(".comhead a.hnuser")?.textContent.trim() || "";
  const commentText = (c) => readText(commentBody(c));
  const commentTime = (c) => { const t = Date.parse(((c.querySelector(".comhead .age")?.getAttribute("title") || "").split(" ")[0]) + "Z"); return Number.isFinite(t) ? t : null; };
  globalThis.FFHN = Object.freeze({ lang, route, stories, storyId, storyTitleEl, storyTitle, fatitem, mainItem, mainBody, mainAuthor,
    comments, commentId, commentBox, commentBody, commentAuthor, commentText, commentTime, readText });
})();
