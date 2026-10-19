// X 页面探针：在登录的真 X 页面上，逐项核对插件读页面的每一条依赖（xdom.js）还对不对。X 改版后先跑它，几分钟就知道哪里坏了。
// 用法：在 x.com 打开首页（/home）、用户主页（/账号）、搜索结果（/search?q=…）或某个帖子页（/用户/status/数字），往下滚几屏让帖子和回复加载出来，打开开发者工具的控制台，
// 把 test/x_probe.js 的内容整个粘进去回车。结果打印成一张表（正常 / 注意 / 失效 / 无从判断），也作为返回值（自动化时用）。
// 装着插件（0.10 以后）时还会查页面数据：插件有没有听到 X 的接口返回、每条 X 翻译了的帖子数据对不对得上。
// 只读：不点、不改页面、不发请求。
// test/x_probe.js 由 test/build_probe.py 用这个文件和 xdom.js 拼出来（读法和插件是同一份），别手改那个文件。
(async () => {
  // xdom.js 拼在这里，放进一个局部的 globalThis：用的就是这份读法，不管页面里有没有、是哪个版本的插件
  const FFX = (() => { const globalThis = {}; /*XDOM*/ return globalThis.FFX; })();
  const rows = [];
  const add = (area, check, result, note = "") => rows.push({ 区域: area, 检查: check, 结果: result, 说明: note });
  const ratio = (n, d) => `${n}/${d}`;
  // 占比到 good 算正常，有一些算注意，一个都没有算失效
  const grade = (n, d, good = 0.8) => (!d ? "无从判断" : n / d >= good ? "正常" : n ? "注意" : "失效");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (t) => String(t || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, "");

  const route = FFX.route();
  add("页面", "网址", route.kind === "other" ? "注意" : "正常",
    `${location.pathname} → ${route.kind}${route.pid ? " " + route.pid : ""}${route.kind === "other" ? "（在首页 /home、用户主页 /账号、搜索结果 /search?q=… 或帖子页 /用户/status/数字 上才查得全）" : ""}`);
  const ui = FFX.uiLang();
  add("页面", "界面语言 <html lang>", document.documentElement.lang ? "正常" : "失效", document.documentElement.lang || "没有：插件只好按浏览器语言猜");
  add("页面", "中间那栏 primaryColumn", document.querySelector(FFX.SEL.column) ? "正常" : "失效", "");
  add("页面", "深浅色主题（看页面底色）", "正常", `${getComputedStyle(document.body).backgroundColor} → ${FFX.darkTheme() ? "深色" : "浅色"}`);

  const arts = [...FFX.column().querySelectorAll(FFX.SEL.article)].filter((a) => !FFX.inLayers(a));
  add("帖子", "帖子 article[data-testid=tweet]", arts.length ? "正常" : "失效", `${arts.length} 条${arts.length ? "" : "：插件什么都认不出来了（X 改了帖子的标记）"}`);
  const n = arts.length;
  if (n) {
    // 广告没有帖子链接、发帖时间，不算在里面
    const posts = arts.filter((a) => !FFX.isAd(a)), withId = arts.filter((a) => FFX.statusId(a)), ids = withId.length;
    const linked = posts.filter((a) => FFX.statusId(a)).length, timed = posts.filter((a) => FFX.postTime(a)).length;
    add("帖子", "帖子链接（/status/数字，里面有 <time>）", grade(linked, posts.length), `${ratio(linked, posts.length)}（不算广告）`);
    add("帖子", "发帖时间 <time datetime>", grade(timed, posts.length), `${ratio(timed, posts.length)}（不算广告）`);
    const withUN = arts.filter((a) => a.querySelector(FFX.SEL.userName)).length;
    add("帖子", "作者那一栏 User-Name", grade(withUN, n), ratio(withUN, n));
    const handles = arts.filter((a) => FFX.author(a).handle).length;
    add("帖子", "作者那一栏里按行认出 @账号", grade(handles, n), `${ratio(handles, n)}（评论区判定、Jev 请求用它）`);
    const aids = arts.filter((a) => FFX.authorId(a)).length;
    add("帖子", "作者链接 /账号", grade(aids, n), `${ratio(aids, n)}（帖子页补翻认作者用它）`);
    const texts = arts.filter((a) => FFX.textEl(a));
    add("帖子", "正文 tweetText", grade(texts.length, n, 0.5), `${ratio(texts.length, n)}（只有图、视频的帖子没有）`);
    const langs = texts.filter((a) => FFX.textLang(FFX.textEl(a))).length;
    add("帖子", "正文的 lang 属性", grade(langs, texts.length), ratio(langs, texts.length));
    const carets = arts.filter((a) => a.querySelector(FFX.SEL.caret)).length;
    add("帖子", "右上角的「…」按钮 caret", grade(carets, n), ratio(carets, n));
    const multi = arts.filter((a) => a.querySelectorAll(FFX.SEL.userName).length > 1);
    const quoted = multi.filter((a) => FFX.quoteCard(a)).length;
    add("帖子", "引用卡片（role=link 里有作者栏）", !multi.length ? "无从判断" : quoted === multi.length ? "正常" : "注意",
      multi.length ? `带引用的 ${multi.length} 条里认出 ${quoted} 条` : "页面上没有带引用的帖子");
    const media = arts.filter((a) => FFX.hasMedia(a)).length;
    add("帖子", "图片 / 视频", media ? "正常" : "无从判断", `${media} 条带图或视频`);
    const adWrap = arts.filter((a) => a.closest(FFX.SEL.adWrap)).length, adText = arts.filter((a) => FFX.adLabel(a)).length;
    add("帖子", "广告（整条包在 placementTracking 里 / 有「广告」字样）", adWrap === adText ? (adWrap ? "正常" : "无从判断") : "注意",
      `包着的 ${adWrap} 条，带字样的 ${adText} 条${adWrap !== adText ? "：两种认法对不上，看看是不是 X 改了广告的样子" : ""}`);

    // ---------- X 的自动翻译 ----------
    const states = { auto: 0, off: 0, demand: 0, none: 0 };
    for (const a of arts) states[FFX.translationState(a, ui)]++;
    const foreignNoRow = texts.filter((a) => {
      const l = FFX.textLang(FFX.textEl(a));
      return l && !FFX.sameLang(l, ui) && !/^(und|zxx|q[a-t][a-z])$/.test(l) && FFX.translationState(a, ui) === "none";
    }).length;
    add("翻译", "翻译那一行（正文正上方、带按钮和图标）", states.auto + states.off + states.demand ? "正常" : "无从判断",
      `X 自动翻了的 ${states.auto}、切回原文的 ${states.off}、能按需翻的 ${states.demand}；外文却没认出翻译行的 ${foreignNoRow}` +
      (!states.auto && !states.off && !states.demand ? "（页面上没有被翻译的帖子；要查就去搜 lang:ja 之类的外文帖）" : ""));
    const autoArts = arts.filter((a) => FFX.translationState(a, ui) === "auto");
    const toggles = autoArts.filter((a) => FFX.translationToggle(a)).length;
    add("翻译", "翻译行里的切换按钮（显示原文）", grade(toggles, autoArts.length, 1), autoArts.length ? ratio(toggles, autoArts.length) : "");
    const more = arts.filter((a) => FFX.moreLink(a)).length;
    add("翻译", "长帖的「显示更多」", more ? "正常" : "无从判断", `${more} 条`);

    // ---------- 页面数据（长帖全文、X 的完整译文） ----------
    const stats = await new Promise((res) => {
      const timer = setTimeout(() => res(null), 600);
      document.addEventListener("ff-pd-stats-data", (e) => { clearTimeout(timer); res(JSON.parse(e.detail)); }, { once: true });
      document.dispatchEvent(new CustomEvent("ff-pd-stats"));
    });
    if (!stats) add("页面数据", "插件的 pagedata.js", "注意", "没回应：插件没装、版本早于 0.10，或者装上插件后没刷新这个页面。下面只查 React 组件数据");
    else add("页面数据", "旁听 X 的接口返回", !stats.responses ? "注意" : stats.tweets ? "正常" : "失效",
      `听到 ${stats.responses} 份（XHR ${stats.xhr}、fetch ${stats.fetch}），记下 ${stats.tweets} 条帖子，解析出错 ${stats.errors}` +
      (!stats.responses ? "：一份都没听到——页面在插件装上之前就加载好了（刷新一下），或者 X 换了接口地址（xdom.js 的 API_URL）"
        : !stats.tweets ? "：听到了，却一条帖子都没认出来——X 改了接口里帖子的格式（xdom.js 的 isApiTweet / apiRecord）" : ""));
    const ask = (id) => new Promise((res) => {
      const timer = setTimeout(() => { document.removeEventListener("ff-tx-data", h); res(null); }, 600);
      const h = (e) => { const d = JSON.parse(e.detail); if (d.id === id) { clearTimeout(timer); document.removeEventListener("ff-tx-data", h); res(d); } };
      document.addEventListener("ff-tx-data", h);
      document.dispatchEvent(new CustomEvent("ff-tx-ask", { detail: id }));
    });
    // 插件就是这么用页面数据的：X 的译文（长帖是页面上那一截）和屏幕上显示的对得上才用
    const tally = { net: 0, fiber: 0, missing: 0, mismatch: 0 }, offIds = [];
    for (const a of autoArts.slice(0, 25)) {
      const id = FFX.statusId(a);
      if (!id) continue;
      let d = stats ? await ask(id) : null;
      if (!stats) { // 插件不在：探针自己读 React 组件数据
        const t = FFX.fiberTweet(a, id), rec = t && FFX.fiberRecord(t);
        d = rec && rec.tr ? { src: "fiber", translation: rec.tr.text, preview: rec.tr.preview } : null;
      }
      if (!d || d.missing || !d.translation) { tally.missing++; continue; }
      const long = !!FFX.moreLink(a);
      if (norm(long ? d.preview : d.translation) !== norm(FFX.textOf(FFX.textEl(a)))) { tally.mismatch++; offIds.push(id); continue; }
      tally[d.src]++;
    }
    const checked = Object.values(tally).reduce((x, y) => x + y, 0), good = tally.net + tally.fiber;
    // 一条都没有：插件在听、也听到了接口返回，那就是 X 改了数据格式（失效）；插件没在听（没装、没刷新），说不准
    add("页面数据", "X 翻译了的帖子：页面数据有没有、和屏幕上对不对得上",
      !checked ? "无从判断" : good === checked ? "正常" : good ? "注意" : stats && stats.responses ? "失效" : "注意",
      checked ? `查了 ${checked} 条：来自接口 ${tally.net}、来自组件数据 ${tally.fiber}、没有 ${tally.missing}、对不上 ${tally.mismatch}${offIds.length ? `（${offIds.slice(0, 3).join("、")}）` : ""}。` +
        "没有或对不上的，插件会退回点「显示原文」读（长帖等你展开）" : autoArts.length ? "X 自动翻了的都是广告（插件不管广告）" : "页面上没有 X 自动翻译的帖子");
    const fib = arts.filter((a) => FFX.statusId(a) && FFX.fiberTweet(a, FFX.statusId(a))).length;
    add("页面数据", "React 组件数据（__reactFiber$ → tweet，后备）", grade(fib, ids), `${ratio(fib, ids)}` +
      (ids && !fib ? "：读不到了，React 内部变了，这条后备没了（接口那条不受影响）" : ""));

  }

  // ---------- 用户主页、搜索结果：时间线上的帖子都判（你自己的主页不判，你自己发的不折） ----------
  if (route.kind === "profile" || route.kind === "search") {
    const area = route.kind === "profile" ? "用户主页" : "搜索结果";
    const self = FFX.selfHandle();
    add(area, "你自己的账号（左边栏「个人资料」链接）", self ? "正常" : "注意",
      !self ? "认不出：插件分不清哪些是你自己发的（你的主页、你的帖子也会判；xdom.js 的 SEL.selfLink）"
        : `@${self}${route.kind === "profile" && self === route.user ? "：这是你自己的主页，插件只改进翻译、不折叠" : "：你发的不折"}`);
    if (route.kind === "profile") {
      const name = FFX.profileName();
      add(area, "主页主人的名字（顶上的 UserName）", name ? "正常" : "注意", name ? `${name}（@${route.user}，告诉 Jev 这是谁的主页）` : "认不出：照样判，只是少了名字");
    } else add(area, "搜的词", route.query ? "正常" : "注意", route.query ? `「${route.query.slice(0, 30)}」：换个词就是新的一页` : "网址里没有 q=…：插件不知道这是哪次搜索，不判");
    const first = arts.find((a) => FFX.statusId(a));
    const root = first && FFX.timelineOf(first);
    add(area, "时间线（帖子所在的那一块）", !arts.length ? "无从判断" : root ? "正常" : "失效", !arts.length ? "这一页没有帖子（比如「媒体」「用户」标签）" : "");
    if (root) {
      const posts = [...FFX.cells(root)].map((c) => c.querySelector(FFX.SEL.article)).filter((a) => a && !FFX.isAd(a));
      const parsed = posts.filter((a) => FFX.author(a).handle && FFX.statusId(a)).length;
      const owner = route.kind === "profile" ? route.user : self;
      const own = posts.filter((a) => owner && FFX.authorId(a) === owner).length;
      add(area, "帖子的账号和 id", grade(parsed, posts.length), `${ratio(parsed, posts.length)}；` + (route.kind === "profile"
        ? `主人自己的 ${own} 条，别人的（转帖、他回复的那条）${posts.length - own} 条` : `你自己发的 ${own} 条（不折）`));
    }
  }

  // ---------- 帖子页：评论区 ----------
  if (route.kind === "status" && !route.media) {
    const focal = arts.find((a) => FFX.statusId(a) === route.pid);
    // 往下滚远了，X 会把主帖从页面上卸掉（只留看得见附近的几十格）：这不算失效
    const far = !focal && scrollY > innerHeight;
    add("评论区", "主帖（链接里的 id 和网址一样）", focal ? "正常" : far ? "注意" : "失效",
      focal ? "" : far ? "主帖不在页面上（往下滚远了，X 把它卸掉了）：滚回顶部再跑一次" : "找不到：插件认不出这条对话");
    const root = focal && FFX.timelineOf(focal);
    add("评论区", "主帖所在的那块时间线", root ? "正常" : "失效", "");
    if (root) {
      const cells = [...FFX.cells(root)];
      const kinds = cells.map((c) => (c.querySelector(FFX.SEL.article) ? "A" : FFX.isSectionHeader(c) ? "H" : "c"));
      const at = cells.findIndex((c) => c.contains(focal));
      const firstH = kinds.findIndex((k, i) => i > at && k === "H");
      const before = kinds.slice(at + 1, firstH < 0 ? undefined : firstH).filter((k) => k === "A").length;
      const after = firstH < 0 ? 0 : kinds.slice(firstH + 1).filter((k) => k === "A").length;
      add("评论区", "格子 cellInnerDiv", cells.length ? "正常" : "失效", `${cells.length} 格`);
      add("评论区", "回复（主帖后面、第一个分段标题之前）", before ? "正常" : "注意",
        `${before} 条${!before ? "：一条回复都没算进来——往下滚一点再跑；还是 0 就看下面分段标题那条" : ""}`);
      add("评论区", "分段标题（「发现更多」之类，到这里就不算这条对话了）", firstH < 0 ? "无从判断" : before ? "正常" : "注意",
        firstH < 0 ? "还没滚到" : `第 ${firstH + 1} 格：「${(cells[firstH].textContent || "").trim().slice(0, 20)}」，后面还有 ${after} 条帖子不算` +
          (!before && after ? "——标题出现在所有回复前面，可能认错了（xdom.js 的 isSectionHeader）" : ""));
      const replies = cells.slice(at + 1, firstH < 0 ? undefined : firstH).map((c) => c.querySelector(FFX.SEL.article)).filter((a) => a && !FFX.isAd(a));
      const parsed = replies.filter((a) => FFX.author(a).handle && FFX.statusId(a)).length;
      add("评论区", "回复的账号和 id", grade(parsed, replies.length), replies.length ? `${ratio(parsed, replies.length)}（不算插在回复里的广告）` : "");
    }
  }

  // ---------- 「…」菜单（要先点开一条帖子右上角的「…」再跑才查得到） ----------
  const dd = document.querySelector(`${FFX.SEL.layers} ${FFX.SEL.dropdown}`) || document.querySelector(`${FFX.SEL.layers} [role="menu"]`);
  add("菜单", "「…」菜单和里面的选项 menuitem", !dd ? "无从判断" : FFX.menuTemplate(dd) ? "正常" : "注意",
    !dd ? "点开一条帖子右上角的「…」再跑一次" : FFX.menuTemplate(dd) ? "插件加的那一项会照原生选项的样子" : "认不出原生选项：插件那一项会用自己的朴素样式");

  const bad = rows.filter((r) => r.结果 === "失效").length, warn = rows.filter((r) => r.结果 === "注意").length;
  const summary = bad ? `${bad} 项失效、${warn} 项要注意：X 可能改版了，对照上面的说明改 xdom.js` : warn ? `没有失效的，${warn} 项要注意` : "全部正常";
  console.log(`%cfeed-filter 页面探针（${new Date().toLocaleString()}）：${summary}`, "font-weight:bold");
  console.table(rows);
  return { summary, rows };
})();
