// 小红书（含海外版 rednote.com）上的翻译。引擎在 tx_engine.js，这里只管"读哪些、放哪儿"：
// - 列表（首页、频道、搜索、主页）卡片上的标题：留着标题链接，只把里面那段字换成插件自己的 span；标题最前面一个 ✦（卡片标题限两行，
//   放后面会被截掉），鼠标停上去写着"翻译自英语"，点它看原文。笔记浮层开着的时候不翻后面的卡片（被浮层盖着）。
// - 笔记：标题（h1 整个浅克隆，字号粗细照原来的）、正文（带格式整格换：#话题、@某人、表情图片留着），标题上面一行说明，
//   一个"看原文"管标题和正文。
// - 评论（一级评论和楼中楼一样）：正文那一格（span.note-text）带格式原位置换；说明放在作者那一行的后面
//   （"某某 作者 ✦ 翻译自英语 · 看原文"），评论折起来时不显示。
// 站内跳转不换整页（点开笔记是浮层，关掉回到列表）：每一轮都按网址、评论 id 重新认。
(() => {
  if (globalThis.__ffXHSTx) return;
  globalThis.__ffXHSTx = true;
  const X = globalThis.FFXHS;
  const noteId = (r) => "xh_n_" + r.nid;
  function renderListTitle(e, x) {
    const job = e.ready(`${x.id}|t`);
    e.swapText(x.box, x.id, job, "ff-rtx-title", { plain: true });
    e.placeIconNote(x.box, x.id, job, { before: true });
  }
  function renderNote(e, r) {
    const id = noteId(r), tEl = X.noteTitleEl(), desc = X.noteDesc();
    const tj = tEl ? e.ready(`${id}|t`) : null, bj = desc ? e.ready(`${id}|b`) : null;
    if (tEl) e.swapText(tEl, id, tj, "ff-rtx-title", {});
    if (desc && (!bj || bj.rich)) e.swapRichWhole(desc, id, bj, false);
    const first = tEl || X.noteDescBox();
    if (first && first.parentElement) e.placeNote(first.parentElement, id, tj || (bj && bj.rich ? bj : null), first);
  }
  function renderComment(e, c) {
    const id = X.commentId(c), box = X.commentBody(c);
    if (!id || !box) return;
    const j = e.ready(id), head = X.commentHeader(c);
    if (!j || j.rich) e.swapRichWhole(box, id, j, false);
    if (head) e.placeNote(c, id, j && j.rich ? j : null, null, head, true, { compact: false, cls: "ff-xhs-hnote", rowClass: false });
  }
  function wantRichOrPlain(e, key, id, box, near) {
    const text = X.readText(box);
    if (!text || !e.foreign(text)) return;
    if (!e.wantRich(key, id, box, e.guessLang(text, ""), { whole: true, sig: text })) e.want(key, id, text, e.guessLang(text, ""), false, near);
  }
  globalThis.FFTx.start({
    name: "xhs",
    uiLang: () => X.uiLang(),
    quiet: X.QUIET,
    scan(e) {
      const r = X.route();
      if (r.kind !== "note") {
        const items = X.listTitles();
        for (const card of e.nearOnes(items.map((x) => x.card))) {
          const x = items.find((y) => y.card === card);
          const title = X.readText(x.box);
          e.want(`${x.id}|t`, x.id, title, e.guessLang(title, ""), false, card);
        }
        return;
      }
      const id = noteId(r), tEl = X.noteTitleEl(), desc = X.noteDesc();
      if (tEl && e.nearOnes([tEl]).length) { const t = X.readText(tEl); e.want(`${id}|t`, id, t, e.guessLang(t, ""), false, tEl); }
      if (desc && e.nearOnes([desc]).length) wantRichOrPlain(e, `${id}|b`, id, desc, desc);
      for (const c of e.nearOnes(X.comments())) {
        const cid = X.commentId(c), body = X.commentBody(c);
        if (cid && body && X.commentText(c)) wantRichOrPlain(e, cid, cid, body, c); // 删掉了的评论（只剩"原评论已删除"）不翻
      }
    },
    render(e) {
      const r = X.route();
      if (r.kind !== "note") { for (const x of X.listTitles()) renderListTitle(e, x); return; }
      renderNote(e, r);
      for (const c of X.comments()) renderComment(e, c);
    },
    count(e) {
      const r = X.route();
      if (r.kind !== "note") return X.listTitles().filter((x) => e.has(x.id)).length;
      return (e.has(noteId(r)) ? 1 : 0) + X.comments().filter((c) => e.has(X.commentId(c))).length;
    },
  });
})();
