// Reddit 上的翻译（新版 www.reddit.com）：和你的界面语言不是一种文字的帖子、评论，插件直接翻。引擎在 tx_engine.js（切块、缓存、
// 先翻眼前的、带格式、说明、几种原位置换），这里只管 Reddit 上"读哪些、放哪儿"。都在原位置换，上面一行小字"✦ 翻译自英语 · 看原文"：
// - 评论：正文那一格里面，藏起原来的内容、放上说明和译文（带格式的逐个孩子克隆，swapRich）；评论被折叠时整格藏起来，译文跟着藏。
// - 帖子页的主帖：标题和正文分开翻、各自原位置换——标题照原来的标题元素克隆一个放在它后面、原来的藏起来，
//   正文在正文那一格里面换；说明放在标题上面（标题不用翻、只翻了正文时放在正文上面），一个"看原文"两处一起切。
// - 帖子列表（首页、版块）：标题和下面的正文摘要都翻（摘要只翻够 6 行的，显示照 Reddit 的行数），换法和主帖一样；
//   克隆的标题还是原来那个链接，点了照样进帖子。搜索结果（"帖子"那一栏）：翻标题，带正文摘要的那种连摘要一起翻（0.13.12）；
//   "媒体"那一栏翻标题，说明放在版块那一行右边、译文不比原来的标题高（那一栏是瀑布流，Reddit 按量好的高度排，变高了会压住下面那张）。
// Reddit 的帖子有 shadow DOM，放进帖子里的东西要带上和原来一样的 slot 才显示（见 rdom.js）。
// Reddit 没告诉我们评论是什么语言，按文字认；帖子标了语言（post-language）的，说明里先照帖子标的写。
(() => {
  if (globalThis.__ffRedditTx) return;
  globalThis.__ffRedditTx = true;
  const D = globalThis.FFRD;
  // 一条帖子：帖子页的主帖（正文全文，键 id|b）、帖子列表里的卡片（正文摘要，键 id|p）
  function renderPost(e, p, card) {
    const id = D.postId(p);
    if (!id) return;
    const tj = e.ready(`${id}|t`), titleEl = D.postTitleEl(p);
    if (titleEl) e.renderTitle(id, titleEl, tj, true);
    const bj = e.ready(`${id}|${card ? "p" : "b"}`), box = D.postBodyBox(p);
    if (!box) return;
    const withNote = !(tj && titleEl), cls = card ? "ff-rtx-preview" : "ff-rtx-body";
    if (bj && bj.rich) { e.swapBox(box, id, null, { cls }); e.swapRich(box, id, bj, withNote); }
    else { e.swapRich(box, id, null, withNote); e.swapBox(box, id, bj, { cls, withNote, wrap: true }); }
  }
  function renderComment(e, c) {
    const id = D.commentId(c), body = D.commentBody(c);
    if (!body) return;
    const job = id && e.ready(id);
    // 换法换了（带格式 ↔ 纯文字）时先把另一种留下的东西清掉
    if (job && job.rich) { e.swapBox(body, id, null, { cls: "ff-rtx" }); e.swapRich(body, id, job, true); }
    else { e.swapRich(body, id, null, true); e.swapBox(body, id, job, { cls: "ff-rtx", withNote: true, wrap: false }); }
  }
  // 搜索结果的一条：标题、摘要（带摘要的那种）各自原位置换，说明一条一个——帖子那一栏放在标题上面（标题不用翻、只翻了摘要时放在摘要上面），
  // 媒体那一栏放在版块那一行的右边，换上的标题最多和原来一样几行（不加高）
  function renderUnit(e, u) {
    const id = D.unitId(u), titleEl = D.unitTitleEl(u);
    if (!id || !titleEl) return;
    const media = D.isMediaUnit(u), sn = D.unitSnippetEl(u);
    const tj = e.ready(`${id}|t`), pj = sn ? e.ready(`${id}|p`) : null;
    e.swapText(titleEl, id, tj, "ff-rtx-title", media ? e.linesOf(titleEl) : null);
    if (sn) e.swapText(sn, id, pj, "ff-rtx-snip");
    const row = media ? D.unitMetaRow(u) : null;
    e.placeNote(u, id, tj || pj, tj ? titleEl : sn, row, true);
  }
  globalThis.FFTx.start({
    name: "reddit",
    uiLang: () => D.uiLang(),
    // 建任务：快要看到的（视野附近的），离视野近的先建
    scan(e) {
      const r = D.route();
      if (r.kind === "post") {
        const post = D.mainPost(r.pid), postLang = post ? D.postLang(post) : "";
        if (post) {
          e.watch(post);
          const id = D.postId(post);
          if (id && e.nearOnes([post]).length) {
            const title = D.postTitle(post), body = D.postBody(post);
            e.want(`${id}|t`, id, title, e.guessLang(title, postLang), false, D.postTitleEl(post) || post);
            if (body && e.foreign(body) && !e.wantRich(`${id}|b`, id, D.postBodyBox(post), e.guessLang(body, postLang))) e.want(`${id}|b`, id, body, e.guessLang(body, postLang), false, post);
          }
        }
        for (const c of e.nearOnes([...D.comments()])) {
          const id = D.commentId(c);
          if (!id) continue;
          const text = D.commentText(c);
          if (text && e.foreign(text) && !e.wantRich(id, id, D.commentBody(c), e.guessLang(text, postLang))) e.want(id, id, text, e.guessLang(text, postLang), false, c);
        }
      } else if (r.kind === "feed") {
        for (const p of e.nearOnes(D.feedPosts())) {
          const id = D.postId(p), lang = D.postLang(p);
          if (!id) continue;
          const title = D.postTitle(p), full = D.postBody(p), [body, truncated] = e.cut(full, e.previewMax(full));
          e.want(`${id}|t`, id, title, e.guessLang(title, lang), false, p);
          e.want(`${id}|p`, id, body, e.guessLang(body, lang), truncated, p);
        }
      } else if (r.kind === "search") {
        for (const u of e.nearOnes(D.searchUnits(r))) {
          const id = D.unitId(u);
          if (!id) continue;
          const title = D.unitTitle(u), full = D.unitSnippet(u);
          e.want(`${id}|t`, id, title, e.guessLang(title, ""), false, u);
          if (full) { const [body, truncated] = e.cut(full, e.previewMax(full)); e.want(`${id}|p`, id, body, e.guessLang(body, ""), truncated, u); }
        }
      }
    },
    render(e) {
      const r = D.route();
      if (r.kind === "post") {
        const p = D.mainPost(r.pid);
        if (p) renderPost(e, p, false);
        for (const c of D.comments()) renderComment(e, c);
      } else if (r.kind === "feed") for (const p of D.feedPosts()) renderPost(e, p, true);
      else if (r.kind === "search") for (const u of D.searchUnits(r)) renderUnit(e, u);
    },
    // 这一页翻了几条（评论、帖子各算一条）
    count(e) {
      const r = D.route();
      if (r.kind === "post") {
        const p = D.mainPost(r.pid);
        return (p && e.has(D.postId(p)) ? 1 : 0) + [...D.comments()].filter((c) => e.has(D.commentId(c))).length;
      }
      if (r.kind === "feed") return D.feedPosts().filter((p) => e.has(D.postId(p))).length;
      if (r.kind === "search") return D.searchUnits(r).filter((u) => e.has(D.unitId(u))).length;
      return 0;
    },
  });
})();
