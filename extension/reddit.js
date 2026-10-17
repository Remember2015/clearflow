// Reddit 上的折叠（新版 www.reddit.com）：帖子页的评论、帖子列表（首页、版块）和搜索结果里的帖子，按垃圾 / 辱骂 / 色情判，
// 折起来写明原因。判法、折叠条都在 fold_engine.js（和 Hacker News 共用），这里只管 Reddit 上"这一页是什么、有哪几条、藏哪几块"。
// 楼主（is-op）的评论不自动折。读页面的地方在 rdom.js。
// 评论折叠只藏它自己的正文和操作栏（作者那一行留着），下面的回复照常显示；帖子列表里折的是整张帖子卡片；
// 搜索结果折整条，"媒体"那一栏藏格子里面的（折叠条放在格子里，不然折叠条自己会变成瀑布流里的一格）。
(() => {
  if (globalThis.__ffReddit) return;
  globalThis.__ffReddit = true;
  const D = globalThis.FFRD;
  // 帖子列表、搜索结果：一堆不相干的人发的帖子，Jev 那边的"主帖"换成一句说明；缓存不按版块、搜的词分
  const CONTEXT = {
    feed: "Posts in a Reddit feed (home page or a subreddit listing), from many unrelated accounts. They are not replies to one post.",
    search: "Posts shown in Reddit search results, from many unrelated accounts. They are not replies to one post.",
  };
  // 帖子页 r:t3_…、帖子列表 rf:版块（首页是 rf:home）、搜索结果 rs:搜的词（版块里搜是 rs:r/版块/搜的词，"媒体"那一栏是 rs:media/搜的词）；
  // 别的页面（用户页、设置……）、搜索里还不管的几栏（评论、社区、用户）不管
  function pageKey(r = D.route()) {
    if (r.kind === "post") return "r:" + r.pid;
    if (r.kind === "search" && r.query) {
      if (!D.searchTabOk(r)) return null;
      const tab = r.type && r.type !== "posts" && r.type !== "link" ? r.type + "/" : "";
      return "rs:" + (r.sub ? `r/${r.sub}/` : "") + tab + encodeURIComponent(r.query.toLowerCase()).slice(0, 80);
    }
    if (r.kind === "feed") return "rf:" + (r.sub || r.page || "home");
    return null;
  }
  const author = (a) => ({ name: a, handle: a ? "u/" + a : "" });
  globalThis.FFFold.start({
    name: "reddit",
    barClass: "ff-reddit",
    pageKey: () => pageKey(),
    modeOf: (key) => (key.startsWith("r:") ? "post" : key.startsWith("rs:") ? "search" : "feed"),
    postContext() {
      const p = D.mainPost(D.route().pid);
      if (!p) return null;
      const a = D.postAuthor(p);
      return { text: D.postText(p), author: a ? author(a) : null };
    },
    contextFor: (mode) => CONTEXT[mode],
    // 这一页要判的：帖子页是评论，列表和搜索结果是帖子
    collect(mode) {
      const out = [];
      if (mode === "post") {
        for (const c of D.comments()) {
          const id = D.commentId(c), body = D.commentBody(c);
          if (!id || !body || D.isAd(c)) continue;
          out.push({ id, el: c, ...author(D.commentAuthor(c)), text: D.commentText(c), op: D.commentIsOp(c), time: D.commentTime(c), images: D.commentImages(c) });
        }
      } else if (mode === "feed") {
        for (const p of D.feedPosts()) {
          const id = D.postId(p);
          if (id) out.push({ id, el: p, ...author(D.postAuthor(p)), text: D.postText(p), op: false, time: null, images: D.imagesIn(p) });
        }
      } else if (mode === "search") { // 标题，带摘要的那种连摘要（0.13.12 以前带摘要的不认）；"媒体"那一栏是标题
        for (const u of D.searchUnits()) {
          const id = D.unitId(u);
          if (id) out.push({ id, el: u, name: "", handle: "", text: [D.unitTitle(u), D.unitSnippet(u)].filter(Boolean).join("\n"), op: false, time: null });
        }
      }
      return out;
    },
    targets: (it, mode) => (mode === "post" ? [D.commentBody(it.el), D.commentActionRow(it.el)] : mode === "feed" ? [D.cardOf(it.el)] : [D.unitFoldEl(it.el)]),
    // 「赞」「mark」这类（0.22）：整条评论藏起来；底下有回复的不藏（回复嵌在这条评论里面，一起藏就没了）。
    // 门槛 0.8 是先定的、比 X / 小红书 / YouTube 的 0.7 严一档：Reddit 自己的数据还只有 12 条（设置 → Reddit → 高级 → 记录 Reddit 评论，攒够了再按它定）
    fillerThreshold: 0.8,
    hasReplies: (it) => !!it.el.querySelector(`${D.SEL.comment}, [slot^="more-comments"]`),
    fillerTag: (it) => [...it.el.querySelectorAll(D.SEL.meta)].find((e) => e.closest(D.SEL.comment) === it.el) || null,
    markSpot: (it) => [...it.el.querySelectorAll(D.SEL.meta)].find((e) => e.closest(D.SEL.comment) === it.el) || null,
    fillerAnchor: () => document.querySelector("shreddit-comment-tree"),
    cacheId: (mode, key) => (mode === "post" ? key : "r:" + mode),
    jevExtra: ["setup"], // 帖子页多问 setup（像骗局的铺垫，门槛比阈值高 0.1；0.15.3 起）。Reddit 自己的数据上还没验过（还没有标过的 Reddit 数据）
    askRec: true, // 帖子页先问是不是求推荐帖（0.15.3）：Reddit 上"哪个好、推荐一个"的帖子很多，回复里报名字是在回答；依据是 V2EX 的数据（求推荐帖里折错 17 → 2），Reddit 自己的还没验
    statFor: (mode) => (mode === "post" ? { posts: 1 } : mode === "search" ? { searches: 1 } : { feeds: 1 }),
    pageOf: (mode) => (mode === "post" ? "status" : mode),
    summaryKind: (mode) => (mode === "post" ? "status" : mode),
    dark: () => D.darkTheme(),
  });
})();
