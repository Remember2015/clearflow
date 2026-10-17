// Hacker News 上的翻译（内容几乎全是英文）。引擎在 tx_engine.js，这里只管"读哪些、放哪儿"：
// - 列表的标题：原位置换（克隆那个链接换上译文，点了照样去原文章）。列表很紧凑，说明不另起一行：标题后面只放一个 ✦ 按钮，
//   鼠标停上去写着"翻译自英语 · 由某模型翻译 · 看原文"，点它看原文 / 看翻译。
// - 帖子页：上面的标题一样；正文（Ask HN 这种 .toptext，或者打开的那条评论）和每条评论带格式原位置换——整格克隆（swapRichWhole），
//   链接、斜体、代码块留着（HN 的评论第一段是裸文字、后面才是 <p>，richtext.js 的 mixed 模式认这种），说明在正文上面一行。
// 目标语言是浏览器的界面语言（HN 的 <html lang> 永远是 en，见 hndom.js）。
(() => {
  if (globalThis.__ffHNTx) return;
  globalThis.__ffHNTx = true;
  const H = globalThis.FFHN;
  function renderStory(e, row) {
    const id = H.storyId(row), titleEl = H.storyTitleEl(row);
    if (!id || !titleEl) return;
    const job = e.ready(`${id}|t`);
    e.swapText(titleEl, id, job, "ff-rtx-title");
    const clone = titleEl.nextElementSibling?.classList.contains("ff-rtx-title") ? titleEl.nextElementSibling : titleEl;
    e.placeIconNote(clone, id, job);
  }
  // 一格带格式的正文（评论、帖子正文）：整格克隆着换（纯文字的任务不会有：整格模式下什么内容都拆得出段）
  const renderBody = (e, box, id, key) => { const j = e.ready(key); if (box && (!j || j.rich)) e.swapRichWhole(box, id, j); };
  function wantBody(e, key, id, box, near) {
    const text = H.readText(box);
    if (!text || !e.foreign(text)) return;
    if (!e.wantRich(key, id, box, e.guessLang(text, ""), { whole: true })) e.want(key, id, text, e.guessLang(text, ""), false, near);
  }
  globalThis.FFTx.start({
    name: "hn",
    uiLang: () => H.lang(),
    scan(e) {
      const r = H.route();
      if (r.kind === "list") {
        for (const row of e.nearOnes(H.stories())) {
          const id = H.storyId(row), title = H.storyTitle(row);
          if (id) e.want(`${id}|t`, id, title, e.guessLang(title, ""), false, row);
        }
      } else if (r.kind === "item") {
        const item = H.mainItem();
        if (item && e.nearOnes([item]).length) {
          const id = H.storyId(item), titleEl = H.storyTitleEl(item);
          if (id && titleEl) { const title = H.readText(titleEl); e.want(`${id}|t`, id, title, e.guessLang(title, ""), false, item); }
          const body = H.mainBody();
          if (id && body) wantBody(e, `${id}|b`, id, body, item);
        }
        for (const c of e.nearOnes(H.comments())) {
          const id = H.commentId(c), box = H.commentBody(c);
          if (id && box) wantBody(e, id, id, box, c);
        }
      }
    },
    render(e) {
      const r = H.route();
      if (r.kind === "list") for (const row of H.stories()) renderStory(e, row);
      else if (r.kind === "item") {
        const item = H.mainItem();
        if (item) {
          const id = H.storyId(item);
          if (H.storyTitleEl(item)) renderStory(e, item);
          if (id) renderBody(e, H.mainBody(), id, `${id}|b`);
        }
        for (const c of H.comments()) { const id = H.commentId(c); if (id) renderBody(e, H.commentBody(c), id, id); }
      }
    },
    count(e) {
      const r = H.route();
      if (r.kind === "list") return H.stories().filter((row) => e.has(H.storyId(row))).length;
      if (r.kind === "item") { const item = H.mainItem(); return (item && e.has(H.storyId(item)) ? 1 : 0) + H.comments().filter((c) => e.has(H.commentId(c))).length; }
      return 0;
    },
  });
})();
