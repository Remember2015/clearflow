// YouTube 上的翻译。引擎在 tx_engine.js，这里只管"读哪些、放哪儿"：
// - 列表里的视频标题（搜索结果、首页、推荐、频道、Shorts 卡片）：留着那个链接，只把里面那段字换成插件自己的 span（YouTube 的组件克隆了会被
//   它自己重画），字体、行数照链接的；说明不另起一行，标题最前面一个 ✦（放后面会被 2–3 行的限制截掉），鼠标停上去写着"翻译自英语"，点它看原文。
//   搜索结果标题下面那两行简介摘要也翻（和标题一起切）。
// - 视频页：标题换上译文、后面一个 ✦；简介收起时的那一段（截断的，纯文字翻）、展开以后的全文（带格式换：链接、#话题、时间戳留着），
//   简介上面一行说明。
// - 评论（视频页、Shorts）：正文带格式原位置换（整格克隆 yt-attributed-string 里那个 span）；说明放在作者那一行的后面
//   （"@作者 · 11 个月前 ✦ 翻译自英语 · 看原文"）——放进正文那一格的话，YouTube 的"展开"组件（最多 4 行）换字时会以为内容变长了，
//   每条评论下面冒出一个"了解详情"、点了也没东西（2026-10-13 真页面上看到的）。
// YouTube 自己翻成你的语言的标题（作者给了多语言标题、自动配音）已经是中文，按文字认出来就不翻。
// 站内跳转不换整页、同一个元素会换着显示别的视频和评论：每一轮都按链接里的 id 重新认（tx_engine 的说明、克隆都带着任务的键）。
(() => {
  if (globalThis.__ffYTTx) return;
  globalThis.__ffYTTx = true;
  const Y = globalThis.FFYT;
  const watching = (r) => r.kind === "watch" || r.kind === "shorts";
  function renderListTitle(e, x) {
    const job = e.ready(`${x.id}|t`);
    e.swapText(x.box, x.id, job, "ff-rtx-title", { plain: true });
    e.placeIconNote(x.box, x.id, job, { before: true });
    const sn = Y.snippetOf(x.card);
    if (sn) e.swapText(sn, x.id, e.ready(`${x.id}|p`), "ff-rtx-snip", { plain: true });
  }
  function renderWatch(e, r) {
    const id = "yt_v_" + r.vid, tEl = Y.watchTitleEl();
    const tj = e.ready(`${id}|t`);
    if (tEl) {
      e.swapText(tEl, id, tj, "ff-rtx-title", { plain: true });
      const clone = tEl.nextElementSibling?.classList.contains("ff-rtx-title") ? tEl.nextElementSibling : tEl;
      e.placeIconNote(clone, id, tj);
    }
    // 简介：收起时的那一段、展开以后的全文各自整格换；说明一行放在简介最上面
    const box = Y.descBox(), sn = Y.descSnippet(), full = Y.descFull();
    const pj = sn ? e.ready(`${id}|p`) : null, bj = full ? e.ready(`${id}|b`) : null;
    if (sn) e.swapText(sn, id, pj, "ff-rtx-snip", { plain: true, tidy: (x) => x.replace(/\s*(…+|\.{3,})\s*$/, "") }); // 收起时的那一段是截断的，纯文字翻；YouTube 自己会加"…"（中文的"……"是两个）
    if (full && (!bj || bj.rich)) e.swapRichWhole(full, id, bj, false);
    if (box) e.placeNote(box.parentElement, id, bj || pj, box);
  }
  function renderComment(e, c) {
    const id = Y.commentId(c), box = Y.commentBody(c);
    if (!id || !box) return;
    const j = e.ready(id), head = Y.commentHeader(c);
    if (!j || j.rich) e.swapRichWhole(box, id, j, false);
    if (head) e.placeNote(c, id, j && j.rich ? j : null, null, head, true, { compact: false, cls: "ff-yt-hnote", rowClass: false });
  }
  function wantRichOrPlain(e, key, id, box, near, truncated = false) {
    const text = Y.readText(box);
    if (!text || !e.foreign(text)) return;
    if (truncated) { e.want(key, id, text, e.guessLang(text, ""), true, near); return; } // 截断的（收起时的简介）：纯文字翻、告诉模型后面还有
    if (!e.wantRich(key, id, box, e.guessLang(text, ""), { whole: true })) e.want(key, id, text, e.guessLang(text, ""), false, near);
  }
  globalThis.FFTx.start({
    name: "yt",
    uiLang: () => Y.uiLang(),
    quiet: Y.QUIET,
    scan(e) {
      const r = Y.route();
      const items = Y.listTitles();
      for (const card of e.nearOnes([...new Set(items.map((x) => x.card))])) {
        for (const x of items) {
          if (x.card !== card) continue;
          const title = Y.readText(x.box);
          e.want(`${x.id}|t`, x.id, title, e.guessLang(title, ""), false, card);
          const sn = Y.snippetOf(card), st = sn && Y.readText(sn);
          if (st) e.want(`${x.id}|p`, x.id, st, e.guessLang(st, ""), true, card);
        }
      }
      if (!watching(r)) return;
      const id = "yt_v_" + r.vid, tEl = Y.watchTitleEl();
      if (tEl && e.nearOnes([tEl]).length) { const t = Y.readText(tEl); e.want(`${id}|t`, id, t, e.guessLang(t, ""), false, tEl); }
      const box = Y.descBox();
      if (box && e.nearOnes([box]).length) {
        const sn = Y.descSnippet(), full = Y.descFull();
        if (full) wantRichOrPlain(e, `${id}|b`, id, full, box);
        else if (sn) wantRichOrPlain(e, `${id}|p`, id, sn, box, true);
      }
      for (const c of e.nearOnes(Y.comments())) {
        const cid = Y.commentId(c), body = Y.commentBody(c);
        if (cid && body) wantRichOrPlain(e, cid, cid, body, c);
      }
    },
    render(e) {
      const r = Y.route();
      for (const x of Y.listTitles()) renderListTitle(e, x);
      if (!watching(r)) return;
      renderWatch(e, r);
      for (const c of Y.comments()) renderComment(e, c);
    },
    count(e) {
      const r = Y.route();
      let n = Y.listTitles().filter((x) => e.has(x.id)).length;
      if (watching(r)) n += (e.has("yt_v_" + r.vid) ? 1 : 0) + Y.comments().filter((c) => e.has(Y.commentId(c))).length;
      return n;
    },
  });
})();
