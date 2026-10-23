// 翻译增强（页面这头），两件事：
// ① 改进（improve，首页和帖子详情页）：X 用 Grok 自动翻译过的帖子，读出原文和 Grok 的译文交给后台（translator.js）判断，
//    Grok 翻得不好时重译（0.29.8 起重译的过了本地检查就换，不再判分），把 X 的译文藏起来、换上我们的，下面一行小字说明并能切回 Grok 版。
// ② 补翻（fill，帖子详情页）：X 翻译了主帖（或上面的原帖），同一个作者的其他帖子（补充回复、串推）却没翻的：
//    X 自己给了"显示翻译"按钮的（按需翻译，没自动翻），替你点一下，用 X 自己的翻译；X 什么都没给的，插件直接翻，
//    上面一行小字"插件翻译自英语 · 看原文"（和 X 自己的"翻译自 英语"一样放在正文上面）。
// 和评论区（content.js）分开；设置里 translate 打开才工作：改进（首页、用户主页、搜索结果、帖子页）要两个 key，帖子页补翻（还要 translateFill 开着）只要 OpenRouter key。
//
// X 的自动翻译：正文元素（tweetText）里直接是译文，lang 是 X 的界面语言；正上面一行"翻译自 英语 · 显示原文"（带 Grok 图标）。
// 原文不在页面上，点那一行的按钮才把同一个元素换成原文。React 在点击后的微任务里更新，所以"点 → 等微任务 → 读 → 再点 →
// 等微任务"在浏览器画下一帧之前就做完了，看不到闪动（实测见 translate_eval）。
// 不认按钮上的字（X 的界面可以是任何语言）：那一行按位置找（正文正上面、带按钮和图标），状态按正文的 lang 和 X 的界面语言比。
// 目标语言就是 X 的界面语言（<html lang>）：插件是在补 X 自己的翻译，X 翻成什么语言，插件就翻成什么语言。
// 原文和 X 的译文先问 pagedata.js（页面数据：X 接口返回里记下的，没有再看 React 组件数据），和屏幕上显示的对得上就用，
// 不用去点按钮；长帖（有"显示更多"，点了在原地展开）也是这样拿到完整原文和完整译文，按全文判、按全文翻，
// 换上的译文是完整的、直接全部显示（X 的"显示更多"藏起来，切回 X 的版本时再露出来）。
// 页面数据没有或对不上：短帖退回点按钮读原文；长帖改进等你展开了再处理，补翻替你点开"显示更多"，按展开后的全文翻。
// 读 X 页面的地方（选择器、翻译那一行怎么认、网址）都在 xdom.js。
(() => {
  const X = globalThis.FFX;
  const ART = X.SEL.article, TEXT = X.SEL.text, MORE = X.SEL.more;
  const { t, langName } = globalThis.FFI18n;
  const MAX_INFLIGHT = 6, TICK = 1000, MAX_LEN = 4000; // 一页同时几条（后台所有标签页一起最多 16 个，0.19.4 以前 8 个；这里 0.13.13 以前 3）；再长的帖子不翻（后台一条最多收 5000 字）
  const alive = () => { try { return !!chrome.runtime.id; } catch (e) { return false; } };
  const send = (msg) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (r) => resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : r || {}));
    } catch (e) {
      resolve({ error: String(e) });
    }
  });
  // 首页 / 用户主页 / 搜索结果（改进 X 的翻译，和首页一样）/ 帖子详情页 /用户/status/数字（图片层、引用列表之类的子页不算）/ 其他页不管
  function page() {
    const r = X.route();
    if (r.kind === "home" || r.kind === "profile" || r.kind === "search") return { kind: r.kind };
    return r.kind === "status" && !r.media ? { kind: "status", pid: r.pid } : null;
  }

  // 帖子的原文和 X 的译文（长帖是全文）：pagedata.js 在页面自己的 JS 环境里读出来，用事件传过来（detail 都是字符串）
  const pageWaiters = new Map();
  document.addEventListener("ff-tx-data", (e) => {
    let d = null;
    try { d = JSON.parse(e.detail); } catch (err) { return; }
    const w = d && typeof d.id === "string" && pageWaiters.get(d.id);
    if (w) { pageWaiters.delete(d.id); w(d); }
  });
  function askPage(id) {
    return new Promise((resolve) => {
      pageWaiters.get(id)?.(null);
      pageWaiters.set(id, resolve);
      document.dispatchEvent(new CustomEvent("ff-tx-ask", { detail: id }));
      setTimeout(() => { if (pageWaiters.get(id) === resolve) { pageWaiters.delete(id); resolve(null); } }, 800);
    });
  }
  // 比较页面上那截和页面数据时不看链接（页面上是 https://显示地址…，数据里是 t.co）和空白
  const norm = (t) => String(t || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, "");

  // onImprove：首页（要 Jev 和 OpenRouter 两个 key）；onFill：帖子页补翻（只要 OpenRouter key）
  let onImprove = false, onFill = false, inflight = 0, settingsVersion = 0, settingsSig = "";
  async function loadSettings() {
    const version = ++settingsVersion;
    const r = await send({ type: "settings" });
    if (version !== settingsVersion || !r.settings) return;
    const st = globalThis.FFSettings.forSite(r.settings, "x"); // X 上开着翻译没有（0.20 起每个网站各自开关）
    onImprove = !!(st.translate && r.hasKey && r.hasOrKey);
    onFill = !!(st.translate && st.translateFill && r.hasOrKey);
    // 开关、模型、阈值、key 变了：已有结果全部作废（换上的译文撤下来，下面 render 会恢复 X 的），打开着就按新设置重做
    const sig = JSON.stringify([onImprove, onFill, st.translateThreshold, st.translateModel, st.translateFallback]);
    if (sig !== settingsSig) { settingsSig = sig; jobs.clear(); }
    scheduleRender();
  }
  // 开关关了、缺 key、key 无效、余额不足：这一页先不再发，等设置变了再说（Jev 的问题只影响首页那种）
  let creditStop = 0; // OpenRouter 余额不足停下的时间：过 CREDIT_RETRY 再试（充值不会通知插件；0.28.9 以前要刷新页面）
  const CREDIT_RETRY = 10 * 60e3;
  const clearErrors = () => { for (const [k, j] of jobs) if (j.state === "error") jobs.delete(k); };
  function stopFor(code) {
    if (code === "or_credit") creditStop = Date.now();
    if (["disabled", "noorkey", "or_badkey", "or_credit"].includes(code)) { onImprove = false; onFill = false; return true; }
    if (["nokey", "badkey"].includes(code)) { onImprove = false; return true; }
    return false;
  }

  // ---------- 读页面（读法在 xdom.js） ----------
  const statusId = X.statusId;
  const authorOf = X.authorId; // 作者账号：作者那一栏里指向 /账号 的链接（不用 innerText，免得触发布局）
  const target = X.uiLang; // 目标语言 = X 的界面语言 = X 把帖子翻成的语言
  const sameLang = X.sameLang;
  const xState = (a) => X.translationState(a, target()); // auto / off / demand / none，见 xdom.js
  const translatedByX = (a) => xState(a) !== "none";
  const xToggle = X.translationToggle; // 翻译那一行第一个按钮：显示原文 / 显示翻译
  // 要翻的：和你的语言不一样的；und（认不出）、zxx（没有文字）、qme / qam / qht 这类（只有链接、@、话题）不翻
  const foreign = (lang) => !!lang && !sameLang(lang, target()) && !/^(und|zxx|q[a-t][a-z])$/.test(lang);
  const textOf = X.textOf;
  // 这条自己的正文、自己的"显示更多"：引用卡片里的不算（0.28.9，review：只嵌了引用卡片、自己没写字的回复，以前拿卡片里被引用那条的正文
  // 去翻、把译文放进卡片，还会去点卡片里的"显示更多"——那是个链接，会跳走；引用了长帖的短回复也被当成长帖、一直不改进）
  const ownText = (a) => X.ownTextEl(a);
  const moreOf = (a) => { const q = X.quoteCard(a); return [...a.querySelectorAll(MORE)].find((m) => !(q && q.contains(m))) || null; };
  const settle = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
  // 点翻译那一行的按钮（显示原文）读原文，再点一次（显示翻译）切回去（见文件开头）。切不过去或切不回来就放弃这条
  async function readOriginal(a) {
    const show = xToggle(a), before = a.querySelector(TEXT);
    if (!show || !before || xState(a) !== "auto") return null;
    const lang0 = X.textLang(before);
    show.click();
    await settle();
    let tt = a.querySelector(TEXT);
    for (let i = 0; i < 10 && (!tt || X.textLang(tt) === lang0); i++) { await new Promise((r) => setTimeout(r, 30)); tt = a.querySelector(TEXT); }
    const ok = !!tt && X.textLang(tt) !== lang0;
    const out = ok ? { source: textOf(tt), srcLang: X.textLang(tt) } : null;
    const back = ok ? xToggle(a) : null;
    if (back) {
      back.click();
      await settle();
      for (let i = 0; i < 10 && xState(a) !== "auto"; i++) await new Promise((r) => setTimeout(r, 30));
    }
    return out && xState(a) === "auto" ? out : null;
  }

  // ---------- 每条帖子一个任务 ----------
  // jobs: "improve:帖子 id" / "fill:帖子 id" → {kind, sig（正文的 textContent，判断还是不是同一份）, state, result, showOurs, retries, retryAt, lang}
  const jobs = new Map();
  const jobKey = (kind, id) => `${kind}:${id}`;
  // 视野外先处理（0.13.11，用户要求上下左右都预先处理）：视野上面一屏、下面两屏（"改进"要先判 Grok 的译文再重译，
  // 慢，往下多留一屏）、左右各半屏以内的帖子都算"快要看到"；以前只看下面 1600 像素，往回滚、从中间打开的页面上面那些不翻
  const near = new Set();
  const io = new IntersectionObserver((es) => {
    for (const e of es) { if (e.isIntersecting) near.add(e.target); else near.delete(e.target); }
  }, { rootMargin: "100% 50% 200% 50%" });
  const watched = new WeakSet();

  const RETRY_MS = 30000, JOBS_MAX = 2000;
  // 失败了 30 秒后再试一次，还不行这一页就不管这条了
  const failed = (job) => { job.state = "error"; job.retryAt = job.retries < 1 ? Date.now() + RETRY_MS : 0; job.retries++; };
  function newJob(kind, id, tt, extra = {}) {
    const key = jobKey(kind, id);
    const prev = jobs.get(key);
    const job = { kind, sig: tt.textContent, state: "pending", result: null, showOurs: prev ? prev.showOurs : true, retries: prev?.retries || 0, retryAt: 0, ...extra };
    jobs.delete(key);
    jobs.set(key, job);
    // 最多记 JOBS_MAX 条（0.28.9，review：首页刷一晚上，每条帖子的原文、译文都攒着）：最早的、不在做的先丢
    if (jobs.size > JOBS_MAX) for (const [k, j] of jobs) { if (jobs.size <= JOBS_MAX) break; if (j.state !== "pending") jobs.delete(k); }
    return [key, job];
  }
  function finish(key, job, r) {
    if (jobs.get(key) !== job) return; // 期间设置变了、任务被清掉
    if (r.error) {
      if (stopFor(r.code)) job.state = "error";
      else if (r.code === "cancelled") jobs.delete(key); // 设置刚变：按新设置马上重做
      else failed(job);
      return;
    }
    job.state = "done";
    job.result = r;
  }
  async function processImprove(a, id, tt) {
    const [key, job] = newJob("improve", id, tt);
    inflight++;
    try {
      let source, xText, srcLang;
      const long = !!moreOf(a), shown = norm(textOf(tt));
      // 先问页面数据：X 的译文（长帖是页面上那一截）和屏幕上显示的对得上，原文就用它，不用去点按钮
      const d = await askPage(id);
      if (jobs.get(key) !== job) return;
      const data = d && !d.missing && d.source && d.translation && norm(long ? d.preview : d.translation) === shown ? d : null;
      if (data) {
        ({ source, srcLang } = data);
        xText = long ? data.translation : textOf(tt); // 长帖：按完整译文判
        Object.assign(job, { links: data.links || {}, ...(long ? { fullNorm: norm(data.translation) } : {}) });
      } else if (long) {
        job.state = "skip"; return; // 长帖只显示了一截、又读不到对得上的全文：等你展开了再处理
      } else {
        xText = textOf(tt);
        const orig = await readOriginal(a);
        if (jobs.get(key) !== job) return;
        if (!orig) { failed(job); return; } // 没切过去或没切回来（比如帖子正好被虚拟列表换掉）
        ({ source, srcLang } = orig);
      }
      if (!source || source === xText || source.length > MAX_LEN || xText.length > MAX_LEN) { job.state = "skip"; return; }
      job.tags = tagsOf(source);
      const ar = a.getBoundingClientRect(), onScreen = ar.bottom > 0 && ar.top < (innerHeight || 800); // 不在屏幕上的（提前做的）才走 flex（0.29.9）
      finish(key, job, await send({ type: "translate", id, source, xText, srcLang, target: target(), flex: !onScreen }));
    } finally {
      inflight--;
      scheduleRender();
    }
  }
  async function processFill(a, id, tt, lang) {
    const [key, job] = newJob("fill", id, tt, { lang });
    inflight++;
    try {
      let source = textOf(tt), truncated = false;
      if (moreOf(a)) {
        // X 只显示了一截：完整原文从页面数据里拿（露出来那截得是它的开头），翻出来的就是全文
        const d = await askPage(id);
        if (jobs.get(key) !== job) return;
        if (d && !d.missing && d.source && norm(d.source).startsWith(norm(textOf(tt)))) {
          source = d.source;
          Object.assign(job, { fullNorm: norm(d.source), links: d.links || {} });
        } else if (!thread.expanded.has(id)) {
          // 读不到：替你点开"显示更多"，下一轮按展开后的全文翻
          thread.expanded.add(id);
          jobs.delete(key);
          moreOf(a)?.click();
          return;
        } else truncated = true; // 点开了还是一截：只好翻露出来的这截
      }
      if (!/\p{L}/u.test(source) || source.length > MAX_LEN) { job.state = "skip"; return; }
      job.tags = tagsOf(source);
      const ar = a.getBoundingClientRect(), shown = ar.bottom > 0 && ar.top < (innerHeight || 800); // 不在屏幕上的走 flex（见 translator.js）
      finish(key, job, await send({ type: "translateFill", id, source, srcLang: lang, truncated, target: target(), flex: !shown }));
    } finally {
      inflight--;
      scheduleRender();
    }
  }
  // 正文还是这份：一样，或者是长帖从那一截展开成了我们判过的全文
  // 全文（页面数据里的，带表情）按 textOf 比：表情是 <img alt>，textContent 里没有（0.28.9，review：带表情的长帖在 Grok 版 / 原文点开"显示更多"后
  // 对不上，我们的块被撤掉、重做一遍——又付一次费，还把你选的"看 Grok 版"冲掉）
  const sameText = (job, tt) => tt.textContent === job.sig || (!!job.fullNorm && norm(textOf(tt)) === job.fullNorm);
  // 已经在做 / 做过而且正文没变 / 失败了还没到重试时间：跳过
  function busy(job, tt) {
    return !!job && (job.state === "pending" || (job.state === "error" && !(job.retryAt && Date.now() >= job.retryAt)) ||
      ((job.state === "done" || job.state === "skip") && sameText(job, tt)));
  }
  // 先做离视野近的：视野里的（从上往下），再是下面的（按距离），上面的距离多算一半（往下滚的多）。
  // 0.13.13 以前按从上往下排，往下滚了以后视野上面那一屏的排在眼前的前面
  function nearFirst(arts) {
    const vh = innerHeight || 800;
    const d = new Map(arts.map((a) => { const r = a.getBoundingClientRect();
      return [a, r.bottom >= 0 && r.top <= vh ? r.top / 1e4 : r.top > vh ? r.top - vh : -r.bottom * 1.5]; }));
    return arts.sort((x, y) => d.get(x) - d.get(y));
  }

  // 评论区那边（content.js）还在判这条（0.28.7，review）：先不翻，判出来清理了就省下这笔；最多等 HOLD_MAX（Jev 卡住也不至于一直不翻）
  const HOLD_MAX = 6000, held = new Map(); // 帖子 id → 第一次因为"还在判"跳过的时间
  function judging(id) {
    if ((globalThis.FFXVerdict ? globalThis.FFXVerdict(id) : null) !== "pending") { held.delete(id); return false; }
    if (!held.has(id)) { held.set(id, Date.now()); if (held.size > 500) held.delete(held.keys().next().value); }
    return Date.now() - held.get(id) < HOLD_MAX;
  }

  // arts：首页是整个时间线，帖子页是这条对话（到"发现更多"为止）
  function tickImprove(arts) {
    if (!onImprove) return;
    for (const a of nearFirst(arts.filter((x) => near.has(x)))) { // 离视口近的先做
      if (inflight >= MAX_INFLIGHT) break;
      const id = statusId(a), tt = ownText(a);
      if (!id || !tt || xState(a) !== "auto" || a.style.display === "none") continue; // 广告没有 id；没显示着 X 的译文；被评论区那边折叠了
      if (busy(jobs.get(jobKey("improve", id)), tt)) continue; // 译文变了才重做
      if (judging(id)) continue;
      processImprove(a, id, tt);
    }
  }

  // 帖子页：哪些作者的帖子 X 翻译过（只看主帖和它上面的原帖），记到离开这个帖子为止（主帖被虚拟列表卸载了也照样用）。
  // seen：每条帖子第一次看到时 X 的翻译状态（auto 自动翻了 / demand 能按需翻 / off 切回了原文 / none 没有）；clicked：替你点过"显示翻译"的；
  // expanded：读不到页面数据、替你点过"显示更多"的
  // firstAt：每条第一次看到的时间（补翻先等 FILL_WAIT，见 tickFill）
  const FILL_WAIT = 1500;
  let thread = { pid: null, authors: new Set(), seen: new Map(), firstAt: new Map(), clicked: new Set(), expanded: new Set() };
  function conversation(root, pid) {
    if (thread.pid !== pid) thread = { pid, authors: new Set(), seen: new Map(), firstAt: new Map(), clicked: new Set(), expanded: new Set() };
    const arts = [];
    for (const cell of X.cells(root)) {
      const a = cell.querySelector(ART);
      if (!a) { if (X.isSectionHeader(cell)) break; continue; } // 分段标题（"发现更多"之类，什么语言都行）
      if (!X.inLayers(a)) arts.push(a);
    }
    const focal = arts.findIndex((a) => statusId(a) === pid);
    for (let i = 0; i <= focal; i++) {
      const who = authorOf(arts[i]);
      if (who && translatedByX(arts[i])) thread.authors.add(who);
    }
    return arts;
  }
  function tickFill(arts) {
    if (!onFill || !thread.authors.size) return;
    for (const a of nearFirst(arts.filter((x) => near.has(x)))) {
      const id = statusId(a), tt = ownText(a);
      if (a.style.display === "none") continue; // 被评论区那边折叠了（你标的）：看不见，不翻
      if (!id || !tt || !thread.authors.has(authorOf(a))) continue;
      const cur = xState(a);
      const prev = thread.seen.get(id);
      if (!prev || (prev === "none" && cur === "demand")) thread.seen.set(id, cur); // X 晚一点才挂出"显示翻译"按钮也算按需
      if (!thread.firstAt.has(id)) thread.firstAt.set(id, Date.now());
      const lang = X.textLang(tt);
      // X 能翻但没自动翻：替你点一次"显示翻译"。只点第一次看到就是这样的；你自己切回原文的不点，点过的不再点
      if (cur === "demand" && thread.seen.get(id) === "demand" && !thread.clicked.has(id) && foreign(lang)) { thread.clicked.add(id); xToggle(a)?.click(); continue; }
      if (translatedByX(a) || thread.clicked.has(id)) continue;
      if (inflight >= MAX_INFLIGHT) break;
      if (!foreign(lang) || busy(jobs.get(jobKey("fill", id)), tt)) continue; // 展开"显示更多"后正文变了：重翻
      if (judging(id)) continue; // 先问（等判的钟从第一次看到算起）
      // 刚看到、X 还没挂出翻译那一行的先等一等（0.28.9，review：X 晚一两秒才挂出"显示翻译"，插件已经付费翻了，接着又替你点了 X 的翻译、
      // 插件的那份作废，还要再付一次改进的判分）
      if (cur === "none" && Date.now() - thread.firstAt.get(id) < FILL_WAIT) continue;
      processFill(a, id, tt, lang);
    }
  }

  function tick() {
    if (!alive()) { stop(); return; }
    if (creditStop && Date.now() - creditStop > CREDIT_RETRY) { creditStop = 0; clearErrors(); loadSettings(); }
    const pg = page();
    if (!pg) return;
    const root = X.column();
    for (const a of root.querySelectorAll(ART)) {
      if (!watched.has(a)) { watched.add(a); io.observe(a); }
    }
    for (const a of near) if (!a.isConnected) { near.delete(a); io.unobserve(a); }
    renderAll();
    if (document.hidden) return;
    if (pg.kind === "status") { const arts = conversation(root, pg.pid); tickImprove(arts); tickFill(arts); }
    else tickImprove([...root.querySelectorAll(ART)]);
  }

  // ---------- 画出来 ----------
  const SPARK = '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>';
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // 我们的译文转成节点：链接、@账号、#话题、$代码能点（不用 innerHTML，模型输出当纯文字处理）。
  // #话题 的字和 X 认的一样（twitter-text：字母、附加符号、数字、下划线和几个连接符，全角＃也算，光是数字不算）
  const TOKEN_RE = /(https?:\/\/[^\s<>"“”'‘’（）()]+|(?<![\w@])@[A-Za-z0-9_]{1,15}|(?<![\w#＃&])[#＃][\p{L}\p{M}\p{N}_‌‍꙾־׳״～〜゛゜゠・〃་༌·]+|(?<![\w$])\$[A-Za-z]{1,6}\b)/gu;
  const isTag = (tok) => (tok[0] === "#" || tok[0] === "＃") && /[\p{L}\p{M}]/u.test(tok);
  const tagsOf = (text) => [...String(text || "").matchAll(TOKEN_RE)].map((m) => m[0]).filter(isTag);
  // 译文里的 #话题 点了要搜原文的那个话题，不是译出来的字（0.29.3，用户报：日文帖子 #アリ… 译成 #蚂蚁…，点了搜的是中文、搜不到这条）。
  // 原样留着的（不分大小写）直接对上；剩下的按先后一一对上；剩下的个数对不上就不知道哪个是哪个，只显示字、不做成链接
  function tagTargets(mine, orig) {
    const key = (s) => s.slice(1).toLowerCase(), used = new Set(), out = mine.map(() => null);
    mine.forEach((t, i) => { const j = orig.findIndex((o, j) => !used.has(j) && key(o) === key(t)); if (j >= 0) { used.add(j); out[i] = orig[j]; } });
    const restMine = out.flatMap((o, i) => (o ? [] : [i])), restOrig = orig.filter((_, j) => !used.has(j));
    if (restMine.length === restOrig.length) restMine.forEach((i, n) => { out[i] = restOrig[n]; });
    return out;
  }
  function linkified(text, hrefs, tags) {
    const frag = document.createDocumentFragment();
    const ms = [...text.matchAll(TOKEN_RE)];
    const dest = tagTargets(ms.map((m) => m[0]).filter(isTag), tags || []);
    let last = 0, k = 0;
    for (const m of ms) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      const tok = m[0];
      last = m.index + tok.length;
      let tag = null;
      if (tok[0] === "#" || tok[0] === "＃") {
        if (isTag(tok)) tag = dest[k++];
        if (!tag) { frag.append(tok); continue; } // 光是数字（X 也不认）、对不上原文的话题：只显示字
      }
      const a = el("a", "ff-tx-link", tok);
      if (tok.startsWith("http")) {
        const key = tok.replace(/^https?:\/\//, "").replace(/…$/, "");
        const h = hrefs.get(key);
        a.href = typeof h === "string" && /^https?:\/\//i.test(h) ? h : tok.replace(/…$/, ""); // 只认 http(s)（页面数据是页面那边给的，别信别的协议）
        a.target = "_blank"; a.rel = "noopener noreferrer";
      } else if (tok[0] === "@") a.href = `/${tok.slice(1)}`;
      else if (tag) a.href = `/hashtag/${encodeURIComponent(tag.slice(1))}`;
      else a.href = `/search?q=${encodeURIComponent(tok)}`;
      a.addEventListener("click", (ev) => ev.stopPropagation(), true); // 别让 X 当成点了整条帖子
      frag.append(a);
    }
    if (last < text.length) frag.append(text.slice(last));
    return frag;
  }
  function build(a, tt, job) {
    // X 原来那条正文里的链接：显示文字 → 真实地址（t.co），我们译文里的同一个链接照样跳过去
    const hrefs = new Map([...Object.entries(job.links || {}),
      ...[...tt.querySelectorAll("a[href]")].map((x) => [(x.textContent || "").replace(/\s+/g, "").replace(/^https?:\/\//, "").replace(/…$/, ""), x.href])]);
    const fill = job.kind === "fill";
    const block = el("div", fill ? "ff-tx ff-tx-fill" : "ff-tx");
    block.lang = target(); // 译文和说明都是界面语言
    const body = el("div", "ff-tx-text");
    body.dir = "auto"; // 和 X 的正文一样：阿拉伯语这类从右往左排，夹着的英文链接也不乱
    const cs = getComputedStyle(tt);
    for (const p of ["fontFamily", "fontSize", "lineHeight", "color", "fontWeight", "letterSpacing"]) body.style[p] = cs[p];
    body.append(linkified(job.result.text, hrefs, job.tags));
    const note = el("div", "ff-tx-note");
    const model = job.result.model || t("tx.model");
    note.title = fill ? t("tx.titleFill", { model })
      : t("tx.titleImprove", { model }); // 0.29.8 起不写分数（用户 10-21：用户看不懂，也不会拿它做什么）
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24"); icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = SPARK; // 固定图形
    const label = el("span", "ff-tx-label");
    const toggle = el("button", "ff-tx-toggle");
    toggle.type = "button";
    toggle.addEventListener("click", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      job.showOurs = !job.showOurs;
      render(a);
    }, true);
    note.append(icon, label, toggle);
    // 补翻的说明放在正文上面（和 X 自己的"翻译自 英语"一样），改进的放下面（上面已经有 X 那一行了）
    if (fill) block.append(note, body); else block.append(body, note);
    // 点译文、说明行和点 X 自己的正文一样交给 X（首页会点开帖子；选着字时 X 自己不跳）。只有切换按钮和链接拦下，见上面
    return block;
  }
  function labels(job) {
    if (job.kind === "fill") {
      const lang = (job.lang && langName(job.lang)) || t("tx.someLang");
      return job.showOurs ? [t("tx.filled", { lang }), t("tx.seeOriginal")] : [t("tx.original", { lang }), t("tx.seeTranslation")];
    }
    // 只说"改进的翻译"，不点评 Grok 哪里不好（用户裁定；鼠标停上去还能看到 Jev 给两边的分）
    return job.showOurs ? [t("tx.improved"), t("tx.seeGrok")] : [t("tx.isGrok"), t("tx.seeImproved")];
  }
  const hide = (e) => { if (e.style.display !== "none") e.style.display = "none"; e.dataset.ffTxHidden = "1"; };
  const unhide = (e) => { if (e && e.dataset.ffTxHidden) { e.style.display = ""; delete e.dataset.ffTxHidden; } };
  function render(a) {
    const pg = page();
    const id = statusId(a), tt = ownText(a), more = moreOf(a);
    let block = a.querySelector(".ff-tx");
    // 这条现在归哪种：X 翻译过的看"改进"，没翻的看"补翻"（补翻只在帖子页）
    const kind = !pg || !id ? null : translatedByX(a) ? "improve" : pg.kind === "status" ? "fill" : null;
    const key = kind && jobKey(kind, id);
    const job = key && jobs.get(key);
    // 改进：X 现在显示的是这份 Grok 译文（不是原文、也没换成别的译文；长帖展开成全文也算），而且我们的更好；
    // 补翻：正文还是我们翻的那份原文，X 也没自己翻（比如你点了 X 的翻译）
    const active = !!(job && job.result && tt) && sameText(job, tt) && (kind === "fill"
      ? job.result.action === "fill" : job.result.action === "replace" && xState(a) === "auto");
    if (!active) {
      if (block) block.remove();
      if (tt) unhide(tt);
      if (more) unhide(more);
      return;
    }
    if (!block || block.dataset.ffFor !== key) {
      if (block) block.remove();
      block = build(a, tt, job);
      block.dataset.ffFor = key;
      if (job.kind === "fill") tt.before(block); else tt.after(block);
    }
    shownHere(job.kind).add(id);
    const [label, toggle] = labels(job);
    // 一样的不重写（0.28.9，review：每一轮都重写，评论区那边当成页面变了、每秒多扫一遍）
    const textEl = block.querySelector(".ff-tx-text"), labelEl = block.querySelector(".ff-tx-label"), toggleEl = block.querySelector(".ff-tx-toggle");
    if (textEl.hidden !== !job.showOurs) textEl.hidden = !job.showOurs;
    if (labelEl.textContent !== label) labelEl.textContent = label;
    if (toggleEl.textContent !== toggle) toggleEl.textContent = toggle;
    // 我们的是全文（按页面数据里的全文翻的）：X 的"显示更多"没用了，藏起来；切回 X 的版本再露出来
    if (job.showOurs) { hide(tt); if (more && job.fullNorm) hide(more); }
    else { unhide(tt); if (more) unhide(more); }
  }
  // 弹窗问"这个页面"时报：这一页换上过几条改进的译文、补翻过几条（按网址分开记，同一条只算一次）
  const shown = new Map();
  function shownHere(kind) {
    const k = location.pathname;
    if (!shown.has(k)) { shown.set(k, { improve: new Set(), fill: new Set() }); if (shown.size > 50) shown.delete(shown.keys().next().value); }
    return shown.get(k)[kind];
  }
  globalThis.FFTxSummary = () => {
    const s = shown.get(location.pathname);
    return { improved: s ? s.improve.size : 0, filled: s ? s.fill.size : 0, on: onImprove || onFill };
  };
  function renderAll() {
    const root = X.column();
    for (const a of root.querySelectorAll(ART)) {
      const id = statusId(a);
      if (a.querySelector(".ff-tx") || (id && (jobs.has(jobKey("improve", id)) || jobs.has(jobKey("fill", id))))) render(a);
    }
  }

  // 你点了 X 的"显示原文"/"显示翻译"/"显示更多"、帖子被虚拟列表重新挂上来：马上重画，不等下一秒
  let raf = 0;
  function scheduleRender() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; if (alive()) renderAll(); });
  }
  const ours = (n) => n.nodeType === 1 && n.classList.contains("ff-tx");
  const observer = new MutationObserver((muts) => {
    if (!alive()) { observer.disconnect(); return; }
    if (!jobs.size) return;
    for (const m of muts) {
      if (m.target.closest?.(".ff-tx")) continue;
      if ([...m.addedNodes, ...m.removedNodes].every(ours)) continue; // 只是我们自己插的块进出
      scheduleRender();
      return;
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  let tickT = null;
  function stop() { clearInterval(tickT); tickT = null; io.disconnect(); observer.disconnect(); }
  try {
    chrome.storage.onChanged.addListener((ch) => {
      if (ch.ff_keys) { creditStop = 0; clearErrors(); } // 换了 key（0.28.12 起看 ff_keys）：因为 key 停下、出错的帖子重新来（0.28.9 以前这一页一直不再试）
      if (ch.ff_settings || ch.ff_keys || ch.ff_key || ch.ff_or_key) loadSettings();
    });
  } catch (e) { /* 插件刚重载 */ }
  loadSettings().then(() => { tickT = setInterval(tick, TICK); tick(); });
})();
