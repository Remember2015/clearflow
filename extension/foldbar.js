// 折叠条（X 和 Reddit 共用）：一行胶囊，左边类别标签，中间原因、分数、账号，右边图标按钮；整条可点（展开 / 收起）。
// 只管画和点：放在哪、藏起哪个元素、点了以后怎么记，由各站自己的内容脚本（content.js、reddit.js）决定。样式在 content.css。
(() => {
  if (globalThis.FFBar) return;
  const R = globalThis.FFRules;
  const { t } = globalThis.FFI18n;
  // 折叠的三类：kind → 类别；不在表里的 kind 都是垃圾回复
  const CAT_OF = { abuse: "abuse", user_abuse: "abuse", sexual: "sexual", user_sexual: "sexual" };
  const cat = (kind) => CAT_OF[kind] || "spam";
  const catOf = (c, cls, label) => ({ cls, label, get tag() { return t(`cat.${c}.tag`); }, get confirm() { return t(`cat.${c}.confirm`); },
    get not() { return t(`cat.${c}.not`); } });
  const CATS = { spam: catOf("spam", "", "missed"), abuse: catOf("abuse", " ff-tag-abuse", "missed_abuse"), sexual: catOf("sexual", " ff-tag-sexual", "missed_sexual") };
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // 折叠条上的图标：24 格画、2 线宽，显示成 18 像素约 1.5 像素，配 13 像素正文。颜色跟 currentColor 走，
  // 悬停、"已选""已记住"这些状态靠 CSS 变色 / 填充，不换图（见 content.css）。
  // 不用勾和小旗：勾既像"没问题"又像"判对了"，小旗在 X 里是"举报"；也不用书签：X 的书签是收藏帖子。
  // 判断对不对用"判对了吗？👍 👎"，前面那句话交代了是在评价插件的判断；"记住这句话"用漏斗加号（加进过滤）。
  // 大拇指路径改自 Lucide（ISC 许可），向下的是向上的转 180°
  const THUMB = '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" class="ff-shape"/>';
  const ICONS = {
    up: THUMB,
    down: `<g transform="rotate(180 12 12)">${THUMB}</g>`,
    filter: '<path class="ff-shape" d="M3 5h12l-4.5 6v6.5l-3 1.5V11z"/><path class="ff-plus" d="M19 3v6M16 6h6"/>',
    show: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.75"/>',
    hide: '<path d="M3 3l18 18"/><path d="M10.6 5.6c.46-.07.93-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a16.6 16.6 0 0 1-2.4 3.2"/>' +
      '<path d="M6.7 6.7C4 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3.06-.46 4.35-1.15"/><path d="M9.9 9.9a2.75 2.75 0 0 0 3.9 3.9"/>',
  };
  // 只有图标的按钮：aria-label 给读屏、title 给鼠标悬停
  function iconBtn(icon, label, hint, onClick, on = false, trustedOnly = false) {
    const b = el("button", "ff-icon" + (on ? " ff-on" : ""));
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.title = hint;
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[icon]}</svg>`; // 固定的图形，不含页面内容
    b.addEventListener("click", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if (!trustedOnly || ev.isTrusted) onClick();
    }, true);
    return b;
  }
  // 一条新的折叠条：整条都能点（展开 / 收起；按钮自己处理；拖选文字时不切换）
  function make(id, onToggle) {
    const bar = el("div", "ff-bar");
    bar.dataset.ffId = id;
    bar.addEventListener("click", (ev) => {
      if (ev.target.closest("button") || String(getSelection())) return;
      ev.preventDefault(); ev.stopPropagation();
      onToggle(bar.dataset.ffId);
    }, true);
    return bar;
  }
  // 这一条在不在"你标记的垃圾"里（0.26）：标的就是这一条，或者一字不差的同一句（够长才算）
  function isMarked(it, h) {
    if (!h) return false;
    if (h.markedIds && h.markedIds.has(it.id)) return true;
    const n = R.normSlogan(it.text);
    return R.sloganOk(n) && (h.slogans || []).includes(n);
  }
  // 折叠条里的内容。it：{id, text, handle, decision: {kind, reason}, expanded, userLabel}；h：{slogans, markedIds, onToggle, onConfirm, onFalsePositive, onRemember}。
  // 和上次画的一样就不重画
  function fill(bar, it, h) {
    const d = it.decision;
    const remembered = isMarked(it, h);
    const key = `${d.reason}|${it.expanded ? 1 : 0}|${it.userLabel || ""}|${remembered}|${it.handle || ""}`;
    if (bar.dataset.ffKey === key) return;
    bar.dataset.ffKey = key;
    const id = it.id, c = cat(d.kind);
    const m = d.reason.match(/^(.*?)\s(\d\.\d{2})$/); // "辱骂或人身攻击 0.90"：分数单独放、淡一点
    const text = el("span", "ff-text");
    text.append(el("span", "ff-reason", m ? m[1] : d.reason));
    if (m) text.append(el("span", "ff-score", m[2]));
    if (it.handle) { // 账号本身从左往右（阿拉伯语界面里也是 "@user"），外面的间距和"· "跟着界面方向
      const hd = el("bdi", null, it.handle); hd.dir = "ltr";
      const who = el("span", "ff-who"); who.append(hd); text.append(who);
    }
    // 收起时只给"展开"：看不到内容就判断不了判得对不对。展开后才有"判对了吗？👍 👎"和"记住这句话"，"收起"固定在最右边。
    // 你自己标的（"你标记的…"）👍 显示为已选，再点不重复记
    const mine = !!it.userLabel;
    const controls = it.expanded ? [
      el("span", "ff-ask", t("bar.ask")),
      iconBtn("up", t("bar.right", { what: CATS[c].confirm }), t("bar.right", { what: CATS[c].confirm }), () => { if (!mine) h.onConfirm(id); }, mine, true),
      iconBtn("down", t("bar.wrong", { what: CATS[c].not }), t("bar.wrongTitle", { what: CATS[c].not }), () => h.onFalsePositive(id), false, true),
      ...(c === "spam" && /\p{L}/u.test(it.text || "") ? [remembered
        ? iconBtn("filter", t("bar.forget"), t("bar.forgetTitle"), () => h.onRemember(id), true, true)
        : iconBtn("filter", t("bar.remember"), t("bar.rememberTitle"), () => h.onRemember(id), false, true)] : []),
      iconBtn("hide", t("bar.collapse"), t("bar.collapse"), () => h.onToggle(id)),
    ] : [iconBtn("show", t("bar.expand"), t("bar.expand"), () => h.onToggle(id))];
    bar.replaceChildren(el("span", "ff-tag" + CATS[c].cls, CATS[c].tag), text, el("span", "ff-sp"), ...controls);
  }
  // 「赞」「mark」这类回复（0.22）：整条藏起来，不放折叠条（一个"赞"换成一条折叠条，占的地方一样大）；评论区最上面一行
  // "清理了 N 条「赞」「mark」这类回复 · 查看"，点了全部在原处显示、每条作者那一栏后面一个小标签，这一行变成"N 条… · 收起"。
  // 画在哪由各站决定（content.js、fold_engine.js），这里只管长什么样。line 里带 OWN 那个 class（FFDom.OWN），读页面的地方会跳过
  // 最上面那一行前面放插件的图标（用户 10-17：看得出是插件清理的）。照 ui/icons/icon-16.svg（16 像素里只画一个大漏斗），颜色跟页面深浅色换（content.css）
  const LOGO = '<rect class="ff-logo-bg" width="16" height="16" rx="3.75"/><path class="ff-logo-fg" d="M3 3.5H13L9.25 8V12.5L6.75 11.25V8Z" stroke-width="0.6" stroke-linejoin="round"/>';
  function logo() {
    const s = el("span", "ff-fill-logo");
    s.title = t("app.name");
    s.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${LOGO}</svg>`; // 固定的图形，不含页面内容
    return s;
  }
  // counts（0.27，清理得多的页面）：{spam, abuse, sexual, filler} 各藏了几条，这一行写"清理了 N 条：垃圾回复 17、「赞」「mark」这类 2"；不给就只说「赞」「mark」这类
  function fillLine(line, n, shown, counts = null) {
    const parts = counts ? ["spam", "abuse", "sexual", "filler"].filter((k) => counts[k]).map((k) => t(`heavy.${k}`, { n: counts[k] })).join(t("group.sep")) : "";
    const key = `${n}|${shown ? 1 : 0}|${parts}`;
    if (line.dataset.ffKey === key) return;
    line.dataset.ffKey = key;
    const b = el("button", "ff-fill-act", t(shown ? "filler.hide" : "filler.show"));
    b.type = "button";
    b.setAttribute("aria-expanded", shown ? "true" : "false");
    const text = counts ? t(shown ? "heavy.lineShown" : "heavy.line", { n, parts }) : t(shown ? "filler.lineShown" : "filler.line", { n });
    line.replaceChildren(logo(), el("span", "ff-fill-text", text), b);
  }
  function makeFillLine(onToggle) {
    const line = el("div", "ff-fill-line ff-own"); // ff-own：FFDom.OWN（X 上没加载 ffdom.js），读页面的地方跳过
    line.setAttribute("role", "button");
    line.tabIndex = 0;
    const go = (ev) => { ev.preventDefault(); ev.stopPropagation(); onToggle(); };
    line.addEventListener("click", go, true);
    line.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") go(ev); }, true);
    return line;
  }
  const fillTag = (id) => { const e = el("span", "ff-fill-tag ff-own", t("filler.tag")); e.dataset.ffId = id; return e; };
  // 连着的一串（0.22.1）：同一处连着 GROUP_MIN 条以上被折的（中间夹着藏起来的「赞」「mark」这类不算断开）合成一条：
  // 左边每一类一个标签带条数（"疑似垃圾回复 14""疑似辱骂 2"），中间"16 条 · 出现最多的两种原因"，右边展开 / 收起。
  // 展开后照旧是一条条的折叠条（每条还能单独展开、纠错），这一条留在最上面换成"收起"。用户 10-16 截图：X 上 16 条折叠条一条接一条
  // 0.27 起挨着两条就合（用户 10-17 截图：垃圾多的帖子里清理条和正常回复一条隔一条）
  const GROUP_MIN = 2;
  // 一页上的清理条（合起来的算一条）超过这么多：被清理的整条藏起来，评论区最上面那一行写清理了几条（和「赞」「mark」这类合在一行），
  // 点"查看"回到一条条的样子；藏过以后这一页就一直这样（不随滚动加载来回切）。只在帖子页、认得出"底下有没有回复"的站点上（底下有回复的照旧放清理条）
  const HEAVY_UNITS = 5;
  // 评论区长（看得见的回复有这么多，X 上两三屏）时，最后一条看得见的回复下面再放一行一样的（0.27，用户 10-17：滚到后面就看不到上面那一行）
  const FILL_BOTTOM_MIN = 15;
  const baseReason = (r) => String(r || "").replace(/\s\d\.\d{2}$/, "").replace(/\s*[（(][^）)]*[）)]\s*/g, "").trim(); // 去掉分数和括号里的账号
  function makeGroup(key, onToggle) {
    const bar = el("div", "ff-bar ff-group");
    bar.dataset.ffGroup = key;
    bar.addEventListener("click", (ev) => {
      if (String(getSelection()) && !ev.target.closest("button")) return;
      ev.preventDefault(); ev.stopPropagation();
      onToggle(bar.dataset.ffGroup);
    }, true);
    return bar;
  }
  // members：这一串的条目（都带 decision）；open：展开着
  function fillGroup(bar, members, open) {
    const n = members.length, byCat = { spam: 0, abuse: 0, sexual: 0 }, why = new Map();
    for (const it of members) {
      byCat[cat(it.decision.kind)]++;
      const r = baseReason(it.decision.reason);
      if (r) why.set(r, (why.get(r) || 0) + 1);
    }
    const reasons = [...why.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r]) => r);
    const key = `${n}|${open ? 1 : 0}|${Object.values(byCat).join(",")}|${reasons.join("|")}`;
    if (bar.dataset.ffKey === key) return;
    bar.dataset.ffKey = key;
    const tags = Object.keys(byCat).filter((c) => byCat[c]).map((c) => el("span", "ff-tag" + CATS[c].cls, `${CATS[c].tag} ${byCat[c]}`));
    const text = el("span", "ff-text");
    text.append(el("span", "ff-reason", t("group.n", { n })));
    if (reasons.length) text.append(el("span", "ff-group-why", reasons.join(t("group.sep"))));
    const label = t(open ? "group.collapse" : "group.expand", { n });
    bar.setAttribute("aria-expanded", open ? "true" : "false");
    bar.replaceChildren(...tags, text, el("span", "ff-sp"), iconBtn(open ? "hide" : "show", label, label, () => bar.click()));
  }
  // 评论上的"清理掉这条"漏斗（0.26，Reddit、YouTube、小红书、HN；X 用它自己的"…"菜单）：放在作者那一行末尾，鼠标移到这条评论上才看得见
  function markButton(id, onMark) {
    const b = iconBtn("filter", t("mark.this"), t("mark.thisTitle"), () => onMark(id), false, true);
    b.classList.add("ff-mark", "ff-own"); // ff-own：FFDom.OWN，读页面的地方跳过
    b.dataset.ffId = id;
    return b;
  }
  // 页面底部的一句提示（标记以后："已清理，以后类似的也会清理 · 撤销"），6 秒后自己消失；同时只有一条
  let toastEl = null, toastTimer = 0;
  const hideToast = () => { if (toastEl) toastEl.classList.remove("ff-toast-on"); };
  function toast(text, action = null, onAction = null) {
    if (!toastEl || !toastEl.isConnected) {
      toastEl = el("div", "ff-toast ff-own");
      toastEl.setAttribute("role", "status");
      document.body.append(toastEl);
    }
    const kids = [el("span", null, text)];
    if (action && onAction) {
      const b = el("button", "ff-toast-act", action);
      b.type = "button";
      b.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (ev.isTrusted) { hideToast(); onAction(); }
      }, true);
      kids.push(b);
    }
    toastEl.replaceChildren(...kids);
    void toastEl.offsetWidth; // 先落下"没出现"的样子，再出现（淡入）
    toastEl.classList.add("ff-toast-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }
  // 一页先判多少条、往下滚了再放多少（0.27，用户 10-17：抽奖帖首屏就一直加载、清理了 340 条，太费 API）：整条藏起来的回复不占地方，
  // X / YouTube 以为快到底了就接着加载，加载来的又被判、被藏——没人往下滚也一直转。超出的先照常显示、不判（不发 Jev、本地规则也不用），
  // 你往下滚了再放：每滚 0.75 屏多判 step 条。滚动从哪儿来都算（X、YouTube、Reddit 滚的是整页，小红书滚的是评论那一栏），只算往下的；
  // 藏东西、加载东西不会让滚动位置往下走，所以不算
  function readBudget(onGrow, first = 40, step = 20) {
    let budget = first, acc = 0;
    const last = new WeakMap();
    document.addEventListener("scroll", (ev) => {
      const t = ev.target === document ? document.scrollingElement || document.documentElement : ev.target;
      if (!t || typeof t.scrollTop !== "number") return;
      const y = t.scrollTop, prev = last.has(t) ? last.get(t) : 0; // 第一次滚：从顶上算起（不知道滚之前在哪；页面一般从顶上开始）
      last.set(t, y);
      if (y > prev) acc += y - prev;
      const unit = (innerHeight || 800) * 0.75;
      if (acc < unit) return;
      const n = Math.floor(acc / unit);
      acc -= n * unit;
      budget += n * step;
      onGrow();
    }, { capture: true, passive: true });
    return { get budget() { return budget; }, reset() { budget = first; acc = 0; } };
  }
  globalThis.FFBar = Object.freeze({ readBudget, CAT_OF, cat, CATS, el, iconBtn, make, fill, fillLine, makeFillLine, fillTag, GROUP_MIN, HEAVY_UNITS, makeGroup, fillGroup, isMarked, markButton, toast, FILL_BOTTOM_MIN });
})();
