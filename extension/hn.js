// Hacker News 上的折叠：只在帖子页判评论，只折辱骂和色情，不折垃圾；辱骂的阈值比设置里的严一档（+0.1，默认 0.8）。
// 依据（2026-10-13 抽了首页 30、best 20、ask 10 个帖子的 2452 条评论，按插件的判法跑了一遍，见 feed-filter/多平台适配计划.md）：
// - 垃圾那三问折 40 条，几乎全是误判：HN 的习惯是可以说"我做了个 X"、贴来源链接、推荐工具，Jev 当成"伪装的推广"；
//   真垃圾有人工审核和 flag 管着，看不到。
// - 辱骂 0.7 时 19 条（0.8%），一半是真骂人、一半是带刺的观点；0.8 时 11 条（0.46%），约 6 条明确骂人、4 条带刺、1 条误判。
// - 色情 0 条，开着没坏处。
// 列表上的标题不判（首页是审核过的，标题几乎不会骂人），只翻译。楼主（帖子作者）的评论不自动折。
// 折叠只藏这条评论的 div.comment（正文和 reply 链接），作者那一行留着；后面缩进更大的回复照常显示（HN 的回复不嵌套，是后面几行）。
(() => {
  if (globalThis.__ffHN) return;
  globalThis.__ffHN = true;
  const H = globalThis.FFHN;
  const who = (a) => ({ name: a, handle: a });
  globalThis.FFFold.start({
    name: "hn",
    barClass: "ff-hn",
    pageKey() { const r = H.route(); return r.kind === "item" ? "hn:i:" + r.id : r.kind === "list" ? "hn:l:" + r.list : null; },
    modeOf: (key) => (key.startsWith("hn:i:") ? "post" : "feed"),
    judges: (mode) => mode === "post",
    // 主帖：标题加正文（Ask HN 这种），打开的是一条评论就是那条评论；带上楼主
    postContext() {
      const item = H.mainItem();
      if (!item) return null;
      const title = item.querySelector(".titleline > a") ? H.readText(item.querySelector(".titleline > a")) : "";
      const text = [title, H.readText(H.mainBody())].filter(Boolean).join("\n");
      if (!text) return null;
      const a = H.mainAuthor();
      return { text, author: a ? who(a) : null };
    },
    contextFor: () => "Stories on a Hacker News list, submitted by many unrelated accounts.",
    collect(mode) {
      if (mode !== "post") return [];
      const op = H.mainAuthor();
      const out = [];
      for (const c of H.comments()) {
        const id = H.commentId(c), a = H.commentAuthor(c);
        if (id && H.commentBody(c)) out.push({ id, el: c, ...who(a), text: H.commentText(c), op: !!a && a === op, time: H.commentTime(c) });
      }
      return out;
    },
    targets: (it) => [H.commentBox(it.el)],
    cacheId: (mode, key) => (mode === "post" ? key : "hn:feed"),
    statFor: (mode) => (mode === "post" ? { posts: 1 } : { feeds: 1 }),
    pageOf: (mode) => (mode === "post" ? "status" : "feed"),
    summaryKind: (mode) => (mode === "post" ? "status" : "list"),
    folds: { spam: false, abuse: true, sexual: true },
    // 评论上的漏斗（0.26）：HN 不自动折垃圾，你手动标的照样清理，"同一类"的也按你标的认
    markSpot: (it) => it.el.querySelector(".comhead"),
    thresholdOffset: { abuse: 0.1 },
  });
})();
