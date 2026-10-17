// 小红书（含海外版 rednote.com）上的折叠：笔记底下的评论（楼中楼也一条条判），按垃圾 / 辱骂 / 色情判。列表（首页、频道、搜索、主页）上不判，只翻译。
// 笔记作者自己的评论不自动折（同 Reddit 的楼主）。折叠只藏正文和评论配图，作者那一行、时间赞回复那一行、下面的回复留着。
// 规则按小红书自己的数据定（2026-10-15 在浏览器里登录后采的 65 篇笔记、1597 条评论：11 个频道 + 求推荐搜索，标出 8 条垃圾、21 条两可；
// 再把有标签的 46 批改写成 10 种语言，见 jev_eval/code/xr_general 的 xhs_multi）：
// - 垃圾只看 Jev 两问："引流"和"伪装的推广"，阈值照设置。真垃圾是情感挽回号（让人回 1、2、3 领分析，"免费和好"）、品牌水军夸产品、
//   和笔记不沾边的软广故事、券商号推自家软件、卖水果的号到处留言。
// - 只 @ 了人的评论（去掉 @某某 以后剩下的不超过 6 个汉字当量）不按垃圾折：小红书上 @ 朋友（"@某某 快看"）、@点点（站内 AI）是日常，
//   Jev 却把一个光秃秃的"@某某"当成在给别的账号拉人——引擎原样跑（三问 + setup）在原文上折对 4 条、折错 6 条，错的全是这种；
//   加上这条、去掉"提到别人做推广"那一问以后原文 4 对 0 错，10 种语言的改写集 8 对 0 错（原样跑 8 对 4 错）。
//   "提到别人做推广"在小红书上一条垃圾都没抓到，只折错过一条 @ 了几个演员的粉丝评论。
// - 不多问 setup：原文、改写集上都一条没多抓。不问"是不是求推荐帖"：65 篇里只有 1 篇像，底下没有一条被折。
// - 阈值 0.55 能在原文上多抓 1 条（云南旅居号的软广诗），0.5 多抓 3 条、也多折错 4 条（回答在哪看剧、在哪领会员这种）：
//   8 条垃圾不够定一个更低的门槛，照设置的三档走（严格档就是 0.5）。辱骂、色情照设置（辱骂 0.7 折的 7 条里 3 条明确骂人、4 条两可，色情 1 条对）。
// - 删掉的评论（下面还有回复）页面上只剩"原评论已删除"：不判（xhsdom.js 的 commentText 给空），不然几条一样的字会被当成同帖复读。
// 还没采到：兼职 / 副业 / 贷款这类搜索、英文和日韩文的笔记（采到第 61 篇时小红书弹了验证，停了），这些上面的表现没量过。
(() => {
  if (globalThis.__ffXHS) return;
  globalThis.__ffXHS = true;
  const X = globalThis.FFXHS, R = globalThis.FFRules;
  const MENT = /@[^\s@]+/g;
  const mentionOnly = (text) => { MENT.lastIndex = 0; return MENT.test(text) && R.coreUnits(text.replace(MENT, "")) <= 6; };
  function pageKey() {
    const r = X.route();
    if (r.kind === "note") return "xh:n:" + r.nid;
    if (r.kind === "feed" || r.kind === "search" || r.kind === "profile") return "xh:l:" + r.kind;
    return null;
  }
  globalThis.FFFold.start({
    name: "xhs",
    barClass: "ff-xhs",
    pageKey,
    modeOf: (key) => (key.startsWith("xh:n:") ? "post" : "feed"),
    judges: (mode) => mode === "post",
    // 主帖：笔记的标题和正文；楼主是笔记作者。只有图的笔记（没标题没正文）也照样判，只告诉 Jev 是谁发的
    postContext() {
      if (!X.noteBox()) return null;
      const a = X.noteAuthor();
      const text = [X.readText(X.noteTitleEl()), X.readText(X.noteDesc())].filter(Boolean).join("\n");
      if (!text && !(a && a.name)) return null;
      return { text: text || "(a Xiaohongshu note with only pictures)", author: a && a.name ? { name: a.name, handle: a.name } : null };
    },
    contextFor: () => "Notes in a Xiaohongshu (RedNote) list.",
    collect(mode) {
      if (mode !== "post") return [];
      const a = X.noteAuthor(), out = [];
      for (const c of X.comments()) {
        const id = X.commentId(c), images = X.commentImages(c);
        if (!id || (!X.commentBody(c) && !images.length)) continue; // 只有配图、没写字的也收（看图片开着才判，见 fold_engine.js）
        const name = X.commentAuthor(c), uid = X.commentUid(c);
        out.push({ id, el: c, name, handle: name, text: X.commentText(c), op: !!(a && a.uid && uid && uid === a.uid), time: null, images });
      }
      return out;
    },
    targets: (it) => X.commentFoldEls(it.el),
    // 「赞」「mark」这类（0.22）：一级评论藏整个 .parent-comment（它的回复在后面的 .reply-container 里），楼中楼藏它自己；
    // 底下有回复的一级评论不藏。门槛 0.7 按小红书自己的数据（纯表态藏掉 31/42，有内容的藏错 1/50）
    fillerThreshold: 0.7,
    fillerTargets: (it) => [it.el.classList.contains("comment-item-sub") ? it.el : it.el.closest(".parent-comment") || it.el],
    hasReplies: (it) => !it.el.classList.contains("comment-item-sub") && !!it.el.closest(".parent-comment")?.querySelector(".reply-container .comment-item, .reply-container .show-more"),
    fillerTag: (it) => it.el.querySelector(".author-wrapper > .author") || it.el.querySelector(".author-wrapper"),
    markSpot: (it) => it.el.querySelector(".author-wrapper > .author") || it.el.querySelector(".author-wrapper"),
    fillerAnchor: () => document.querySelector(".comments-container > .list-container"),
    cacheId: (mode, key) => (mode === "post" ? key : "xh:feed"),
    statFor: (mode) => (mode === "post" ? { posts: 1 } : { feeds: 1 }),
    pageOf: (mode) => (mode === "post" ? "status" : "feed"),
    summaryKind: (mode) => (mode === "post" ? "status" : "list"),
    spamKeys: () => ["benefit", "disguised"],
    // 只 @ 了人的（@ 后面到空白为止是昵称，可以是中文）：垃圾那两问不管它（返回 Infinity），辱骂、色情照判
    spamThreshold: (it, th) => (mentionOnly(it.text) ? Infinity : th),
    quiet: X.QUIET,
  });
})();
