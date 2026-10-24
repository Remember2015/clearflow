// 内容脚本：在 X 的帖子详情页扫描回复，本地规则先判，判不了的交给后台调 Jev（后台有本地缓存）；
// 命中的折叠并写明原因，附"展开 / 误判 / 确认"；首屏大半是垃圾回复时在主帖下方加提示条。
// 用户主页（/账号、/账号/with_replies 之类）和搜索结果（/search?q=…、/hashtag/话题）：时间线上的每条帖子都按垃圾 / 辱骂 / 色情交给 Jev 判
// （主页上主人自己的也判，用户定的）；M1、D1、"只贴自己的帖子"是按一条帖子底下的回复设计的，这两种页面上不用；你记住的句子、你的纠错照样生效。
// 你自己的主页不判；你自己发的帖子、回复在哪儿都不折。
// 每折一条告诉后台（弹窗"判对了吗"用）；弹窗问"这个页面"时回这一页折了几条。
// 没折叠的回复，在 X 自己的"…"菜单里加"这是垃圾回复 / 辱骂 / 色情内容，折叠"，用来记漏判。
// 三类分开显示：垃圾回复（机器人、拉人）、辱骂（真人骂人）、色情；"评论区多是机器人"的提示只数垃圾回复。
// 界面文案统一叫"垃圾回复"（和 X 中文版的"垃圾信息"一致），不用"引流"这种行话，也不用"广告"（X 给推广帖打的标签就叫"广告"）。
//
// X 的回复列表是虚拟滚动：离开视口的格子会被卸载、回来时重新挂载成新元素，往下滚远了主帖也会被卸载。
// 所以：①主帖出现过一次后，就认它所在的那块时间线（S.root），之后主帖被卸载也照样扫；②已判过的回复一挂载就同步套上折叠
// （MutationObserver 回调在绘制前执行），不等下一轮扫描，避免先闪出全文再收起、布局来回跳；③扫描用固定节流，DOM 一直在变
// （视频播放）也照样跑。
// 只碰主帖那块时间线里的东西：从首页点进帖子、在首页点开图片（地址变成 /status/…/photo/1）时，页面里还是首页时间线，
// 首页的"原帖 + 关注的人的回复"卡片里也会出现刚判过的回复——0.4.1 以前会把折叠套到首页帖子上，而首页不扫描，展开按钮就失灵了。
(() => {
  const R = globalThis.FFRules;
  // 界面文字跟 X 的界面语言（i18n.js）：理由、标签、按钮
  const { t, errText } = globalThis.FFI18n;
  const REASON = (k) => t(`reason.${k}`);
  const KIND = (k) => t(`kind.${k}`);
  // 折叠的三类和折叠条的画法在 foldbar.js（和 Reddit 共用）
  const B = globalThis.FFBar;
  const { cat, CATS } = B;
  const SPAM_KEYS = ["benefit", "disguised", "promo_mention"]; // "垃圾回复"只看这三问；abuse、sexual 各自单独判
  // 帖子页还多问一个 setup（jev.js 的 EXTRA_QUESTIONS，0.15.3 起）：像骗局的铺垫——编的发财 / 找回 / 落难故事、托儿式的提问作证推荐。
  // X 自己的数据上它一条都没多折、也没少折：中文热帖、它的 10 种语言译文、33 个多语言热帖的 1149 条回复（11 种语言）里没有一条
  // 过门槛。用户 2026-10-14 看了作用和代价（每批多问一句）说留着，等 X 上出现骗局串时用（jev_eval/code/xr_general）
  const EXTRA = ["setup"];
  // 问得宽的两问门槛比阈值高 0.1：setup，和"伪装成普通评论的推广"（disguised）——X 的回复里贴链接、引别人的帖子很平常，
  // 这一问在 0.6–0.7 之间折的在 X 的数据上几乎全是错的（多语言热帖上日文玩笑、葡文记者介绍、法文时评带民调链接，中文热帖上荐书）。
  // 高 0.1 以后折错：多语言热帖 10 → 7、中文热帖 3 → 2、译文 3 → 1；折对的只少了译文里一条（印尼文短链）。
  // "只贴自己的帖子"那种引流有结构规则（selfQuote）兜着，不靠这一问
  const OVER = { setup: 0.1, disguised: 0.1 };
  // 主页、搜索结果里的是一条条帖子，不是别人帖子下面的回复："在 @ 别人做推广""伪装成普通评论的广告"这两问是冲着
  // 回复问的（蹭别人的评论区），拿去问帖子会把"感谢合作者""提到 @SpaceX"当成推广——2026-10-13 用户的记录里，
  // 主页上折的 18 条全是主人自己的帖子、16 条是这一问，没一条真是垃圾。这里只看"引流"那一问（辱骂、色情照旧）
  const POST_SPAM_KEYS = ["benefit"];
  // 时间线上只问用得上的（0.29.14）：引流、辱骂、色情；"伪装""@ 推广"不问（帖子页照旧五问全问）
  const TIMELINE_KEYS = [...POST_SPAM_KEYS, "abuse", "sexual"];
  // 「赞」「mark」这类回复（0.22，设置里的 filler）：帖子页上很短（rules.js 的 fillerShort）、不带图不带链接、没嵌引用卡片的回复多问 Jev 一句
  // （jev.js 的 filler），过了门槛整条藏起来、不放折叠条，主帖下面一行"清理了 N 条… · 查看"。门槛 0.7 按 X 自己的数据定
  // （jev_eval/code/xr_general/short_jev2.mjs，照插件这样 10 条一批问：纯表态藏掉 10/20，有内容的藏错 0/35；0.6 也一样，留一点余地）
  const FILLER_TH = 0.7;
  // 读 X 页面的地方（选择器、网址、结构上的推断）都在 xdom.js
  const X = globalThis.FFX;
  const ART = X.SEL.article;

  const S = {
    settings: null, hasKey: false, enabled: true,
    // postId：这一页的键——帖子页是帖子 id，用户主页是 "u:账号"，搜索结果是 "s:搜的词"（mode 分别是 status / profile / search）；me：你自己的账号
    postId: null, mode: null, owner: "", me: null, opHandle: "", postText: "", postAuthor: null, root: null,
    // rec：帖子页"这个帖子是不是在请大家推荐"（jev.js 的 POST_QUESTIONS）的分；undefined 还没问，null 正在问
    rec: undefined,
    participants: new Set(), items: new Map(), order: [], queue: [], inflight: 0,
    notice: null, jevNotice: null, bannerCounted: false, epoch: 0, settingsLoading: false, settingsError: null,
    slogans: [], markedIds: new Set(), markedPrep: [], markedRev: 0, markedPage: null, sloganVersion: 0, dupOff: new Set(), near: R.nearState(), // 你标记的垃圾：一字不差地认的那几句、标的是哪几条
    showFill: false, // 「赞」「mark」这类（清理得多的页面连被清理的一起）：点了"查看"，这一页的全部显示出来
    heavy: false, // 这一页清理条超过 B.HEAVY_UNITS：被清理的整条藏起来（0.27，见 foldbar.js）
    // 连着的一串被折的（0.22.1）：groups 串的第一条的 id → {ids, open, at（页面上挂着的第一条，合起来的那一条放在它的格子里）}；openGroups 点开过的串里的条目
    groups: new Map(), openGroups: new Set(),
  };

  // ---------- 通信 ----------
  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (r) => {
          // 传话出错（后台刚重启、"message port closed"）可以重试（0.28.10，review：以前没带 retryable，这一批整页都不再问）
          if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message, code: "network", retryable: true });
          else resolve(r || {});
        });
      } catch (e) {
        resolve({ error: String(e) }); // 插件刚重载时旧页面会走到这里
      }
    });
  }
  const stat = (delta) => send({ type: "stat", delta });

  async function loadSettings(version, attempt = 0) {
    try {
      const r = await send({ type: "settings" });
      if (version !== settingsVersion) return;
      if (r.error || !r.settings) throw new Error(r.error || t("cs.noSettings"));
      const sloganVersion = S.sloganVersion;
      const { ff_confirmed_slogans = [] } = await chrome.storage.local.get("ff_confirmed_slogans");
      if (version !== settingsVersion) return;
      const imagesBefore = S.settings ? !!S.settings.images : null;
      S.settings = globalThis.FFSettings.forSite(r.settings, "x"); // X 上实际用的（0.20 起每个网站可以单独改）
      S.hasKey = r.hasKey;
      S.enabled = S.settings.enabled;
      // 看图片开关变了：带图的那几条重问（开了连图一起问、关了只问字）
      if (imagesBefore !== null && imagesBefore !== !!S.settings.images) S.items.forEach((it) => { if (it.images && it.images.length) { it.scores = null; it.jevSkipped = false; } });
      if (sloganVersion === S.sloganVersion) setMarked(ff_confirmed_slogans);
      S.settingsLoading = false;
      S.settingsError = null;
      if (S.recRetry) { S.rec = undefined; S.recRetry = false; }
      S.items.forEach((it) => { it.decision = null; });
    } catch (e) {
      if (version !== settingsVersion) return;
      S.settingsError = t("cs.settingsFail");
      if (attempt < 2) setTimeout(() => {
        if (version === settingsVersion && alive()) loadSettings(version, attempt + 1);
      }, (attempt + 1) * 1000);
    }
    scheduleScan(0);
  }
  function refreshSettings() {
    const version = ++settingsVersion;
    S.settingsLoading = true;
    S.settingsError = null;
    resetRequests();
    clearUI();
    loadSettings(version);
  }
  function resetRequests() {
    S.epoch++;
    S.queue = [];
    S.jevNotice = null;
    for (const it of S.items.values()) { it.queued = false; it.jevSkipped = false; it.attempts = 0; }
  }
  function retryFailed() {
    for (const it of S.items.values()) {
      it.jevSkipped = false; it.attempts = 0;
      if (!it.overrideReady) { it.overrideLoading = false; it.overrideFails = 0; it.overrideRetryAt = 0; }
    }
    S.notice = null; S.jevNotice = null;
    scheduleScan(0);
  }
  // 读不到纠错记录时这些回复先不判（人工纠错优先于自动规则）；自动重试两次，还不行再提示、等你点"重试"
  const OVERRIDE_FAIL = t("cs.overrideFail");
  const OVERRIDE_RETRY_MS = [1500, 3000];
  function loadOverrides() {
    const now = Date.now();
    const batch = [...S.items.values()].filter((it) => !it.overrideReady && !it.overrideLoading && (it.overrideRetryAt || 0) <= now);
    if (!batch.length) return;
    const items = S.items;
    const versions = new Map(batch.map((it) => [it.id, it.overrideVersion || 0]));
    batch.forEach((it) => { it.overrideLoading = true; });
    send({ type: "replyOverrides", ids: batch.map((it) => it.id) }).then((r) => {
      if (items !== S.items) return;
      if (r.error || !r.overrides) {
        let wait = 0;
        for (const it of batch) {
          it.overrideLoading = false;
          const n = it.overrideFails = (it.overrideFails || 0) + 1;
          if (n <= OVERRIDE_RETRY_MS.length) { it.overrideRetryAt = Date.now() + OVERRIDE_RETRY_MS[n - 1]; wait = Math.max(wait, OVERRIDE_RETRY_MS[n - 1]); }
          else it.overrideRetryAt = Infinity;
        }
        if (wait) setTimeout(() => { if (items === S.items) scheduleScan(0); }, wait + 50);
        if (batch.some((it) => it.overrideRetryAt === Infinity)) S.notice = OVERRIDE_FAIL;
      } else {
        for (const it of batch) {
          if ((it.overrideVersion || 0) === versions.get(it.id)) it.userLabel = r.overrides[it.id] || null;
          it.overrideReady = true;
          it.overrideFails = 0;
        }
        if (S.notice === OVERRIDE_FAIL && ![...S.items.values()].some((it) => !it.overrideReady && it.overrideRetryAt === Infinity)) S.notice = null;
      }
      scheduleScan(0);
    });
  }

  // ---------- 解析页面 ----------
  // 只认帖子详情页 /用户/status/数字。/photo/N、/video/N 是盖在当前页面上的图片/视频层，底下可能是首页时间线：
  // 这时什么都不动（media）。/quotes、/retweets 之类的子页不是回复列表，算离开了帖子。
  const route = () => X.route();
  // 这一页的键：帖子页是帖子 id，别人的用户主页是 "u:账号"（你自己的主页不判），搜索结果是 "s:搜的词"（换了词就是新的一页）；
  // 图片 / 视频层、别的页面是 null
  function pageKey(r = route()) {
    if (r.media) return null;
    if (r.kind === "status") return r.pid;
    if (r.kind === "profile" && r.user !== X.selfHandle()) return "u:" + r.user;
    if (r.kind === "search" && r.query) return "s:" + encodeURIComponent(r.query.toLowerCase()).slice(0, 80);
    return null;
  }
  // 用户主页、搜索结果：一整条时间线上的帖子都判，没有主帖和楼主
  const timeline = () => S.mode === "profile" || S.mode === "search";
  // 你自己发的（左边栏"个人资料"认出来的账号）：哪儿都不折，也不发给 Jev
  const isSelf = (it) => !!S.me && !!it.handle && it.handle.slice(1).toLowerCase() === S.me;
  // 主帖所在的那块时间线：先认主帖，主帖被卸载了再认已经判过的回复；都不在就是还没加载出来（或者根本不在帖子页）。
  // 用户主页：时间线里的第一条帖子所在的那块（换"帖子 / 回复"标签时 X 换掉整块，旧的断开了就重认）
  function findRoot() {
    if (S.root && S.root.isConnected) return S.root;
    S.root = null;
    for (const a of X.column().querySelectorAll(ART)) {
      if (X.inLayers(a)) continue;
      const id = articleId(a);
      if (id && (timeline() || id === S.postId || S.items.has(id))) {
        S.root = X.timelineOf(a);
        break;
      }
    }
    return S.root;
  }
  const inRoot = (a) => !!(S.root && S.root.isConnected && S.root.contains(a));
  const articleId = X.statusId;
  const parsed = new WeakMap(); // 元素 → 解析结果；同一个元素只用 innerText 解析一次（innerText 会触发布局）
  function parseArticle(a) {
    const link = X.statusLink(a);
    const href = link ? link.getAttribute("href") : "";
    const hit = parsed.get(a);
    if (hit && hit.href === href) return hit.info;
    const m = href.match(/\/status\/(\d+)/);
    const who = X.author(a);
    // 账号以作者那一栏里指向 /账号 的链接为准（0.28.9，review：以前取那一栏里第一行 @ 开头的字——昵称本身以 @ 开头的（"@elonmusk"）
    // 就被当成了账号，冒充楼主的机器人算成楼主：M1 不管它、Jev 还被告诉"这是作者自己"）。和链接对得上就留原来的大小写（缓存指纹不变）
    const aid = X.authorId(a);
    if (aid && who.handle.toLowerCase() !== "@" + aid) who.handle = "@" + aid;
    // textEl 是第一段正文：回复没写字、只嵌了引用卡片时，其实是被引用帖子的正文。回复自己的话是卡片外面那段（ownText）
    const textEl = X.textEl(a), own = X.ownTextEl(a), time = X.postTime(a);
    const info = {
      id: m ? m[1] : null,
      time: time ? Date.parse(time) : null,
      name: who.name,
      handle: who.handle,
      text: textEl ? textEl.innerText : "",
      ownText: own ? own.innerText : "",
      quoteHandle: X.quoteHandle(a),
      // X 自动翻译了（页面上是 Grok 的译文）：判的时候换成原文（见 useOriginal）；hasOwn：这条有自己的话（不是只嵌了一张引用卡片）
      translated: X.translationState(a) === "auto",
      hasOwn: !!own,
      media: X.hasMedia(a), // 带图片 / 视频（M1 不管这种，见 rules.js）
      promoted: X.isAd(a), // 广告：整条帖子包在 placementTracking 里；认字的那条留着兜底
    };
    parsed.set(a, { href, info });
    return info;
  }

  // ---------- 判原文，不判 X 的译文（0.13.10）----------
  // X 自动翻译以后页面上的正文是 Grok 的中文（或你界面语言的）译文，以前就拿它去判垃圾、辱骂、色情——判的不是作者写的话，
  // 同一条帖子在不同界面语言下判的也不一样。pagedata.js 旁听着 X 自己的接口，记着每条帖子的原文：问它要（和 translate.js 一样的
  // ff-tx-ask / ff-tx-data），0.8 秒问不到（数据还没到、X 改了接口）就照页面上的判。问到之前这条先不判（不发 Jev、也不按本地规则折）
  const ORIG_MAX = 4000;
  const pageWaiters = new Map();
  document.addEventListener("ff-tx-data", (e) => {
    let d = null;
    try { d = JSON.parse(e.detail); } catch (err) { return; }
    const w = d && typeof d.id === "string" && pageWaiters.get(d.id);
    if (w) { pageWaiters.delete(d.id); w(d); }
  });
  function askOriginal(id) {
    return new Promise((resolve) => {
      pageWaiters.get(id)?.(null);
      pageWaiters.set(id, resolve);
      document.dispatchEvent(new CustomEvent("ff-tx-ask", { detail: id }));
      setTimeout(() => { if (pageWaiters.get(id) === resolve) { pageWaiters.delete(id); resolve(null); } }, 800);
    });
  }
  const originalOf = (d) => (d && !d.missing && typeof d.source === "string" && d.source.trim() ? d.source.trim().slice(0, ORIG_MAX) : null);
  function useOriginal(it) {
    if (!it.translated || it.origState) return;
    it.origState = "asking";
    const epoch = S.epoch;
    askOriginal(it.id).then((d) => {
      if (epoch !== S.epoch) return;
      const orig = it.hasOwn && originalOf(d);
      if (orig) { it.text = it.ownText = orig; it.fromOriginal = true; }
      it.origState = "done";
      scheduleScan(0);
    });
  }

  // 返回 {focal, replies}：只看主帖那块时间线（findRoot）。主帖在 DOM 里时取它后面的；主帖已被虚拟列表卸载（往下滚远了）时，
  // 剩下的都是回复。都截到"发现更多"之前。
  function collect() {
    const root = findRoot();
    if (!root) return { focal: null, replies: [] };
    if (timeline()) { // 用户主页、搜索结果：时间线上的帖子都算（"推荐关注""相关用户"之类的格子没有帖子，跳过；广告不算）
      const replies = [];
      for (const cell of X.cells(root)) {
        const a = cell.querySelector(ART);
        if (!a) continue;
        const info = parseArticle(a);
        if (info.id && !info.promoted) replies.push({ article: a, info });
      }
      return { focal: null, replies };
    }
    const entries = [];
    for (const cell of X.cells(root)) {
      const a = cell.querySelector(ART);
      if (!a) {
        // "发现更多"之类的分段：认字（中英文）也认结构（不带帖子、有标题的格子），X 是别的语言界面时靠后者
        if (X.isSectionHeader(cell)) entries.push(null);
        continue;
      }
      entries.push({ article: a, info: parseArticle(a) });
    }
    let start = entries.findIndex((e) => e && e.info.id === S.postId);
    const focal = start >= 0 ? entries[start] : null;
    start = start >= 0 ? start + 1 : 0;
    const replies = [];
    for (let i = start; i < entries.length; i++) {
      const e = entries[i];
      if (!e) break;
      if (!e.info.id || e.info.id === S.postId || e.info.promoted) continue;
      replies.push(e);
    }
    return { focal, replies };
  }

  // ---------- 判定 ----------
  // 楼主自己的回复：0.21.2 起照样判（用户：作者的回复也可能是引流、垃圾、色情——推黄片站、推 VPN 机场、"点个关注"、
  // 拉进 Telegram 频道）。以前一律不折：楼主在自己帖子下面说话谈不上借流量，Jev 会把"现在比某某便宜"这类话当成拉人（0.67）。
  // X 两份标注集里楼主回复 134 条，现在的门槛会清理 33 条：推广链接、黄片站、"Join my channel"、自我推广、骂人的，
  // 和一个抽奖帖里给每个人回的同一句"谢谢关注，私信你了"（19 条）；像误伤的 1 条（回答哪里能下载软件）。
  // 只有讲"借别人的评论区引流"的三条不管楼主：M1、"@ 外人降门槛"、只贴自己另一条帖子——楼主在自己帖子里 @ 别人聊、
  // 贴自己上一条帖子接着讲是常事（数据里楼主唯一一条 M1 命中是误伤）。内容交给 Jev 判，推广链接这类本地规则照样管。
  // 0.28.11 起楼主的回复多问一句"是不是在接着讲自己这个帖子"（op_topic），是的话垃圾三问不清理（"哪里能下载"那条就是这样放回来的）
  const isOp = (it) => !!S.opHandle && !!it.handle && it.handle.toLowerCase() === S.opHandle.toLowerCase();
  // 看图片（0.18，设置里默认关）开着、这条带图：只有图没写字的也判，短文本豁免也不用
  const withImg = (it) => !!(S.settings && S.settings.images && it.images && it.images.length);
  // 只贴了自己的另一条帖子：引用卡片是回复者本人的帖子，自己的话去掉表情、标点后不超过 M1 的字数上限——在别人的评论区给自己的帖子引流
  const selfQuote = (it) => !!it.quoteHandle && !!it.handle && it.quoteHandle.toLowerCase() === it.handle.toLowerCase() &&
    R.coreUnits(it.ownText || "") <= S.settings.m1MaxLen;
  const fillerAsk = (it) => S.mode === "status" && !!S.settings && S.settings.filler !== false && !it.userLabel && !isSelf(it) &&
    it.hasOwn && !it.quoteHandle && !it.media && !(it.images && it.images.length) && R.fillerShort(it.text);
  const fillerHide = (it) => fillerAsk(it) && !!it.scores && typeof it.scores.filler === "number" && it.scores.filler >= FILLER_TH;
  // 帖子作者自己的回复多问一句"是不是在接着讲自己这个帖子"（0.28.11，jev.js 的 op_topic）：是的话垃圾三问不清理它
  const opAsk = (it) => S.mode === "status" && !it.userLabel && !isSelf(it) && isOp(it);
  const onTopic = (it) => opAsk(it) && !!it.scores && typeof it.scores.op_topic === "number" && it.scores.op_topic >= globalThis.FFSettings.OP_TOPIC_THRESHOLD;
  // 主页、搜索结果上的帖子多问一句"是不是作者在分享自己做的东西"（0.29.13，jev.js 的 own_work）：是的话"引流"那一问不清理它
  // （用户 10-24：作者推自己做的免费工具"看起来不算拉人吧，而且是自己给自己"）。主人推"加我微信领资料"这种照样清理（以前用户定的）
  const ownAsk = (it) => timeline() && !it.userLabel && !isSelf(it);
  const ownWork = (it) => ownAsk(it) && !!it.scores && typeof it.scores.own_work === "number" && it.scores.own_work >= globalThis.FFSettings.OWN_WORK_THRESHOLD;
  const asks = (it) => [...(fillerAsk(it) ? ["filler"] : []), ...(opAsk(it) ? ["op_topic"] : []), ...(ownAsk(it) ? ["own_work"] : [])];
  function decide(it) {
    if (!it.overrideReady) return { fold: false, kind: "pending" };
    if (it.userLabel === "missed") return { fold: true, kind: "user", reason: KIND("user") };
    if (it.userLabel === "missed_abuse") return { fold: true, kind: "user_abuse", reason: KIND("user_abuse") };
    if (it.userLabel === "missed_sexual") return { fold: true, kind: "user_sexual", reason: KIND("user_sexual") };
    if (it.userLabel === "fp") return { fold: false, kind: "user_fp" };
    if (isSelf(it)) return { fold: false, kind: "self" };
    if (it.translated && it.origState !== "done") return { fold: false, kind: "pending" }; // 等原文（最多 0.8 秒），别按译文先折
    const st = S.settings;
    if (!timeline()) { // 帖子页才有按回复设计的本地规则（见文件开头）；楼主的回复不用 M1
      const lv = R.localVerdict(it.text, S.participants, { m1: st.m1 && !isOp(it), m1MaxLen: st.m1MaxLen, media: it.media });
      if (lv) return { fold: true, kind: lv.kind, reason: lv.detail ? t("reason.withDetail", { reason: KIND(lv.kind), detail: lv.detail }) : KIND(lv.kind) };
      if (selfQuote(it) && !isOp(it)) return { fold: true, kind: "selfquote", reason: KIND("selfquote") };
      if (st.dup !== false && it.dup) return { fold: true, kind: "dup", reason: t("reason.dup", { n: it.dup.count }) };
    }
    if (st.dup !== false && it.known) return { fold: true, kind: "slogan", reason: KIND("slogan") };
    if (it.markedLocal) return markedDecision(it.markedLocal);
    if (S.settings.useJev && S.hasKey && it.scores) {
      // 求推荐帖（帖子页先问 Jev 一句，见 ensureRec）：回复里报产品、服务的名字是在回答，门槛提到 recThreshold。
      // 那一问还没回来就先等着，不按普通阈值先折、回来再展开（一般它比回复的分先到）
      if (S.mode === "status" && S.postText && S.rec == null) return { fold: false, kind: "pending" };
      const th = S.mode === "status" && S.rec >= 0.5 ? st.recThreshold : st.threshold;
      // @ 了帖子外的号、不超过 20 个字（0.21.1，见 rules.js 的 mentionNudge）：引流、推广两问的门槛降 0.1；跟 M1 一个开关
      const nudge = !timeline() && st.m1 !== false && !isOp(it) ? R.mentionNudge(it.text, S.participants, it.media) : 0;
      // 每一问各有门槛（setup、disguised 高 OVER），过了门槛的里面挑超出最多的那一问写理由
      let best = null;
      for (const k of timeline() ? POST_SPAM_KEYS : [...SPAM_KEYS, ...EXTRA]) {
        const v = it.scores[k];
        if (typeof v !== "number") continue;
        const need = th + (OVER[k] || 0) - (k === "benefit" || k === "promo_mention" ? nudge : 0);
        if (v >= need && (!best || v - need > best.over)) best = { k, v, over: v - need };
      }
      // 垃圾回复、辱骂、色情可能同时过线，按分最高的那一类标：点名开撕的"绞杀评论区海狗@某人"拉人分 0.55 上下、辱骂 0.9，
      // 该标辱骂。辱骂、色情不用短文本豁免（"SB" 就两个字母）
      const cands = [];
      if (best && (withImg(it) || !R.shortExempt(it.text)) && !onTopic(it) && !ownWork(it)) cands.push({ kind: "jev", score: best.v, reason: `${REASON(best.k)} ${best.v.toFixed(2)}` });
      // 和你标记过的垃圾是同一类（0.26，Jev 的 marked 那一问）：你自己标的，不用短文本豁免
      const mk = it.scores.marked;
      if (typeof mk === "number" && mk >= globalThis.FFSettings.MARKED_THRESHOLD) cands.push({ kind: "marked", score: mk, reason: KIND("marked") });
      for (const [k, on, kth] of [["abuse", st.abuse, st.abuseThreshold], ["sexual", st.sexual, st.sexualThreshold]]) {
        const v = it.scores[k];
        if (on !== false && typeof v === "number" && v >= kth) cands.push({ kind: k, score: v, reason: `${KIND(k)} ${v.toFixed(2)}` });
      }
      if (cands.length) {
        const c = cands.sort((a, b) => b.score - a.score)[0];
        return { fold: true, kind: c.kind, reason: c.reason, scores: it.scores };
      }
      if (fillerHide(it)) return { fold: false, hide: true, kind: "filler", scores: it.scores };
      return { fold: false, kind: "jev_ok", scores: it.scores };
    }
    return { fold: false, kind: it.jevSkipped ? "skipped" : "pending" };
  }

  function needJev(it) {
    // 已经有分、但这条该多问的 filler 没问过（刚打开这个开关）：重问一次
    const missing = !it.scores || (fillerAsk(it) && typeof it.scores.filler !== "number") || (opAsk(it) && typeof it.scores.op_topic !== "number") ||
      (ownAsk(it) && typeof it.scores.own_work !== "number");
    if (!(S.enabled && !S.settingsLoading && it.overrideReady && !it.userLabel && S.settings.useJev && S.hasKey && missing && !it.queued && !it.jevSkipped && (it.text.trim() || withImg(it)))) return false;
    if (it.translated && it.origState !== "done") return false; // 原文还没拿到
    if (isSelf(it) || (S.settings.dup && it.known) || it.markedLocal) return false;
    if (timeline()) return true;
    return !(S.settings.dup && it.dup) && !(selfQuote(it) && !isOp(it)) &&
      !R.localVerdict(it.text, S.participants, { m1: S.settings.m1 && !isOp(it), m1MaxLen: S.settings.m1MaxLen, media: it.media });
  }

  async function flush() {
    while (S.enabled && !S.settingsLoading && S.settings.useJev && S.hasKey && S.queue.length && S.inflight < 2) {
      const batch = S.queue.splice(0, 10);
      const postId = S.postId;
      const epoch = S.epoch;
      S.inflight++;
      // 缓存按"这一页"分：搜索结果不分搜的词（同一条帖子换个词搜到，用同一份结果）
      const cacheId = S.mode === "search" ? "s:search" : postId;
      send({ type: "jev", postId: cacheId, post: S.postText, author: S.postAuthor,
        replies: batch.map((it) => ({ id: it.id, name: it.name, handle: it.handle, text: it.text, ...(withImg(it) ? { images: it.images } : {}), ...(asks(it).length ? { ask: asks(it) } : {}) })),
        ...(S.mode === "status" ? { extra: EXTRA } : {}), ...(timeline() ? { keys: TIMELINE_KEYS } : {}) })
        .then((r) => {
          if (postId !== S.postId || epoch !== S.epoch) return;
          if (r.error === "badkey" || r.code === "badkey") S.jevNotice = t("cs.badkey");
          else if (r.code === "or_badkey") S.jevNotice = t("cs.orBadkey"); // 0.29.11 起判断默认走 OpenRouter：说的是 OpenRouter 的密钥
          else if (r.error) S.jevNotice = t("cs.partial", { error: errText(r).slice(0, 80) });
          for (const it of batch) {
            it.queued = false;
            if (r.scores && r.scores[it.id]) it.scores = r.scores[it.id];
            else {
              it.jevSkipped = true;
              if (r.retryable && (it.attempts || 0) < 1) {
                it.attempts = (it.attempts || 0) + 1;
                setTimeout(() => {
                  if (epoch !== S.epoch || item(it.id) !== it) return;
                  it.jevSkipped = false;
                  scheduleScan(0);
                }, 5000);
              }
            }
          }
          if (!r.error && ![...S.items.values()].some((it) => it.jevSkipped)) S.jevNotice = null;
          scheduleScan(0);
        })
        .finally(() => { S.inflight--; if (S.queue.length) flush(); });
    }
  }

  // 帖子页问一句"这个帖子是不是在请大家推荐"（rec）。以前靠只认中文的正则，换种语言就认不出（见 jev.js 的 POST_QUESTIONS）。
  // 只看帖子是哪一条：设置变了、请求重来都不影响这个答案；问不到（没 key、出错）就按普通帖子判
  function ensureRec() {
    if (S.mode !== "status" || S.rec !== undefined || !S.postText || S.postOrigPending || !S.settings.useJev || !S.hasKey) return;
    S.rec = null;
    const postId = S.postId;
    send({ type: "jevPost", postId, post: S.postText, author: S.postAuthor }).then((r) => {
      if (postId !== S.postId) return;
      const got = r.scores && typeof r.scores.rec === "number";
      S.rec = got ? r.scores.rec : 0;
      S.recRetry = !got; // 没问到的，设置或 key 变了再问一次
      scheduleScan(0);
    });
  }

  // ---------- 渲染 ----------
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(label, onClick) {
    const b = el("button", "ff-btn", label);
    b.type = "button";
    b.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); onClick(); }, true);
    return b;
  }
  // 按钮点下去时按 id 取当前的条目，不用建 bar 时的闭包：换帖、重扫之后旧闭包指向的是过期对象
  const item = (id) => S.items.get(id);

  async function feedback(it, label) {
    if (it.saving) return false;
    it.saving = true;
    const version = it.overrideVersion || 0;
    const d = it.decision || {};
    const r = await send({ type: "feedback", entry: { label, postId: S.postId, id: it.id, handle: it.handle, name: it.name,
      text: it.text, kind: d.kind, reason: d.reason || "", scores: it.scores || null } });
    it.saving = false;
    if (!r.ok) {
      S.notice = t("cs.fbFail");
      scheduleScan(0);
      return false;
    }
    // storage 事件可能已送来另一标签页更新的决定，较旧的回执不能把它覆盖。
    if ((it.overrideVersion || 0) === version) {
      it.userLabel = r.label || (label === "confirm" ? CATS[cat(d.kind)].label : label);
      it.overrideVersion = version + 1;
    }
    it.overrideReady = true;
    S.notice = r.warning ? t("cs.fbStatFail") : null;
    return true;
  }
  function onToggle(id) {
    const it = item(id);
    if (!it) return;
    it.expanded = !it.expanded;
    rerender(id);
  }
  async function onFalsePositive(id) {
    const it = item(id);
    if (!it) return;
    if (!await feedback(it, "fp")) return;
    if (it.userLabel === "fp") forgetSlogan(it);
    it.decision = decide(it);
    rerender(id);
    scheduleScan(0);
  }
  async function onConfirm(id) {
    const it = item(id);
    if (!it) return;
    if (!await feedback(it, "confirm")) return;
    it.expanded = false;
    it.decision = decide(it);
    rerender(id);
  }
  // "…"菜单里的"清理掉这条"：0.26 起同时记进"你标记的垃圾"（后台存），提示里能撤销；这一页上别的回复马上问一遍是不是同一类
  async function onMissed(id) {
    const it = item(id);
    if (!it || !await feedback(it, "missed")) return;
    S.markedIds.add(it.id);
    it.decision = decide(it);
    rerender(id);
    B.toast(t("mark.toast"), t("mark.undo"), () => undoMark(id));
    recheckMarked();
    scheduleScan(0);
  }
  async function undoMark(id) {
    const r = await send({ type: "markUndo", id });
    if (!r.ok) return;
    const it = item(id);
    S.markedIds.delete(id);
    if (it) { it.userLabel = null; it.overrideReady = true; it.overrideVersion = (it.overrideVersion || 0) + 1; it.decision = decide(it); rerender(id); }
    dropMarked();
    scheduleScan(0);
  }
  // 提示条上的漏斗：标记为垃圾、以后类似的也清理（0.26；以前叫"记住这句话"）；已经标过的再点就不再按它清理
  async function onRemember(id) {
    const it = item(id);
    if (!it) return;
    const n = R.normSlogan(it.text);
    const known = B.isMarked(it, { slogans: S.slogans, markedIds: S.markedIds });
    const version = S.sloganVersion;
    const r = await send(known ? { type: "sloganRemove", text: n, id: it.id } : {
      type: "sloganRemember", entry: { text: it.text, id: it.id, postId: S.postId, handle: it.handle },
    });
    if (!r.ok) S.notice = t("cs.rememberFail");
    else {
      if (S.sloganVersion === version) {
        S.dupOff.delete(n);
        if (known) { S.slogans = S.slogans.filter((x) => x !== n); S.markedIds.delete(it.id); }
        else { S.slogans = [...new Set([...S.slogans, n])]; S.markedIds.add(it.id); }
      }
      if (known) dropMarked();
      S.notice = null;
      if (!known) { B.toast(t("mark.toast")); recheckMarked(); }
    }
    scheduleScan(0);
  }
  function setMarked(list) {
    S.slogans = (list || []).map((x) => x.text);
    S.markedIds = new Set((list || []).map((x) => x.source && x.source.id).filter(Boolean));
    S.markedPrep = R.markedPrep(list || []);
    S.markedRev++;
  }
  // 和你标记过的先在本地比（0.27，rules.js 的 markedMatch：一字不差、同一个链接、近乎一样的模板），认出来的不问 Jev
  function markLocal() {
    for (const it of S.items.values()) {
      if (it.userLabel || isSelf(it)) { it.markedLocal = null; it.mlKey = null; continue; }
      const k = `${S.markedRev}|${it.text}`;
      if (it.mlKey === k) continue;
      it.mlKey = k;
      it.markedLocal = R.markedMatch(it.text, S.markedPrep);
    }
  }
  // 你刚标了一条：这一页记成"标过的页"，页上判过、没清理的回复问一遍"是不是同一类"；样例变了，没过线的、没问过的都重问，已经按它清理的留着
  function recheckMarked() {
    S.markedPage = S.postId;
    for (const it of S.items.values()) {
      if (it.scores && !(it.scores.marked >= globalThis.FFSettings.MARKED_THRESHOLD)) {
        if ("marked" in it.scores) { const { marked, ...rest } = it.scores; it.scores = rest; }
        it.markedAsked = false;
      }
    }
    askMarkedSoon();
  }
  // 标过的那一页上，后来才加载出来、或者分是从缓存拿的（缓存里没有这一问）的回复，攒 0.3 秒一起问（markedCheck，后台一个请求 25 条）。
  // 用户 10-17：标了一条，下面一模一样的没清理——它是标了以后才加载出来的、分从缓存拿，以前只问标的那一刻页上有的。别的页面照旧不为这一问多发
  let markedTimer = 0;
  function askMarkedSoon() {
    if (S.markedPage !== S.postId || markedTimer) return;
    markedTimer = setTimeout(() => {
      markedTimer = 0;
      if (S.markedPage !== S.postId) return;
      const list = [...S.items.values()].filter((it) => it.scores && typeof it.scores.marked !== "number" && !it.markedAsked && !it.userLabel && !isSelf(it) &&
        !it.markedLocal && !(it.decision && (it.decision.fold || it.decision.hide)) && it.text.trim());
      if (!list.length) return;
      list.forEach((it) => { it.markedAsked = true; });
      const postId = S.postId, epoch = S.epoch;
      send({ type: "markedCheck", postId: S.mode === "search" ? "s:search" : postId, post: S.postText, author: S.postAuthor,
        replies: list.slice(0, 200).map((it) => ({ id: it.id, name: it.name, handle: it.handle, text: it.text })) }).then((r) => {
        if (postId !== S.postId || epoch !== S.epoch || !r.scores) return;
        for (const it of list) if (typeof r.scores[it.id] === "number" && it.scores) { it.scores = { ...it.scores, marked: r.scores[it.id] }; it.decision = null; }
        scheduleScan(0);
      });
    }, 300);
  }
  // 撤销了、不再按某条清理了：这一页上按"同一类"算的分作废，也不再为这一页问（不为这个再发请求）
  function dropMarked() {
    S.markedPage = null;
    S.items.forEach((it) => { if (it.scores && "marked" in it.scores) { const { marked, ...rest } = it.scores; it.scores = rest; it.decision = null; } });
  }
  // 本地认出来的写哪种理由：一字不差和以前"记住的句子"一样；同一个链接带上那个链接
  function markedDecision(m) {
    if (m.kind === "same") return { fold: true, kind: "slogan", reason: KIND("slogan") };
    const kind = `marked_${m.kind}`;
    return { fold: true, kind, reason: m.detail ? t("reason.withDetail", { reason: KIND(kind), detail: m.detail }) : KIND(kind) };
  }
  // 立刻重画页面上这条回复（可能不止一处），不等节流的下一轮扫描
  function rerender(id) {
    const it = item(id);
    if (!it || !it.decision) return;
    for (const a of document.querySelectorAll(ART)) if (inRoot(a) && articleId(a) === id) renderItem(a, it);
  }

  // 「赞」「mark」这类显示出来时，作者那一栏后面的小标签
  function renderTag(article, it, on) {
    const spot = article.querySelector(X.SEL.userName);
    if (!spot) return;
    const tag = spot.querySelector(":scope > .ff-fill-tag");
    if (on) { if (!tag || tag.dataset.ffId !== it.id) { if (tag) tag.remove(); spot.append(B.fillTag(it.id)); } }
    else if (tag) tag.remove();
  }
  function renderItem(article, it) {
    renderItemInner(article, it);
    syncCell(article);
  }
  // 回复整条藏起来（「赞」「mark」这类、合起来的串里的、清理得多的页面上的）时，连它那一格（cellInnerDiv）一起藏：
  // 格子自己带着 1 像素的下边框，只藏回复的话，十几格的边框叠成一条灰条（用户 10-17 截图）。格子里还挂着要显示的清理条就不藏。
  // X 会拿同一个格子显示别的回复，所以每次都按现在的样子重算
  function syncCell(article) {
    const cell = article.closest('[data-testid="cellInnerDiv"]');
    if (!cell) return;
    const own = article.parentElement;
    const hide = article.style.display === "none" && ![...own.children].some((e) => (e.classList.contains("ff-bar") || e.classList.contains("ff-group") || e.classList.contains("ff-fill-line")) && e.style.display !== "none");
    if (hide) { if (cell.style.display !== "none") cell.style.display = "none"; cell.dataset.ffCell = "1"; }
    else if (cell.dataset.ffCell) { cell.style.display = ""; delete cell.dataset.ffCell; }
  }
  function renderItemInner(article, it) {
    const d = it.decision;
    let bar = article.previousElementSibling;
    if (!(bar && bar.classList.contains("ff-bar") && bar.dataset.ffId === it.id)) bar = null;
    renderTag(article, it, !!d.hide && S.showFill);
    // 合起来的那一条：放在这一串挂着的第一条前面；别的格子里留下的撤掉
    const g = d.fold && it.group ? S.groups.get(it.group) : null;
    let gbar = article.parentElement.querySelector(":scope > .ff-group");
    if (gbar && !(g && g.at === it.id && gbar.dataset.ffGroup === it.group)) { gbar.remove(); gbar = null; }
    if (g && g.at === it.id) {
      if (!gbar) gbar = B.makeGroup(it.group, onGroupToggle);
      B.fillGroup(gbar, g.ids.map(item).filter((x) => x && x.decision && x.decision.fold), g.open);
      const before = bar || article;
      if (gbar.nextElementSibling !== before) article.parentElement.insertBefore(gbar, before);
    }
    if (g && !g.open) { // 合着：这一条自己的折叠条也藏起来
      if (bar) bar.style.display = "none";
      if (article.style.display !== "none") article.style.display = "none";
      return;
    }
    if (bar && bar.style.display === "none") bar.style.display = "";
    if (d.hide || (heavyHidable(it) && !S.showFill)) { // 整条藏起来，不放折叠条（「赞」「mark」这类；清理得多的页面上被清理的也是）
      if (bar) bar.remove();
      const want = S.showFill ? "" : "none";
      if (article.style.display !== want) article.style.display = want;
      if (S.showFill) delete article.dataset.ffFill; else article.dataset.ffFill = it.id;
      return;
    }
    if (article.dataset.ffFill) delete article.dataset.ffFill;
    if (d.fold) {
      if (!bar) {
        bar = B.make(it.id, onToggle);
        article.parentElement.insertBefore(bar, article);
      }
      B.fill(bar, it, { slogans: S.slogans, markedIds: S.markedIds, onToggle, onConfirm, onFalsePositive, onRemember });
      const want = it.expanded ? "" : "none";
      if (article.style.display !== want) article.style.display = want;
    } else {
      if (bar) bar.remove();
      if (article.style.display === "none") article.style.display = "";
    }
  }

  // 提示条按"本帖最先出现的 8 条"算（S.order 是首次见到的顺序，不随虚拟滚动卸载/挂载变化），避免来回出现消失
  function renderBanner(focal) {
    const first = S.order.slice(0, 8).map(item).filter((it) => it && it.decision && it.decision.kind !== "pending");
    const hits = first.filter((it) => it.decision.fold && cat(it.decision.kind) === "spam").length;
    // 清理得多、整条藏起来了（0.27）：最上面那一行已经说了清理了多少，不再另起一行说"大多是机器人"（用户 10-17：两条总结行不对）
    const show = !S.heavy && first.length >= 4 && hits / first.length >= S.settings.bannerRatio;
    if (show && !S.bannerCounted) { S.bannerCounted = true; stat({ bait_banner: 1 }); }
    const anchor = focal?.article || S.root?.querySelector(ART);
    if (!anchor) return;
    let banner = S.root.querySelector(".ff-banner");
    const msg = S.notice || S.jevNotice || (show && focal ? t("banner.bait", { n: first.length, hits }) : null);
    if (msg) {
      if (!banner) banner = el("div", "ff-banner");
      // 放在主帖下面。主帖被虚拟列表卸载时（往下滚远了）只有出错提示需要露出来：先放在当前最上面那条回复前，
      // 不跟着滚动挪来挪去（会让列表跳），等主帖挂回来再挪回主帖下面
      if (focal) { if (banner.previousElementSibling !== focal.article) focal.article.after(banner); }
      else if (!banner.isConnected) anchor.before(banner);
      const retry = [...S.items.values()].some((it) => it.jevSkipped || !it.overrideReady);
      const key = `${msg}|${retry}`;
      if (banner.dataset.key !== key) {
        banner.dataset.key = key;
        banner.replaceChildren(el("span", "", msg), ...(retry ? [document.createTextNode(" "), btn(t("banner.retryPending"), retryFailed)] : []));
      }
    } else if (banner) banner.remove();
  }

  // 连着的一串被折的（0.22.1，foldbar.js 的 GROUP_MIN 条以上）合成一条。按第一次见到的顺序（S.order，就是页面上从上往下）连：
  // 中间夹着藏起来的「赞」「mark」这类不算断开，没折的（照常显示的、还在判的）断开。合起来的那一条放在这一串挂着的第一条的格子里
  // （往下滚远了 X 会卸掉上面的格子，就放到下一条挂着的；条数照整串算）。点开过的串记在 openGroups，再判一遍也还开着
  // 清理得多的页面上能整条藏起来的（帖子页的回复）
  const heavyHidable = (it) => S.heavy && S.mode === "status" && !!it.decision && it.decision.fold;
  function computeGroups(mounted) {
    const groups = new Map();
    if (S.heavy && !S.showFill) { for (const it of S.items.values()) it.group = null; S.groups = groups; return; } // 整条藏着，不用合
    let run = [];
    const end = () => {
      if (run.length >= B.GROUP_MIN) {
        const key = run[0], open = run.some((id) => S.openGroups.has(id) || item(id).expanded);
        groups.set(key, { ids: run, open, at: run.find((id) => mounted.has(id)) || null });
        for (const id of run) item(id).group = key;
      }
      run = [];
    };
    for (const id of S.order) {
      const it = item(id);
      it.group = null;
      const d = it.decision;
      if (d && d.hide && !S.showFill) continue;
      if (d && d.fold) run.push(id); else end();
    }
    end();
    S.groups = groups;
  }
  function onGroupToggle(key) {
    const g = S.groups.get(key);
    if (!g) return;
    if (g.open) for (const id of g.ids) { S.openGroups.delete(id); const it = item(id); if (it) it.expanded = false; }
    else for (const id of g.ids) S.openGroups.add(id);
    g.open = !g.open;
    for (const a of document.querySelectorAll(ART)) { const it = inRoot(a) && item(articleId(a)); if (it && it.decision) renderItem(a, it); }
    scheduleScan(0);
  }
  // 主帖下面（有提示条就在提示条下面）一行：这一页藏了几条「赞」「mark」这类、点了全部显示 / 再藏起来。
  // 主帖被虚拟列表卸载了（往下滚远了）就不挪它，等主帖挂回来
  function onFillToggle() {
    S.showFill = !S.showFill;
    for (const a of document.querySelectorAll(ART)) { const it = inRoot(a) && item(articleId(a)); if (it && it.decision) renderItem(a, it); }
    scheduleScan(0);
  }
  // 现在看得见的（没被整条藏起来的）
  const shownNow = (it) => !!it.decision && !(it.decision.hide && !S.showFill) && !(heavyHidable(it) && !S.showFill);
  function renderFillLine(focal, mounted) {
    let n = 0;
    const counts = { spam: 0, abuse: 0, sexual: 0, filler: 0 };
    for (const it of S.items.values()) {
      if (it.decision && it.decision.hide) { n++; counts.filler++; }
      else if (heavyHidable(it)) { n++; counts[cat(it.decision.kind)]++; }
    }
    renderFillBottom(n, counts, mounted);
    let line = S.root ? S.root.querySelector(".ff-fill-line:not(.ff-fill-bottom)") : null;
    if (!n) { if (line) line.remove(); return; }
    if (!focal) return;
    if (!line) line = B.makeFillLine(onFillToggle);
    B.fillLine(line, n, S.showFill, S.heavy ? counts : null);
    const after = focal.article.nextElementSibling && focal.article.nextElementSibling.classList.contains("ff-banner") ? focal.article.nextElementSibling : focal.article;
    if (line.previousElementSibling !== after) after.after(line);
  }
  // 评论区长（看得见的回复 ≥ B.FILL_BOTTOM_MIN）时，最后一条看得见的回复下面再放一行一样的（0.27，用户 10-17：滚到后面就看不到上面那一行）。
  // 最后那条（按第一次见到的先后）没挂在页面上（X 只挂视野附近的）就先不放，滚到底了再放。
  // 放在那一格（cellInnerDiv）的最后、回复那块（带下边框）的外面：放进回复那块里看着像是那条回复的一部分（0.27.2，用户截图）；
  // 也不能放在格子外面——X 的格子是绝对定位一格格排下来的，放在外面会跑到列表最上面
  function renderFillBottom(n, counts, mounted) {
    let bottom = document.querySelector(".ff-fill-line.ff-fill-bottom");
    let at = null;
    if (n && mounted) {
      let shown = 0, last = null;
      for (const id of S.order) { const it = item(id); if (it && shownNow(it)) { shown++; last = it; } }
      if (shown >= B.FILL_BOTTOM_MIN && last) at = mounted.get(last.id) || null;
    }
    if (!at) { if (bottom) bottom.remove(); return; }
    if (!bottom) { bottom = B.makeFillLine(onFillToggle); bottom.classList.add("ff-fill-bottom"); }
    B.fillLine(bottom, n, S.showFill, S.heavy ? counts : null);
    const cell = at.closest('[data-testid="cellInnerDiv"]') || at.parentElement;
    if (bottom.parentElement !== cell || cell.lastElementChild !== bottom) cell.append(bottom);
  }

  function clearUI() {
    document.querySelectorAll(".ff-bar, .ff-banner, .ff-menuitem, .ff-fill-line, .ff-fill-tag").forEach((e) => e.remove());
    document.querySelectorAll(ART).forEach((a) => { if (a.style.display === "none") a.style.display = ""; delete a.dataset.ffFill; });
    document.querySelectorAll("[data-ff-cell]").forEach((c) => { c.style.display = ""; delete c.dataset.ffCell; });
  }

  // ---------- X 的"…"菜单里加一项 ----------
  // X 的菜单是点"…"后挂到 #layers 里的 Dropdown，选项是 menuitem（怎么认见 xdom.js 的 caretOf / menuIn / menuTemplate）。
  // 复制一个原生选项当外观模板（cloneNode 不带 React 的事件），换上我们的图标和文字，点击时自己处理并关菜单。
  let menuFor = null; // {id, at}
  const noteCaret = (ev) => {
    if (!alive() || !S.enabled || S.settingsLoading) return;
    const caret = X.caretOf(ev.target);
    // 点了别处（别的帖子的分享、转发菜单……）：不再往接下来开的菜单里加"清理这条"（0.28.9，review：以前记着 3 秒，
    // 关掉 A 的菜单马上开 B 的分享菜单，里面多出一个清理 A 的选项）
    if (!caret) { if (!(ev.target && ev.target.closest && X.inLayers(ev.target))) menuFor = null; return; }
    const art = caret.closest(ART);
    const id = art && inRoot(art) && pageKey() === S.postId ? articleId(art) : null;
    menuFor = id && id !== S.postId ? { id, at: Date.now() } : null;
  };
  // X 可能在按下时就开菜单，所以 pointerdown 和 click 都记（捕获阶段，先于 X 自己的处理）
  document.addEventListener("pointerdown", noteCaret, true);
  document.addEventListener("click", noteCaret, true);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && ev.isTrusted) menuFor = null; }, true); // 你按 Esc 关了菜单（插件自己关菜单发的不算）
  const ICON = "M3.27 2 2 3.27l3.05 3.05C3.4 7.58 2.13 9.24 1.5 12c1.2 5.3 5.9 8.5 10.5 8.5 1.86 0 3.66-.52 5.24-1.47L20.73 22 22 20.73 3.27 2zM12 18.5c-3.47 0-7.02-2.3-8.43-6.5.54-1.6 1.43-2.86 2.56-3.84l2.06 2.06A3.5 3.5 0 0 0 12 15.5c.43 0 .84-.08 1.22-.22l1.43 1.43c-.84.5-1.7.79-2.65.79zm0-13c4.6 0 9.3 3.2 10.5 8.5-.4 1.79-1.17 3.3-2.2 4.52l-1.43-1.42c.6-.83 1.07-1.87 1.36-3.1C19.02 9.8 15.47 7.5 12 7.5c-.6 0-1.2.07-1.77.2L8.7 6.17C9.76 5.73 10.86 5.5 12 5.5z";
  function closeMenu(dd) {
    const esc = () => new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true });
    dd.dispatchEvent(esc());
    document.dispatchEvent(esc());
  }
  function injectMenu(dd) {
    if (!S.enabled || S.settingsLoading || !menuFor || Date.now() - menuFor.at > 3000) return;
    // 整个页面只留一个：菜单同一时间只会开一个，但 X 会分几次把菜单挂上来（外层、内层各来一次），
    // 只在传进来的容器里查重会插两次。看得见的、对应同一条回复的已经有了就不再加；看不见的（旧菜单残留）删掉
    for (const old of document.querySelectorAll(".ff-menuitem")) {
      if (old.isConnected && old.getClientRects().length && old.dataset.ffFor === menuFor.id) return;
      old.remove();
    }
    const it = item(menuFor.id);
    if (!it || !it.decision) return;
    const id = it.id;
    const proto = X.menuTemplate(dd);
    const host = (proto && proto.parentElement) || dd; // 插到原生选项旁边，外层容器的样式才对得上
    const entries = it.decision.fold
      ? [[CATS[cat(it.decision.kind)].not, () => onFalsePositive(id)]]
      : [[t("bar.cleanThis"), () => onMissed(id)]]; // 没清理的只给一项（0.21.2，用户：不用分垃圾、辱骂、色情三项，一个就够）
    // 倒着 prepend，菜单里的顺序就是 entries 的顺序
    for (const [label, fn] of entries.reverse()) host.prepend(menuNode(proto, dd, id, label, fn));
  }
  function menuNode(proto, dd, id, label, fn) {
    let node;
    if (proto) {
      node = proto.cloneNode(true);
      const svg = node.querySelector("svg");
      if (svg) {
        svg.querySelectorAll("path, g, circle, rect").forEach((e) => e.remove());
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", ICON);
        svg.appendChild(path);
      }
      const spans = [...node.querySelectorAll("span")].filter((e) => e.textContent.trim());
      const textEl = spans[spans.length - 1] || node;
      textEl.textContent = label;
      node.removeAttribute("data-testid");
    } else {
      node = el("div", "ff-menuitem-plain", label);
      node.setAttribute("role", "menuitem");
      node.tabIndex = 0;
    }
    node.classList.add("ff-menuitem");
    node.dataset.ffFor = id;
    const act = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      fn();
      menuFor = null;
      closeMenu(dd);
    };
    node.addEventListener("click", act, true);
    node.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") act(ev); }, true);
    return node;
  }

  // ---------- D1：同帖复读 + 已知口号 ----------
  function forgetSlogan(it) {
    // 近乎一样的一组（rules.js 的 mergeNear）用组里的代表句当键，不一定是这一条自己的那句：两个都记下
    const n = R.normSlogan(it.text), g = it.dup ? it.dup.n : null;
    if (!n && !g) return;
    S.slogans = S.slogans.filter((x) => x !== n);
    for (const k of [n, g]) if (k) S.dupOff.add(k);
    S.items.forEach((x) => { if ((x.dup && (x.dup.n === n || x.dup.n === g)) || x.known === n) { x.dup = null; x.known = null; } });
  }
  function markSlogans() {
    if (S.settings.dup === false) {
      S.items.forEach((it) => { it.dup = null; it.known = null; });
      return;
    }
    const groups = R.findDupSlogans([...S.items.values()], S.postText, { nearCache: S.near });
    const inGroup = new Map();
    for (const [n, ids] of groups) {
      // 你在这一串里点过"不是垃圾"的：组里哪一句被点过都算（0.28.10，review：以前只看组的代表句，代表句换了整串又折回去）
      if (S.dupOff.has(n) || ids.some((id) => { const x = S.items.get(id); return x && S.dupOff.has(R.normSlogan(x.text)); })) continue;
      for (const id of ids) inGroup.set(id, { n, count: ids.length });
    }
    const known = new Set(S.slogans);
    for (const it of S.items.values()) {
      if (it.userLabel) continue;
      it.dup = inGroup.get(it.id) || null;
      const n = R.normSlogan(it.text);
      it.known = !it.dup && !S.dupOff.has(n) && known.has(n) && R.sloganOk(n) ? n : null;
    }
  }

  // ---------- 主循环 ----------
  // 一页先判 40 条，往下滚一屏多放一些（foldbar.js 的 readBudget）；判过的、你自己标的不受它管
  const budget = B.readBudget(() => scheduleScan(0));
  const DEFERRED = Object.freeze({ fold: false, kind: "deferred" });
  const deferred = (it) => !it.started && !it.userLabel && (it.seq ?? 0) >= budget.budget;
  function resetFor(postId) {
    resetRequests();
    budget.reset();
    S.postId = postId; S.opHandle = ""; S.postText = ""; S.postAuthor = null; S.root = null; S.rec = undefined; S.postOrigPending = false;
    S.participants = new Set(); S.items = new Map(); S.order = []; S.queue = []; S.notice = null; S.bannerCounted = false;
    S.dupOff = new Set(); S.near = R.nearState(); S.showFill = false; S.groups = new Map(); S.openGroups = new Set(); S.heavy = false;
    S.mode = !postId ? null : postId.startsWith("u:") ? "profile" : postId.startsWith("s:") ? "search" : "status";
    S.owner = S.mode === "profile" ? postId.slice(2) : "";
    if (!postId) return;
    if (S.mode === "profile") {
      // 告诉 Jev 这是谁的主页：主人推自己的东西不算给别人拉人（和帖子页带上楼主一样）
      S.postText = `Posts on the X profile page of @${S.owner}: its own posts, and posts it reposted or replied to. They are not replies to one post.`;
      // 不带主页顶上的名字（0.28.9，review：刚跳过来时那一栏还没画出来、或者还是上一个人的，进了缓存指纹，下次来对不上又全判一遍）
      S.postAuthor = { name: "", handle: "@" + S.owner };
    } else if (S.mode === "search") {
      // 搜索结果：一堆不相干的人发的帖子，没有作者可带；搜的词不发（同一条帖子换个词搜到，缓存照样用）
      S.postText = "Posts shown in X search results, from many unrelated accounts. They are not replies to one post.";
    }
    stat(S.mode === "profile" ? { profiles: 1 } : S.mode === "search" ? { searches: 1 } : { posts: 1 });
    // 缓存由后台收到完整上下文后检查，不能仅凭帖子 ID 预取并直接应用。
  }

  // X 的主题（浅色 / 暗蓝 / 纯黑）跟系统设置无关：按页面底色判断，深色时折叠条换一套颜色（content.css 的 .ff-dark）
  function syncTheme() {
    const dark = X.darkTheme();
    if (document.documentElement.classList.contains("ff-dark") !== dark) document.documentElement.classList.toggle("ff-dark", dark);
  }

  function scan() {
    if (!alive()) return;
    syncTheme();
    if (S.settingsLoading) {
      clearUI();
      const { pid, media } = route();
      const arts = [...(document.querySelector(X.SEL.column)?.querySelectorAll(ART) || [])];
      if (S.settingsError && pid && !media && arts.length) {
        const banner = el("div", "ff-banner");
        banner.append(el("span", "", S.settingsError), document.createTextNode(" "), btn(t("banner.retry"), refreshSettings));
        const focalArt = arts.find((a) => articleId(a) === pid);
        if (focalArt) focalArt.after(banner); else arts[0].before(banner); // 同上：主帖在就放主帖下面
      }
      return;
    }
    if (!S.settings) return;
    if (!S.enabled) { clearUI(); return; }
    S.me = X.selfHandle() || S.me; // 左边栏没画出来（窗口窄、刚加载）时用上次认出来的（0.28.9 以前当成认不出：你自己的回复也拿去判）
    const r = route();
    if (r.media) return; // 图片/视频层：底下的页面原样留着
    const key = pageKey(r);
    if (key !== S.postId) resetFor(key);
    if (!key) {
      if (document.querySelector(".ff-bar, .ff-banner, .ff-fill-line, [data-ff-fill]")) clearUI(); // 离开帖子页、主页：别把折叠留在首页之类的地方
      return;
    }
    const { focal, replies } = collect();
    if (focal && !S.postText) {
      S.postText = focal.info.text;
      if (focal.info.translated) { // 主帖也是 X 的译文：给 Jev 的上下文换成原文
        const epoch = S.epoch, fid = focal.info.id;
        // 拿到原文以前先不问"是不是求推荐"（0.28.9，review：以前这一问在拿到原文之前就发了，问的是 Grok 的译文）
        S.postOrigPending = true;
        askOriginal(fid).then((d) => {
          if (epoch !== S.epoch || S.postId !== fid) return;
          const o = originalOf(d);
          if (o) S.postText = o;
          S.postOrigPending = false;
          scheduleScan(0);
        });
      }
      S.opHandle = focal.info.handle;
      S.postAuthor = { name: focal.info.name, handle: focal.info.handle }; // 告诉 Jev 帖子是谁发的，提作者自家产品不算拉人
      if (S.opHandle) S.participants.add(S.opHandle.slice(1).toLowerCase());
    }
    ensureRec();
    let fresh = 0;
    for (const { article, info } of replies) {
      if (info.handle) S.participants.add(info.handle.slice(1).toLowerCase());
      if (!S.items.has(info.id)) {
        const it = { ...info, seq: S.order.length };
        S.items.set(info.id, it);
        S.order.push(info.id);
        useOriginal(it);
        fresh++;
      }
      // 图每一轮都重读（图比字晚画出来）；看图片开着、图变了就重问
      const it = S.items.get(info.id), imgs = X.photoUrls(article);
      if (imgs.join("\n") !== (it.images || []).join("\n")) { it.images = imgs; if (withImg(it) && !it.queued) { it.scores = null; it.jevSkipped = false; } }
    }
    if (fresh) stat({ seen: fresh });
    loadOverrides();
    markSlogans();
    markLocal();
    for (const id of S.order) {
      const it = S.items.get(id);
      if (deferred(it)) { it.decision = DEFERRED; continue; } // 超出这一页先判的条数：照常显示，往下滚了再判
      it.started = true;
      if (needJev(it)) { it.queued = true; S.queue.push(it); }
      const before = it.decision && it.decision.fold;
      it.decision = decide(it);
      if (it.decision.hide && !it.fillCounted) { it.fillCounted = true; stat({ fold_filler: 1 }); }
      if (it.decision.fold && !before && !it.counted) {
        it.counted = true;
        stat({ [`fold_${it.decision.kind}`]: 1 });
        // 自动折的记一笔给弹窗核对（你自己标的不记）：存回复自己写的话，没写就存被引用的那条
        // 0.28.5 起不再把清理掉的回复发给后台存"最近清理的 50 条"（没有界面展示，少存）
      }
    }
    flush();
    askMarkedSoon();
    const mounted = new Set(replies.map((r) => r.info.id));
    computeGroups(mounted);
    if (!S.heavy && S.mode === "status") { // 清理条（合起来的算一条）超过 HEAVY_UNITS：这一页改成整条藏起来
      const inGroup = new Set([...S.groups.values()].flatMap((g) => g.ids));
      let units = S.groups.size;
      for (const it of S.items.values()) if (it.decision && it.decision.fold && !inGroup.has(it.id)) units++;
      if (units > B.HEAVY_UNITS) { S.heavy = true; computeGroups(mounted); }
    }
    for (const { article, info } of replies) renderItem(article, S.items.get(info.id));
    renderBanner(focal);
    renderFillLine(focal, new Map(replies.map((r) => [r.info.id, r.article])));
  }

  // 固定节流：最多每 200 ms 扫一次。不能用"每次变动都重新计时"的防抖——X 页面上视频在播时 DOM 一直在变，会永远等不到。
  let timer = null;
  function scheduleScan(delay = 200) {
    if (timer) {
      if (delay === 0) { clearTimeout(timer); timer = null; } else return;
    }
    timer = setTimeout(() => { timer = null; scan(); }, delay);
  }

  // 插件在 chrome://extensions 里被刷新或卸载后，已打开页面里的旧脚本还会继续跑（chrome.runtime.id 变成 undefined）。
  // 不停掉的话，新旧两份脚本会同时往页面里加东西（比如菜单里出现两项）。
  const alive = () => { try { return !!chrome.runtime.id; } catch (e) { return false; } };
  const ours = (n) => n.nodeType === 1 && (n.classList.contains("ff-bar") || n.classList.contains("ff-banner") || n.classList.contains("ff-menuitem") || n.classList.contains("ff-btn") ||
    n.classList.contains("ff-fill-line") || n.classList.contains("ff-fill-tag"));
  const observer = new MutationObserver((muts) => {
    if (!alive()) { observer.disconnect(); return; }
    let relevant = false;
    for (const m of muts) {
      if (m.type !== "childList") continue;
      if (ours(m.target) || (m.target.closest && m.target.closest(".ff-bar, .ff-banner, .ff-fill-line"))) continue;
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || ours(n)) continue;
        if (menuFor) {
          const dd = X.menuIn(n); // 先认 X 的 Dropdown 标记；没有的话认 #layers 里新出现的 role=menu
          if (dd) { injectMenu(dd); continue; }
        }
        relevant = true;
        // 已判过的回复被 X 重新挂载：同步套上折叠（这个回调在浏览器绘制前执行）。
        // 只在还停在这个帖子、且是本帖那块时间线里的才套——回首页时首页卡片里也会挂出同一条回复，那时还没轮到扫描去清状态
        if (!S.enabled || S.settingsLoading || !S.settings || !S.items.size) continue;
        if (pageKey() !== S.postId) continue;
        const arts = n.matches(ART) ? [n] : n.querySelectorAll(ART);
        for (const a of arts) {
          if (!inRoot(a)) continue;
          const id = articleId(a);
          const it = id && S.items.get(id);
          if (it && it.decision) renderItem(a, it);
        }
      }
      if (!relevant && m.removedNodes.length && ![...m.removedNodes].every(ours)) relevant = true;
    }
    if (relevant) scheduleScan();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  let settingsVersion = 0;
  // 只管翻译的设置：改了评论区这边不动
  const NOT_COMMENTS = new Set(["translate", "translateFill", "translateThreshold", "translateModel", "translateFallback"]);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area && area !== "local") return;
    if (changes.ff_settings || changes.ff_keys || changes.ff_key) { // 换了 key：0.28.12 起看 ff_keys（只有填没填），ff_key 是旧版本留下、刚挪走的
      // 只动了翻译设置（归 translate.js 管）或值实际没变：评论区这边不动，免得折叠全部闪一下、进行中的请求作废重发。
      // 别的设置一变就照旧：先停发送、暂停判断，读到新设置再重判（读失败宁可暂停，也不沿用旧规则）。
      const F = globalThis.FFSettings;
      const before = F.forSite(changes.ff_settings?.oldValue, "x"), after = F.forSite(changes.ff_settings?.newValue, "x");
      const changed = changes.ff_settings ? Object.keys(F.DEFAULTS).filter((k) => k !== "rev" && before[k] !== after[k]) : [];
      if (changes.ff_keys || changes.ff_key || changed.some((k) => !NOT_COMMENTS.has(k))) {
        if (changes.ff_settings && !after.enabled) { S.enabled = false; clearUI(); }
        refreshSettings();
      }
    }
    if (changes.ff_confirmed_slogans) {
      S.sloganVersion++;
      const old = new Set((changes.ff_confirmed_slogans.oldValue || []).map((x) => x.text));
      setMarked(changes.ff_confirmed_slogans.newValue);
      for (const text of S.slogans) if (!old.has(text)) S.dupOff.delete(text);
      scheduleScan(0);
    }
    for (const [key, change] of Object.entries(changes)) {
      if (!key.startsWith("ff_reply_override:")) continue;
      const it = item(key.slice("ff_reply_override:".length));
      if (!it) continue;
      it.userLabel = change.newValue?.label || null;
      it.overrideReady = true;
      it.overrideVersion = (it.overrideVersion || 0) + 1;
      if (it.userLabel === "fp") forgetSlogan(it);
      scheduleScan(0);
    }
  });

  // 翻译那边（translate.js，同一个隔离环境）问"这条马上要判出来吗"（0.28.7，review）：还在等判——本地标记没读完、等原文、
  // 排着或正在问 Jev、等求推荐那一问——答 "pending"，翻译那边先等一等（最多几秒），免得给马上要清理的垃圾付翻译费。
  // 判完了、不归这里管（主帖、首页）、Jev 关着或问不了答 null：照常翻（清理掉的看不见，那边按显示与否跳过；你点开了照样翻）
  globalThis.FFXVerdict = (id) => {
    if (!S.enabled || !S.settings || S.settingsLoading) return null;
    const it = S.items.get(id);
    if (!it || !it.started || (it.decision && it.decision.kind !== "pending")) return null;
    const waiting = !it.overrideReady || (it.translated && it.origState !== "done") || it.queued || needJev(it) ||
      (S.mode === "status" && !!S.postText && S.rec === null);
    return waiting ? "pending" : null;
  };

  // 弹窗问"这个页面怎么样"：这一页折了几条（按三类）、还有几条在等 Jev；翻译那边的数从 translate.js 拿（同一个隔离环境）
  try {
    chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
      if (!msg || msg.type !== "pageSummary" || !alive()) return;
      const r = route(), key = pageKey(r);
      // key、folded：这一页的记号、清理掉的 [id, 类别]（弹窗不用；测试和排查用，问的时候现算、不存。0.28.5 以前靠发给后台的"最近清理"记录）
      const out = { site: "x", kind: r.media ? "other" : r.kind, key: key || null, own: r.kind === "profile" && !key, enabled: S.enabled, tx: globalThis.FFTxSummary ? globalThis.FFTxSummary() : null };
      if (key && key === S.postId) {
        const folds = { spam: 0, abuse: 0, sexual: 0 };
        let pending = 0, filler = 0;
        for (const it of S.items.values()) {
          const d = it.decision;
          if (d && d.fold) folds[cat(d.kind)]++;
          else if (d && d.hide) filler++;
          else if (!d || d.kind === "pending") pending++;
        }
        const folded = [...S.items.values()].filter((it) => it.decision && it.decision.fold).map((it) => [it.id, it.decision.kind]);
        Object.assign(out, { folds, filler, pending, seen: S.items.size, owner: S.owner, folded });
      }
      reply(out);
    });
  } catch (e) { /* 插件刚重载 */ }

  refreshSettings();
})();
