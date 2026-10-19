// YouTube 上的折叠：视频页、Shorts 的评论（回复也一条条判），按垃圾 / 辱骂 / 色情判。列表（首页、搜索、频道）上不判，只翻译。
// 规则本身在 ytrules.js（纯函数，Node 里能测），这里只把它们接到折叠引擎上、写好折叠条上的理由。依据和数字见 ytrules.js 开头。
// 0.15.2 起整套判法不靠话术、不分语言：语义交给 Jev（"引流"和新问的 setup），本地规则只看结构。
// - 垃圾看 Jev 两问（spamKeys）："引流"到阈值，或者 setup（像骗局的套路：编的发财 / 找回 / 落难故事、托儿式的提问作证推荐）到阈值 + 0.1。
//   不用"伪装的推广""提到别人做推广"两问：K-pop 粉丝喊"一起刷播放量"、MrBeast 视频底下夸参赛者的都会被当成推广（0.15）。
//   一两个词的短评论证据太少，两问都要再多 0.25 才折（spamThreshold）。
// - 成群吹同一个名字、一串回复里一唱一和、同一个号把同一句话发三遍以上（groups）；只贴一个链接、冒充频道主（localVerdict）；
//   D1 同帖复读按汉字当量算，至少 6（dupMinUnits，0.15.3 起；以前是 ≥ 16 个字符——中文评论要 16 个字才算、英文 16 个字母就算，
//   同一个平台上不同语言的门槛差了好几倍）。6 是 YouTube 自己的数据定的：UCI 的 YouTube 评论里真人一字不差的短句（"i love this song so much"、
//   转发官方链接）在 4.75–5.25，四份抽样上 4–6 折的一样。
//   不问"是不是求推荐帖"（askRec）：抽样的 170 个视频没有一个是（0.15.4 撤掉了 0.15.3 为了和别的站点一样加的这一问）。
// - 辱骂、色情照设置里的阈值。频道主自己的评论不自动折（同 Reddit 的楼主）。折叠只藏正文和点赞那一排，作者那一行、下面的回复留着。
(() => {
  if (globalThis.__ffYT) return;
  globalThis.__ffYT = true;
  const Y = globalThis.FFYT;
  const { t } = globalThis.FFI18n;
  const Y2 = globalThis.FFYTRules;
  const raw = (it) => (it.info && it.info.text) || it.text; // 页面数据里的正文全文（链接是完整的）
  function pageKey() {
    const r = Y.route();
    if (r.kind === "watch") return "yt:w:" + r.vid;
    if (r.kind === "shorts") return "yt:s:" + r.vid;
    if (r.kind === "search" || r.kind === "feed" || r.kind === "channel") return "yt:l:" + r.kind;
    return null;
  }
  globalThis.FFFold.start({
    name: "yt",
    barClass: "ff-yt",
    pageKey,
    modeOf: (key) => (key.startsWith("yt:l:") ? "feed" : "post"),
    judges: (mode) => mode === "post",
    // 主帖：视频标题和频道；楼主是频道主
    postContext() {
      const o = Y.owner(), title = Y.watchTitle();
      if (!title && !o.name) return null;
      return { text: [title, o.name && `(channel: ${o.name})`].filter(Boolean).join("\n"), author: o.name ? { name: o.name, handle: o.name } : null };
    },
    contextFor: () => "Videos in a YouTube list.",
    collect(mode) {
      if (mode !== "post") return [];
      const out = [];
      for (const c of Y.comments()) {
        const id = Y.commentId(c);
        if (!id || !Y.commentBody(c)) continue;
        const info = Y.commentInfo(c), a = Y.commentAuthor(c);
        out.push({ id, el: c, name: a, handle: a, href: Y.commentAuthorHref(c), text: Y.commentText(c), op: !!(info && info.creator), time: null, info });
      }
      return out;
    },
    targets: (it) => Y.commentFoldEls(it.el),
    // 「赞」「mark」这类（0.22）：一级评论藏整个楼（ytd-comment-thread-renderer），回复藏它自己；底下有回复的一级评论不藏。
    // 门槛 0.7 按 YouTube 自己的数据（jev_eval/code/xr_general/short_jev2.mjs：纯表态藏掉 49/62，有内容的藏错 0/34）
    fillerThreshold: 0.7,
    fillerTargets: (it) => [Y.isReply(it.el) ? it.el : it.el.closest("ytd-comment-thread-renderer") || it.el],
    hasReplies: (it) => !Y.isReply(it.el) && !!it.el.closest("ytd-comment-thread-renderer")?.querySelector("#replies ytd-comment-replies-renderer"),
    fillerTag: (it) => Y.commentHeader(it.el),
    markSpot: (it) => Y.commentHeader(it.el),
    fillerAnchor: () => document.querySelector("ytd-comments #sections > #contents"),
    cacheId: (mode, key) => (mode === "post" ? key : "yt:feed"),
    statFor: (mode) => (mode === "post" ? { posts: 1 } : { feeds: 1 }),
    pageOf: (mode) => (mode === "post" ? "status" : "feed"),
    summaryKind: (mode) => (mode === "post" ? "status" : "list"),
    jevExtra: ["setup"],
    spamKeys: () => ["benefit", "setup"],
    dupMinUnits: 6,
    spamThreshold(it, th, key) {
      const need = key === "setup" ? th + 0.1 : th;
      return Y2.isShort(it.text) ? Math.min(0.95, need + 0.25) : need;
    },
    localVerdict(it) {
      const o = Y.owner();
      // 冒充频道主：评论者是谁、这个视频是谁的都知道了才判，频道主本人（作者标记、页面数据里的频道主、主页链接一样）不判
      // （0.28.6，review：以前不知道就当"不是频道主"，页面数据晚到或者 Shorts 划过去时，频道主自己的推广评论被当冒充者清理）
      // 主页链接只比 /@账号 那一段（Shorts 上频道链接是 /@账号/shorts，评论作者的是 /@账号；2026-10-19 真页面上看的）
      const at = (h) => ((h || "").match(/^\/@[^/?#]+/) || [""])[0].toLowerCase();
      const own = it.op || (it.info && it.info.creator) || (at(it.href) && at(it.href) === at(o.href)) || (it.info && o.channelId && it.info.channelId === o.channelId);
      if (o.name && it.info && o.channelId && !own) {
        const handle = (o.href.match(/^\/@([^/?#]+)/) || [])[1] || "";
        if ((Y2.lookalike(it.handle, o.name) || (handle && Y2.lookalike(it.handle, handle))) && it.scores && (it.scores.benefit >= 0.3 || (it.scores.setup ?? 0) >= 0.5))
          return { kind: "imp", reason: t("reason.withDetail", { reason: t("kind.imp"), detail: o.name }) };
      }
      if (Y2.linkOnly(raw(it))) return { kind: "link", reason: t("kind.link") };
      return null;
    },
    groups(items, settings) {
      const th = (settings && settings.threshold) || 0.6;
      const out = new Map();
      const skip = (Y.watchTitle() + " " + Y.owner().name).toLowerCase();
      for (const [id, g] of Y2.shillClusters(items, skip, th - 0.15)) out.set(id, { kind: "shill", reason: t("reason.shill", { n: g.n, name: g.name }) });
      for (const [id, g] of Y2.scamThreads(items, th, th + 0.1)) if (!out.has(id)) out.set(id, { kind: "thread", reason: t("reason.thread", { n: g.n }) });
      for (const [id, g] of Y2.selfRepeat(items.map((it) => ({ ...it, text: raw(it) })))) if (!out.has(id)) out.set(id, { kind: "repeat", reason: t("reason.repeat", { n: g.n }) });
      return out;
    },
    dark: () => Y.dark(),
    quiet: Y.QUIET,
  });
})();
