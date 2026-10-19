// 折叠引擎（Reddit、Hacker News……共用，0.14 从 reddit.js 抽出来；X 的在 content.js）：一页上的一条条（评论，或者列表里的帖子）
// 按垃圾 / 辱骂 / 色情判，折起来写明原因。判法和 X 上一样：你的纠错优先，记住的句子、D1 同帖复读、邀请码 / base64 这些本地规则，
// 再交给 Jev 的五问（阈值同一套设置）；折叠条也一样（foldbar.js）：能展开、判对了吗、判错了、记住这句话。
// 每个站点给一个 site 对象，只管"这一页是什么、有哪几条、折的时候藏哪几块"：
//   pageKey() 这一页的键（不管的页面给 null）；modeOf(键) "post"（一个帖子底下的评论）/ "feed"（列表）/ "search"（搜索结果）；
//   collect(mode) [{id, el, name, handle, text, op, time}]；targets(it, mode) 要藏的几块（折叠条放在第一块前面）；
//   postContext() 帖子页的主帖 {text, author}（还没加载出来给 null，下一轮再问）；contextFor(mode) 列表、搜索结果给 Jev 的那句说明；
//   cacheId(mode, 键) Jev 结果按什么缓存；statFor(mode) 统计记哪一项；pageOf(mode) 记"最近折叠"时的页面类型；summaryKind(mode) 弹窗的页面类型；
//   folds 这个站点折哪几类（{spam, abuse, sexual}，默认都折）；thresholdOffset 阈值在设置的基础上再调多少（{abuse: 0.1} 严一档）；
//   quiet 这些地方的变化不用重扫（YouTube 的播放器每秒都在换进度时间）；judges(mode) 这一类页面判不判（不判的页面弹窗不报折了几条，比如 HN 的列表只翻译）；barClass 折叠条额外的 class；dark() 深色主题。
//   可选的站点规则（0.15，YouTube 用）：spamKeys(mode) 垃圾这一类看 Jev 的哪几问（默认评论区三问、列表只看"引流"）；
//   localVerdict(it) 这一条自己的本地规则（冒充频道主），返回 {kind, reason} 就折；groups(items, settings) 一页里成群的（很多号吹同一个名字、
//   一串回复里几个号一唱一和），返回 Map(id → {kind, reason})。这几样都算垃圾这一类（folds.spam 关着就不用）。
//   0.15.1 起：spamThreshold(it, 阈值, 问题名) 这一条按这一问要多少分才折（YouTube：一两个词的短评论要更高、setup 高一档；
//   不给的话 setup 比阈值高 0.1，别的就是阈值）；0.15.2 起 jevExtra 这个站点的帖子页要 Jev 多问的问题（jev.js 的 EXTRA_QUESTIONS，
//   YouTube、Reddit 问 setup；HN 不折垃圾，不问），多问的默认也算进垃圾这一类。
//   0.15.3 起：askRec 帖子页先问 Jev 一句"这个帖子是不是在请大家推荐"（rec，jev.js 的 POST_QUESTIONS），是的话垃圾这一类的门槛换成
//   "求推荐类帖子的阈值"（Reddit 问；YouTube 不问——它的数据里 170 个视频没有一个是求推荐的，0.15.4）；
//   dupMinUnits D1 同帖复读的句子至少几个汉字当量（rules.js 的 units；不给就是 rules.js 的默认值 6）。
//   0.22 起「赞」「mark」这类回复（设置里的 filler）：fillerThreshold 这个站点 Jev 那一问（jev.js 的 filler）要多少分才藏（不给就不做）；
//   fillerTargets(it) 藏哪几块（整条，不给就是 it.el）；hasReplies(it) 底下有回复的不藏（藏了回复就没了上文）；
//   fillerTag(it) 显示出来时小标签放进哪个元素（作者那一栏）；fillerAnchor() 评论区最上面那一行放在哪个元素前面；
//   fillPinned(anchor) 那一行一直看得见、列表下面不用再放一行；fillIndent(anchor) 那一行往里缩多少（和评论对齐）。
//   0.26 起：markSpot(it) 评论上"清理掉这条"的漏斗放进哪个元素（作者那一行；不给就不放）。
// 每个站点的这些值按这个站点自己的数据定，不求各站点一样（用户 2026-10-14："不是所有平台一套规则，是单个平台内换话题、换语言都成立"）。
// 按 X 的 @ 设计的 M1、"只贴自己的帖子"不用；楼主（op）的评论不自动折。读页面一律走 FFDom.readText（见 ffdom.js）。
(() => {
  if (globalThis.FFFold) return;
  const R = globalThis.FFRules, B = globalThis.FFBar, Dm = globalThis.FFDom;
  const { t } = globalThis.FFI18n;
  const { cat } = B;
  const KIND = (k) => t(`kind.${k}`);
  const REASON = (k) => t(`reason.${k}`);
  const SPAM_KEYS = ["benefit", "disguised", "promo_mention"];
  // 列表、搜索结果里的是一条条帖子，不是回复：只看"引流"那一问（理由见 content.js 的 POST_SPAM_KEYS；
  // Reddit 上的实例：新闻标题、电影海报、自己做的免费工具被"伪装成普通评论的广告"折了，招聘、私信我这类"引流"都在 0.72 以上）
  const POST_SPAM_KEYS = ["benefit"];

  function start(site) {
    const folds = { spam: true, abuse: true, sexual: true, ...(site.folds || {}) };
    const offset = site.thresholdOffset || {};
    const th = (v, k) => Math.min(0.99, v + (offset[k] || 0));
    const S = {
      settings: null, hasKey: false, enabled: true, loading: true, error: null,
      key: null, mode: null, postText: "", postAuthor: null, rec: undefined, // rec：帖子页"是不是在请大家推荐"的分，undefined 还没问、null 正在问
      items: new Map(), order: [], queue: [], inflight: 0, epoch: 0, slogans: [], markedIds: new Set(), markedPrep: [], markedRev: 0, markedPage: null,
      dupOff: new Set(), near: R.nearState(), sloganVersion: 0,
      showFill: false, // 「赞」「mark」这类（清理得多的页面连被清理的一起）：点了"查看"，这一页的全部显示出来
      heavy: false, // 这一页清理条超过 B.HEAVY_UNITS：被清理的整条藏起来（0.27）
      groups: new Map(), openGroups: new Set(), // 连着的一串被折的（0.22.1）：第一条的 id → {ids, open}；点开过的串里的条目
    };
    const alive = () => { try { return !!chrome.runtime.id; } catch (e) { return false; } };
    function send(msg) {
      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(msg, (r) => {
            // 传话出错（后台刚重启、"message port closed"）可以重试（0.28.10，review：以前没带 retryable，这一批整页都不再问）
            if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message, code: "network", retryable: true });
            else resolve(r || {});
          });
        } catch (e) { resolve({ error: String(e) }); }
      });
    }
    const stat = (delta) => send({ type: "stat", delta });
    const item = (id) => S.items.get(id);

    // ---------- 设置 ----------
    let settingsVersion = 0;
    async function loadSettings() {
      const version = ++settingsVersion;
      S.loading = true;
      const r = await send({ type: "settings" });
      if (version !== settingsVersion) return;
      if (r.error || !r.settings) { S.error = t("cs.settingsFail"); setTimeout(() => { if (alive()) loadSettings(); }, 2000); return; }
      const { ff_confirmed_slogans = [] } = await chrome.storage.local.get("ff_confirmed_slogans");
      if (version !== settingsVersion) return;
      const imagesBefore = S.settings ? !!S.settings.images : null;
      S.settings = globalThis.FFSettings.forSite(r.settings, site.name); // 这个网站上实际用的（0.20 起每个网站可以单独改）
      S.hasKey = r.hasKey;
      // 看图片开关变了：带图的那几条要按新的样子重问（开了连图一起问、关了只问字）
      if (imagesBefore !== null && imagesBefore !== !!S.settings.images) for (const it of S.items.values()) if (it.images && it.images.length) { it.scores = null; it.stale = true; }
      S.enabled = S.settings.enabled;
      setMarked(ff_confirmed_slogans);
      S.loading = false;
      S.error = null;
      if (S.recRetry) { S.rec = undefined; S.recRetry = false; }
      S.epoch++;
      S.queue = [];
      for (const it of S.items.values()) { it.decision = null; it.queued = false; it.jevSkipped = false; }
      scheduleScan(0);
    }

    // 你标记的垃圾（feedback.js 的 ff_confirmed_slogans）：一字不差地认的那几句、标的是哪几条
    function setMarked(list) {
      S.slogans = (list || []).map((x) => x.text);
      S.markedIds = new Set((list || []).map((x) => x.source && x.source.id).filter(Boolean));
      S.markedPrep = R.markedPrep(list || []);
      S.markedRev++;
    }
    // 和你标记过的先在本地比（0.27，rules.js 的 markedMatch：一字不差、同一个链接、近乎一样的模板），认出来的不问 Jev
    function markLocal() {
      for (const it of S.items.values()) {
        if (it.userLabel) { it.markedLocal = null; it.mlKey = null; continue; }
        const k = `${S.markedRev}|${it.text}`;
        if (it.mlKey === k) continue;
        it.mlKey = k;
        it.markedLocal = R.markedMatch(it.text, S.markedPrep);
      }
    }
    function markedDecision(m) {
      if (m.kind === "same") return { fold: true, kind: "slogan", reason: KIND("slogan") };
      const kind = `marked_${m.kind}`;
      return { fold: true, kind, reason: m.detail ? t("reason.withDetail", { reason: KIND(kind), detail: m.detail }) : KIND(kind) };
    }

    // ---------- 这一页 ----------
    // 一页先判 40 条，往下滚一屏多放一些（foldbar.js 的 readBudget）；判过的、你自己标的不受它管
    const budget = B.readBudget(() => scheduleScan(0));
    const DEFERRED = Object.freeze({ fold: false, kind: "deferred" });
    const deferred = (it) => !it.started && !it.userLabel && (it.seq ?? 0) >= budget.budget;
    function resetFor(key) {
      budget.reset();
      S.epoch++;
      clearUI();
      S.key = key; S.items = new Map(); S.order = []; S.queue = []; S.dupOff = new Set(); S.near = R.nearState(); S.showFill = false; S.groups = new Map(); S.openGroups = new Set(); S.heavy = false;
      S.mode = key ? site.modeOf(key) : null;
      S.postText = ""; S.postAuthor = null; S.rec = undefined;
      if (!key) return;
      if (S.mode !== "post") S.postText = site.contextFor(S.mode);
      stat(site.statFor(S.mode));
    }
    function collect() {
      if (S.mode === "post" && !S.postText) { // 主帖：告诉 Jev 帖子说了什么、谁发的（楼主推自己的东西不算给别人拉人）
        const c = site.postContext();
        if (c) { S.postText = (c.text || "").slice(0, 400); S.postAuthor = c.author || null; }
      }
      return site.collect(S.mode).filter((x) => x.text || withImg(x));
    }
    // 看图片（0.18，设置里默认关）开着、这条带图：没字也判（只看图），短文本豁免也不用
    const withImg = (it) => !!(S.settings && S.settings.images && it.images && it.images.length);

    // ---------- 判定 ----------
    // 「赞」「mark」这类（0.22）：帖子页上很短、不带图不带链接的回复多问 Jev 一句；分到这个站点的门槛、底下没有回复的整条藏起来
    const fillerAsk = (it) => site.fillerThreshold != null && !!S.settings && S.settings.filler !== false && S.mode === "post" && !it.userLabel &&
      !(it.images && it.images.length) && R.fillerShort(it.text);
    const fillerHide = (it) => fillerAsk(it) && !!it.scores && typeof it.scores.filler === "number" && it.scores.filler >= site.fillerThreshold &&
      !(site.hasReplies && site.hasReplies(it));
    // 帖子作者（楼主、频道主、笔记作者）自己的评论多问一句"是不是在接着讲自己这个帖子"（0.28.11，jev.js 的 op_topic）：是的话垃圾三问不清理它
    const opAsk = (it) => !!it.op && S.mode === "post" && !it.userLabel;
    const onTopic = (it) => opAsk(it) && !!it.scores && typeof it.scores.op_topic === "number" && it.scores.op_topic >= globalThis.FFSettings.OP_TOPIC_THRESHOLD;
    const asks = (it) => [...(fillerAsk(it) ? ["filler"] : []), ...(opAsk(it) ? ["op_topic"] : [])];
    function decide(it) {
      if (!it.overrideReady) return { fold: false, kind: "pending" };
      if (it.userLabel === "missed") return { fold: true, kind: "user", reason: KIND("user") };
      if (it.userLabel === "missed_abuse") return { fold: true, kind: "user_abuse", reason: KIND("user_abuse") };
      if (it.userLabel === "missed_sexual") return { fold: true, kind: "user_sexual", reason: KIND("user_sexual") };
      if (it.userLabel === "fp") return { fold: false, kind: "user_fp" };
      // 楼主（帖子作者、频道主、笔记作者）的评论照样判（0.21.3，用户：作者的评论也得过滤；以前一律不折）。
      // 站点规则里讲"别人"的那几条照旧不算作者本人（YouTube 的冒充频道主、成群吹、一唱一和，见 ytrules.js）
      const st = S.settings;
      if (it.markedLocal) return markedDecision(it.markedLocal); // 你标记过的（不管这个站点折不折垃圾）
      if (folds.spam) {
        const lv = R.localVerdict(it.text, new Set(), { m1: false, m1MaxLen: st.m1MaxLen, media: false }); // 邀请码、base64 藏联系方式
        if (lv) return { fold: true, kind: lv.kind, reason: lv.detail ? t("reason.withDetail", { reason: KIND(lv.kind), detail: lv.detail }) : KIND(lv.kind) };
        if (st.dup !== false && it.dup) return { fold: true, kind: "dup", reason: t("reason.dup", { n: it.dup.count }) };
        if (st.dup !== false && it.known) return { fold: true, kind: "slogan", reason: KIND("slogan") };
        const sv = site.localVerdict ? site.localVerdict(it) : null; // 站点自己的规则（YouTube：冒充频道主）
        if (sv) return { fold: true, kind: sv.kind, reason: sv.reason };
        if (it.group) return { fold: true, kind: it.group.kind, reason: it.group.reason }; // 成群的（YouTube：很多号吹同一个名字）
      }
      if (st.useJev && S.hasKey && it.scores) {
        // 求推荐帖的那一问还没回来：先等着，不按普通阈值先折、回来再展开（见 ensureRec）
        if (site.askRec && folds.spam && S.mode === "post" && S.postText && S.rec == null) return { fold: false, kind: "pending" };
        const cands = [];
        // 和你标记过的垃圾是同一类（0.26）：你自己标的，不管这个站点折不折垃圾（HN）、也不用短文本豁免
        const mk = it.scores.marked;
        if (typeof mk === "number" && mk >= globalThis.FFSettings.MARKED_THRESHOLD) cands.push({ kind: "marked", score: mk, reason: KIND("marked") });
        if (folds.spam) {
          const keys = site.spamKeys ? site.spamKeys(S.mode) : S.mode === "post" ? [...SPAM_KEYS, ...(site.jevExtra || [])] : POST_SPAM_KEYS;
          // 每一问各有各的门槛（站点没给就是设置里的阈值、setup 再高 0.1）；过了门槛的里面挑超出最多的那一问写理由
          const base = th(site.askRec && S.mode === "post" && S.rec >= 0.5 ? st.recThreshold : st.threshold, "spam");
          let best = null;
          for (const k of keys) {
            const v = it.scores[k];
            if (typeof v !== "number") continue;
            const need = site.spamThreshold ? site.spamThreshold(it, base, k) : k === "setup" ? base + 0.1 : base;
            if (v >= need && (!best || v - need > best.over)) best = { k, v, over: v - need };
          }
          if (best && (withImg(it) || !R.shortExempt(it.text)) && !onTopic(it)) cands.push({ kind: "jev", score: best.v, reason: `${REASON(best.k)} ${best.v.toFixed(2)}` });
        }
        for (const [k, on, kth] of [["abuse", st.abuse, st.abuseThreshold], ["sexual", st.sexual, st.sexualThreshold]]) {
          const v = it.scores[k];
          if (folds[k] && on !== false && typeof v === "number" && v >= th(kth, k)) cands.push({ kind: k, score: v, reason: `${KIND(k)} ${v.toFixed(2)}` });
        }
        if (cands.length) { const c = cands.sort((a, b) => b.score - a.score)[0]; return { fold: true, kind: c.kind, reason: c.reason }; }
        if (fillerHide(it)) return { fold: false, hide: true, kind: "filler", score: it.scores.filler };
        return { fold: false, kind: "jev_ok" };
      }
      return { fold: false, kind: it.jevSkipped ? "skipped" : "pending" };
    }
    function needJev(it) {
      // 已经有分、但这条该多问的 filler 没问过（刚打开这个开关）：重问一次
      const missing = !it.scores || it.stale || (fillerAsk(it) && typeof it.scores.filler !== "number") || (opAsk(it) && typeof it.scores.op_topic !== "number");
      if (!(S.enabled && !S.loading && it.overrideReady && !it.userLabel && S.settings.useJev && S.hasKey && missing && !it.queued && !it.jevSkipped && (it.text.trim() || withImg(it)))) return false;
      if (it.markedLocal) return false;
      if (folds.spam && ((S.settings.dup && (it.dup || it.known)) || R.localVerdict(it.text, new Set(), { m1: false, m1MaxLen: S.settings.m1MaxLen, media: false }))) return false;
      return true;
    }
    function markSlogans() {
      if (S.settings.dup === false || !folds.spam) { S.items.forEach((it) => { it.dup = null; it.known = null; }); return; }
      const groups = S.mode === "post" ? R.findDupSlogans([...S.items.values()], S.postText, { ...(site.dupMinUnits ? { minUnits: site.dupMinUnits } : {}), nearCache: S.near }) : new Map(); // D1 只在一个帖子的评论里算
      const inGroup = new Map();
      // 你在这一串里点过"不是垃圾"的：组里哪一句被点过都算（0.28.10，review：以前只看组的代表句，模板的另一种写法多了几条、代表句换了，整串又折回去）
      const off = (n, ids) => S.dupOff.has(n) || ids.some((id) => { const x = S.items.get(id); return x && S.dupOff.has(R.normSlogan(x.text)); });
      for (const [n, ids] of groups) { if (off(n, ids)) continue; for (const id of ids) inGroup.set(id, { n, count: ids.length }); }
      const known = new Set(S.slogans);
      for (const it of S.items.values()) {
        if (it.userLabel) continue;
        it.dup = inGroup.get(it.id) || null;
        const n = R.normSlogan(it.text);
        it.known = !it.dup && !S.dupOff.has(n) && known.has(n) && R.sloganOk(n) ? n : null;
      }
    }
    function loadOverrides() {
      const batch = [...S.items.values()].filter((it) => !it.overrideReady && !it.overrideLoading);
      if (!batch.length) return;
      const items = S.items;
      batch.forEach((it) => { it.overrideLoading = true; });
      send({ type: "replyOverrides", ids: batch.map((it) => it.id) }).then((r) => {
        if (items !== S.items) return;
        for (const it of batch) {
          it.overrideLoading = false;
          if (r.error || !r.overrides) continue; // 下一轮扫描再读
          it.userLabel = r.overrides[it.id] || null;
          it.overrideReady = true;
        }
        scheduleScan(r.error ? 1500 : 0);
      });
    }
    function flush() {
      const cacheId = site.cacheId(S.mode, S.key);
      while (S.enabled && !S.loading && S.settings.useJev && S.hasKey && S.queue.length && S.inflight < 2) {
        const batch = S.queue.splice(0, 10);
        const key = S.key, epoch = S.epoch;
        S.inflight++;
        send({ type: "jev", postId: cacheId, post: S.postText, author: S.postAuthor,
          replies: batch.map((it) => ({ id: it.id, name: it.name, handle: it.handle, text: it.text, ...(withImg(it) ? { images: it.images } : {}), ...(asks(it).length ? { ask: asks(it) } : {}) })),
          ...(site.jevExtra && S.mode === "post" ? { extra: site.jevExtra } : {}) })
          .then((r) => {
            if (key !== S.key || epoch !== S.epoch) return;
            for (const it of batch) {
              it.queued = false;
              if (r.scores && r.scores[it.id]) { it.scores = r.scores[it.id]; it.stale = false; }
              else {
                it.jevSkipped = true;
                if (r.retryable && (it.attempts || 0) < 1) {
                  it.attempts = (it.attempts || 0) + 1;
                  setTimeout(() => { if (epoch === S.epoch && item(it.id) === it) { it.jevSkipped = false; scheduleScan(0); } }, 5000);
                }
              }
            }
            scheduleScan(0);
          })
          .finally(() => { S.inflight--; if (S.queue.length) flush(); });
      }
    }

    // 帖子页问一句"这个帖子是不是在请大家推荐"（rec）：只看帖子是哪一条，问不到（没 key、出错）就按普通帖子判。
    // 只有 askRec 的站点问；只管垃圾这一类的门槛，不折垃圾的站点也不问
    function ensureRec() {
      if (!site.askRec || !folds.spam || S.mode !== "post" || S.rec !== undefined || !S.postText || !S.settings.useJev || !S.hasKey) return;
      S.rec = null;
      const key = S.key;
      send({ type: "jevPost", postId: key, post: S.postText, author: S.postAuthor }).then((r) => {
        if (key !== S.key) return;
        const got = r.scores && typeof r.scores.rec === "number";
        S.rec = got ? r.scores.rec : 0;
        S.recRetry = !got; // 没问到的，设置或 key 变了再问一次
        scheduleScan(0);
      });
    }

    // ---------- 纠错（和 X 上走同一条路：后台存成你的决定，所有打开着的页面跟着变） ----------
    async function feedback(it, label) {
      if (it.saving) return false;
      it.saving = true;
      const d = it.decision || {};
      const r = await send({ type: "feedback", entry: { label, postId: S.key, id: it.id, handle: it.handle, name: it.name, text: it.text, kind: d.kind, reason: d.reason || "", scores: it.scores || null } });
      it.saving = false;
      if (!r.ok) return false;
      it.userLabel = r.label || it.userLabel;
      it.overrideReady = true;
      return true;
    }
    function onToggle(id) { const it = item(id); if (!it) return; it.expanded = !it.expanded; render(it); }
    async function onFalsePositive(id) {
      const it = item(id);
      if (!it || !await feedback(it, "fp")) return;
      if (it.userLabel === "fp") forgetSlogan(it);
      it.decision = decide(it); render(it); scheduleScan(0);
    }
    async function onConfirm(id) {
      const it = item(id);
      if (!it || !await feedback(it, "confirm")) return;
      it.expanded = false; it.decision = decide(it); render(it);
    }
    function forgetSlogan(it) {
      // 近乎一样的一组（rules.js 的 mergeNear）用组里的代表句当键，不一定是这一条自己的那句：两个都记下
      const n = R.normSlogan(it.text), g = it.dup ? it.dup.n : null;
      if (!n && !g) return;
      S.slogans = S.slogans.filter((x) => x !== n);
      for (const k of [n, g]) if (k) S.dupOff.add(k);
      S.items.forEach((x) => { if ((x.dup && (x.dup.n === n || x.dup.n === g)) || x.known === n) { x.dup = null; x.known = null; } });
    }
    // 提示条上的漏斗：标记为垃圾、以后类似的也清理（0.26；以前叫"记住这句话"）；已经标过的再点就不再按它清理
    async function onRemember(id) {
      const it = item(id);
      if (!it) return;
      const n = R.normSlogan(it.text), known = B.isMarked(it, { slogans: S.slogans, markedIds: S.markedIds }), version = S.sloganVersion;
      const r = await send(known ? { type: "sloganRemove", text: n, id: it.id } : { type: "sloganRemember", entry: { text: it.text, id: it.id, postId: S.key, handle: it.handle } });
      if (r.ok && S.sloganVersion === version) {
        S.dupOff.delete(n);
        if (known) { S.slogans = S.slogans.filter((x) => x !== n); S.markedIds.delete(it.id); }
        else { S.slogans = [...new Set([...S.slogans, n])]; S.markedIds.add(it.id); }
      }
      if (r.ok && known) dropMarked();
      if (r.ok && !known) { B.toast(t("mark.toast")); recheckMarked(); }
      scheduleScan(0);
    }
    // 评论上的漏斗（悬停时出现，0.26）：手动清理掉一条没被清理的，同时记进"你标记的垃圾"；提示里能撤销
    async function onMark(id) {
      const it = item(id);
      if (!it || !await feedback(it, "missed")) return;
      S.markedIds.add(it.id);
      it.decision = decide(it); render(it);
      B.toast(t("mark.toast"), t("mark.undo"), () => undoMark(it.id));
      recheckMarked();
      scheduleScan(0);
    }
    async function undoMark(id) {
      const r = await send({ type: "markUndo", id });
      if (!r.ok) return;
      const it = item(id);
      S.markedIds.delete(id);
      if (it) { it.userLabel = null; it.overrideReady = true; it.decision = decide(it); render(it); }
      dropMarked();
      scheduleScan(0);
    }
    // 你刚标了一条：这一页上已经判过、没清理的回复问一遍"是不是同一类"（后台一个请求问 25 条、缓存里有的不问；平时这一问并在五问的请求里）
    // 这一页记成"标过的页"；样例变了，没过线的、没问过的都重问，已经按它清理的留着
    function recheckMarked() {
      S.markedPage = S.key;
      for (const it of S.items.values()) {
        if (it.scores && !(it.scores.marked >= globalThis.FFSettings.MARKED_THRESHOLD)) {
          if ("marked" in it.scores) { const { marked, ...rest } = it.scores; it.scores = rest; }
          it.markedAsked = false;
        }
      }
      askMarkedSoon();
    }
    // 标过的那一页上，后来才加载出来、或者分是从缓存拿的（缓存里没有这一问）的，攒 0.3 秒一起问（见 content.js 的同名函数）。别的页面不为这一问多发
    let markedTimer = 0;
    function askMarkedSoon() {
      if (S.markedPage !== S.key || markedTimer) return;
      markedTimer = setTimeout(() => {
        markedTimer = 0;
        if (S.markedPage !== S.key) return;
        const list = [...S.items.values()].filter((it) => it.scores && typeof it.scores.marked !== "number" && !it.markedAsked && !it.userLabel && !it.markedLocal &&
          !(it.decision && (it.decision.fold || it.decision.hide)) && it.text.trim());
        if (!list.length) return;
        list.forEach((it) => { it.markedAsked = true; });
        const key = S.key, epoch = S.epoch;
        send({ type: "markedCheck", postId: site.cacheId(S.mode, S.key), post: S.postText, author: S.postAuthor,
          replies: list.slice(0, 200).map((it) => ({ id: it.id, name: it.name, handle: it.handle, text: it.text })) }).then((r) => {
          if (key !== S.key || epoch !== S.epoch || !r.scores) return;
          for (const it of list) if (typeof r.scores[it.id] === "number" && it.scores) it.scores = { ...it.scores, marked: r.scores[it.id] };
          scheduleScan(0);
        });
      }, 300);
    }
    // 撤销了、不再按某条清理了：这一页上按"同一类"算的分作废，也不再为这一页问
    function dropMarked() { S.markedPage = null; for (const it of S.items.values()) if (it.scores && "marked" in it.scores) { const { marked, ...rest } = it.scores; it.scores = rest; } }

    // ---------- 画出来 ----------
    const hide = (e, on) => { const want = on ? "none" : ""; if (e.style.display !== want) e.style.display = want; if (on) e.dataset.ffHidden = "1"; else delete e.dataset.ffHidden; };
    // 「赞」「mark」这类藏的是整条（另记 data-ff-fill = 哪一条，元素被站点拿去显示别的评论时认得出不是这一条的）
    const hideFill = (e, id) => { const want = id ? "none" : ""; if (e.style.display !== want) e.style.display = want; if (id) e.dataset.ffFill = id; else delete e.dataset.ffFill; };
    // 清理得多的页面上能整条藏起来的：帖子页、站点认得出底下有没有回复、这条底下没有回复（藏了回复就没了上文）
    const heavyHidable = (it) => S.heavy && S.mode === "post" && !!site.hasReplies && !!it.decision && it.decision.fold && !site.hasReplies(it);
    const concealed = (it) => heavyHidable(it) && !S.showFill;
    function renderFill(it) {
      const filler = !!(it.decision && it.decision.hide) || concealed(it);
      for (const e of (site.fillerTargets ? site.fillerTargets(it) : [it.el]).filter(Boolean)) {
        if (filler) hideFill(e, S.showFill ? null : it.id);
        else if (e.dataset.ffFill) hideFill(e, null);
      }
      const spot = site.fillerTag ? site.fillerTag(it) : null;
      if (!spot) return;
      const tag = spot.querySelector(":scope > .ff-fill-tag");
      if (filler && S.showFill && it.decision.hide) { if (!tag || tag.dataset.ffId !== it.id) { if (tag) tag.remove(); spot.append(B.fillTag(it.id)); } }
      else if (tag) tag.remove();
    }
    function render(it) {
      if (!it.el.isConnected) return;
      renderFill(it);
      const [first, ...rest] = site.targets(it, S.mode).filter(Boolean);
      if (!first) return;
      // 站点拿同一个元素换着显示别的评论（YouTube 会）：前面那条的折叠条不是这一条的，撤掉
      const stale = first.previousElementSibling;
      if (stale && stale.classList.contains("ff-bar") && stale.dataset.ffId !== it.id) stale.remove();
      let bar = first.previousElementSibling;
      if (!(bar && bar.classList.contains("ff-bar") && bar.dataset.ffId === it.id)) bar = null;
      if (it.decision && it.decision.fold && !concealed(it)) {
        if (!bar) { bar = B.make(it.id, onToggle); if (site.barClass) bar.classList.add(site.barClass); first.parentElement.insertBefore(bar, first); }
        B.fill(bar, it, { slogans: S.slogans, markedIds: S.markedIds, onToggle, onConfirm, onFalsePositive, onRemember });
        for (const e of [first, ...rest]) hide(e, !it.expanded);
      } else {
        if (bar) bar.remove();
        for (const e of [first, ...rest]) if (e.dataset.ffHidden) hide(e, false);
      }
      renderMark(it);
    }
    // 评论上的漏斗（0.26）：帖子页上没清理的评论，作者那一行末尾放一个，鼠标移到这条评论上才看得见（content.css 的 .ff-mark）
    function renderMark(it) {
      const spot = site.markSpot && S.mode === "post" ? site.markSpot(it) : null;
      const want = !!spot && !!it.decision && !it.decision.fold && !it.decision.hide && !it.userLabel && it.overrideReady && !!it.text.trim();
      const old = (spot || it.el).querySelector(`.ff-mark[data-ff-id="${CSS.escape(it.id)}"]`) || (spot && spot.querySelector(":scope > .ff-mark"));
      if (!want) { if (old) old.remove(); return; }
      if (old && old.dataset.ffId === it.id) return;
      if (old) old.remove();
      it.el.dataset.ffMarkHost = "1";
      spot.append(B.markButton(it.id, onMark));
    }
    // ---------- 连着的一串被折的（0.22.1）合成一条 ----------
    // 帖子页上，同一处（整条评论的外层是同一个父元素）连着 B.GROUP_MIN 条以上被折的：一整条一整条藏起来（这几个站点上折的只藏正文，
    // 作者那一行还在，一串下来照样一长溜），第一条前面放合起来的那一条。中间夹着藏起来的「赞」「mark」这类不算断开；
    // 没折的、底下有回复的（藏了回复就没了上文）、换了一处的断开。按第一次见到的顺序（S.order）连，这一轮页面上没有的跳过。
    // 只在认得出"底下有没有回复"的站点上合（给了 hasReplies 的：Reddit、YouTube、小红书）；Hacker News 的评论是一行行平铺的表格，
    // 回复在后面另起一行，而且它只折辱骂、色情，很少连着三条
    const unitOf = (it) => (site.fillerTargets ? site.fillerTargets(it)[0] : it.el) || null;
    const hideGrp = (e, key) => { const want = key ? "none" : ""; if (e.style.display !== want) e.style.display = want; if (key) e.dataset.ffGrp = key; else delete e.dataset.ffGrp; };
    function computeGroups(now) {
      const groups = new Map();
      if (S.heavy && !S.showFill) { S.groups = groups; return; } // 整条藏着，不用合
      let run = [], parent = null;
      const end = () => {
        if (run.length >= B.GROUP_MIN) groups.set(run[0], { ids: run, open: run.some((id) => S.openGroups.has(id) || item(id).expanded) });
        run = []; parent = null;
      };
      if (S.mode === "post" && site.hasReplies) for (const id of S.order) {
        const it = item(id);
        if (!now.has(id) || !it.el.isConnected) continue;
        const d = it.decision;
        if (d && d.hide && !S.showFill) continue;
        const u = d && d.fold ? unitOf(it) : null;
        if (!u || (site.hasReplies && site.hasReplies(it))) { end(); continue; }
        if (parent && u.parentElement !== parent) end();
        parent = u.parentElement;
        run.push(id);
      }
      end();
      S.groups = groups;
    }
    let groupTick = 0;
    function renderGroups() {
      const tick = String(++groupTick), mine = new Map();
      for (const [key, g] of S.groups) {
        const lead = unitOf(item(g.ids[0]));
        if (!lead || !lead.isConnected) continue;
        let gbar = lead.previousElementSibling;
        if (!(gbar && gbar.classList.contains("ff-group") && gbar.dataset.ffGroup === key)) {
          gbar = B.makeGroup(key, onGroupToggle);
          if (site.barClass) gbar.classList.add(site.barClass);
          if (lead.slot) gbar.slot = lead.slot; // Reddit：放进评论里面的要带一样的 slot 才显示
          lead.before(gbar);
        }
        B.fillGroup(gbar, g.ids.map(item), g.open);
        gbar.dataset.ffTick = tick;
        for (const id of g.ids) { const u = unitOf(item(id)); if (u) { mine.set(u, key); hideGrp(u, g.open ? null : key); } }
      }
      document.querySelectorAll(".ff-group").forEach((b) => { if (b.dataset.ffTick !== tick) b.remove(); });
      document.querySelectorAll("[data-ff-grp]").forEach((e) => { if (!mine.has(e)) hideGrp(e, null); });
    }
    function onGroupToggle(key) {
      const g = S.groups.get(key);
      if (!g) return;
      if (g.open) for (const id of g.ids) { S.openGroups.delete(id); const it = item(id); if (it) { it.expanded = false; render(it); } }
      else for (const id of g.ids) S.openGroups.add(id);
      g.open = !g.open;
      renderGroups();
    }

    // 评论区最上面那一行：这一页藏了几条「赞」「mark」这类、点了全部显示 / 再藏起来
    let fillLineEl = null, fillBottomEl = null;
    function onFillToggle() { S.showFill = !S.showFill; for (const id of S.order) { const it = S.items.get(id); if (it && it.decision) render(it); } renderFillLine(); scheduleScan(0); }
    function renderFillLine() {
      let n = 0, shown = 0;
      const counts = { spam: 0, abuse: 0, sexual: 0, filler: 0 };
      for (const it of S.items.values()) {
        if (it.decision && it.decision.hide) { n++; counts.filler++; }
        else if (heavyHidable(it)) { n++; counts[cat(it.decision.kind)]++; }
        if (it.decision && !(it.decision.hide && !S.showFill) && !concealed(it)) shown++;
      }
      const anchor = n && site.fillerAnchor ? site.fillerAnchor() : null;
      // 评论区长（看得见的 ≥ B.FILL_BOTTOM_MIN）时，评论列表下面（上面那一行挂的那个元素后面）再放一行一样的（0.27，用户 10-17：滚到后面就看不到上面那一行）
      // 站点说那一行一直看得见（fillPinned：列表自己在滚，比如 YouTube Shorts 的评论面板）就不放下面那一行
      const end = anchor && shown >= B.FILL_BOTTOM_MIN && !(site.fillPinned && site.fillPinned(anchor)) ? anchor : null;
      if (!end) { if (fillBottomEl) { fillBottomEl.remove(); fillBottomEl = null; } }
      else {
        if (!fillBottomEl) { fillBottomEl = B.makeFillLine(onFillToggle); fillBottomEl.classList.add("ff-fill-bottom"); if (site.barClass) fillBottomEl.classList.add(site.barClass); }
        B.fillLine(fillBottomEl, n, S.showFill, S.heavy ? counts : null);
        if (end.nextElementSibling !== fillBottomEl) end.after(fillBottomEl);
      }
      if (!anchor) { if (fillLineEl) { fillLineEl.remove(); fillLineEl = null; } return; }
      if (!fillLineEl) { fillLineEl = B.makeFillLine(onFillToggle); if (site.barClass) fillLineEl.classList.add(site.barClass); }
      B.fillLine(fillLineEl, n, S.showFill, S.heavy ? counts : null);
      if (fillLineEl.nextElementSibling !== anchor) anchor.before(fillLineEl);
      // 和评论对齐（fillIndent：站点量出来评论往里缩了多少）
      const indent = site.fillIndent ? site.fillIndent(anchor) : 0, ml = indent ? `${indent}px` : "";
      for (const l of [fillLineEl, fillBottomEl]) if (l && l.style.marginInlineStart !== ml) l.style.marginInlineStart = ml;
    }
    function clearUI() {
      document.querySelectorAll(".ff-bar, .ff-fill-line, .ff-fill-tag, .ff-mark").forEach((e) => e.remove());
      fillLineEl = null; fillBottomEl = null;
      document.querySelectorAll("[data-ff-hidden]").forEach((e) => { e.style.display = ""; delete e.dataset.ffHidden; });
      document.querySelectorAll("[data-ff-fill]").forEach((e) => { e.style.display = ""; delete e.dataset.ffFill; });
      document.querySelectorAll("[data-ff-grp]").forEach((e) => { e.style.display = ""; delete e.dataset.ffGrp; });
    }

    // ---------- 主循环 ----------
    function scan() {
      if (!alive()) { observer.disconnect(); return; }
      document.documentElement.classList.toggle("ff-dark", !!(site.dark ? site.dark() : Dm.darkByBg()));
      if (S.loading || !S.settings) return;
      if (!S.enabled) { clearUI(); return; }
      const key = site.pageKey();
      if (key !== S.key) resetFor(key);
      if (!key) return;
      let fresh = 0;
      const now = new Set(); // 这一轮页面上有的（站点换掉、复用了元素的旧的那几条不再画，不然两条抢一个元素）
      for (const x of collect()) {
        now.add(x.id);
        const it = S.items.get(x.id);
        // 内容真变了（站点改了字）：重判，但新分数回来以前照旧按原来的判（先展开再折回去就是一闪）
        if (it) {
          it.el = x.el; it.op = x.op; if ("info" in x) it.info = x.info; // 是不是楼主可能晚一点才知道（YouTube 的页面数据比评论晚到）
          if (it.text !== x.text) { it.text = x.text; it.stale = true; it.jevSkipped = false; }
          const imgs = (x.images || []).join("\n");
          if (imgs !== (it.images || []).join("\n")) { it.images = x.images || []; if (withImg(it)) { it.stale = true; it.jevSkipped = false; } }
          continue;
        }
        S.items.set(x.id, { ...x, seq: S.order.length });
        S.order.push(x.id);
        fresh++;
      }
      if (fresh) stat({ seen: fresh });
      ensureRec();
      loadOverrides();
      markSlogans();
      markLocal();
      if (site.groups && folds.spam) { const g = site.groups([...S.items.values()], S.settings); for (const it of S.items.values()) it.group = it.userLabel ? null : g.get(it.id) || null; }
      for (const id of S.order) {
        const it = S.items.get(id);
        if (!now.has(id)) continue;
        if (deferred(it)) { it.decision = DEFERRED; render(it); continue; } // 超出这一页先判的条数：照常显示，往下滚了再判
        it.started = true;
        if (needJev(it)) { it.queued = true; S.queue.push(it); }
        const before = it.decision && it.decision.fold;
        it.decision = decide(it);
        if (it.decision.fold && !before && !it.counted) {
          it.counted = true;
          stat({ [`fold_${it.decision.kind}`]: 1 });
          // 0.28.5 起不再把清理掉的回复发给后台存"最近清理的 50 条"（没有界面展示，少存）
        }
        if (it.decision.hide && !it.fillCounted) { it.fillCounted = true; stat({ fold_filler: 1 }); }
        render(it);
      }
      computeGroups(now);
      if (!S.heavy && S.mode === "post" && site.hasReplies) { // 清理条（合起来的算一条）超过 HEAVY_UNITS：这一页改成整条藏起来
        const inGroup = new Set([...S.groups.values()].flatMap((g) => g.ids));
        let units = S.groups.size;
        for (const it of S.items.values()) if (it.decision && it.decision.fold && !inGroup.has(it.id)) units++;
        if (units > B.HEAVY_UNITS) { S.heavy = true; for (const id of S.order) { const it = item(id); if (it && it.decision && now.has(id)) render(it); } computeGroups(now); }
      }
      renderGroups();
      renderFillLine();
      flush();
      askMarkedSoon();
    }
    let timer = null;
    function scheduleScan(delay = 200) {
      if (timer) { if (delay === 0) { clearTimeout(timer); timer = null; } else return; }
      timer = setTimeout(() => { timer = null; scan(); }, delay);
    }
    // 插件自己放的东西（折叠条、译文）变了不用重扫
    const ours = (n) => n.nodeType === 1 && Dm.mine(n);
    const observer = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type !== "childList" || ours(m.target) || m.target.closest?.(`.ff-bar, .${Dm.OWN}`) || (site.quiet && m.target.closest?.(site.quiet))) continue;
        // 站点只换了字也算（YouTube 拿同一个元素换着显示别的评论）
        if ([...m.addedNodes, ...m.removedNodes].some((n) => (n.nodeType === 1 && !ours(n)) || n.nodeType === 3)) { scheduleScan(); return; }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    // 站内跳转不一定换掉整块 DOM：网址变了也重扫
    let href = location.href;
    setInterval(() => { if (location.href !== href) { href = location.href; scheduleScan(0); } }, 500);

    // ---------- 设置、纠错、记住的句子在别处改了 ----------
    const NOT_FOLDING = new Set(["translate", "translateFill", "translateThreshold", "translateMargin", "translateModel", "translateFallback"]);
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area && area !== "local") return;
      if (changes.ff_settings || changes.ff_keys || changes.ff_key) { // 换了 key：0.28.12 起看 ff_keys
        const F = globalThis.FFSettings;
        const before = F.forSite(changes.ff_settings?.oldValue, site.name), after = F.forSite(changes.ff_settings?.newValue, site.name);
        const changed = changes.ff_settings ? Object.keys(F.DEFAULTS).filter((k) => k !== "rev" && before[k] !== after[k]) : [];
        if (changes.ff_keys || changes.ff_key || changed.some((k) => !NOT_FOLDING.has(k))) loadSettings();
      }
      if (changes.ff_confirmed_slogans) {
        S.sloganVersion++;
        setMarked(changes.ff_confirmed_slogans.newValue);
        scheduleScan(0);
      }
      for (const [k, change] of Object.entries(changes)) {
        if (!k.startsWith("ff_reply_override:")) continue;
        const it = item(k.slice("ff_reply_override:".length));
        if (!it) continue;
        it.userLabel = change.newValue?.label || null;
        it.overrideReady = true;
        if (it.userLabel === "fp") forgetSlogan(it);
        scheduleScan(0);
      }
    });
    // 弹窗问"这个页面"：页面类型、折了几条、还有几条在判；翻译那边的数从 tx_engine.js 拿（FFTxSummary）
    chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
      if (!msg || msg.type !== "pageSummary" || !alive()) return;
      const key = site.pageKey();
      // key：这一页的记号（弹窗不用；测试和排查用。0.28.5 以前靠发给后台的"最近清理"记录才看得到）
      const out = { kind: S.mode ? site.summaryKind(S.mode) : "other", site: site.name, key: key || null, enabled: S.enabled, tx: globalThis.FFTxSummary ? globalThis.FFTxSummary() : null };
      if (key && key === S.key && (!site.judges || site.judges(S.mode))) {
        const n = { spam: 0, abuse: 0, sexual: 0 };
        let pending = 0, filler = 0;
        for (const it of S.items.values()) { const d = it.decision; if (d && d.fold) n[cat(d.kind)]++; else if (d && d.hide) filler++; else if (!d || d.kind === "pending") pending++; }
        // folded：这一页清理掉的 [id, 类别]（弹窗不用；测试和排查用，问的时候现算、不存）
        const folded = [...S.items.values()].filter((it) => it.decision && it.decision.fold).map((it) => [it.id, it.decision.kind]);
        Object.assign(out, { folds: n, filler, pending, seen: S.items.size, folded });
      }
      reply(out);
    });

    loadSettings();
    return { scheduleScan };
  }
  globalThis.FFFold = Object.freeze({ start });
})();
