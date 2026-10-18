// 翻译引擎（Reddit、Hacker News……共用，0.14 从 rtranslate.js 抽出来；X 的翻译另在 translate.js）：
// 和你的界面语言不是一种文字的内容，插件直接翻（OpenRouter，不调 Jev；和 X 帖子页的"补翻"同一条后台），都在原位置换成译文，
// 说明"✦ 翻译自英语 · 看原文"，点"看原文"切回原文。每个站点只写"读哪些、放哪儿"（site.scan / site.render / site.count），
// 别的都在这里：
// - 认文字（是不是外文、原文是什么语言）；长的切块（第一块 ≤300 字、别的 ≤800 字，翻好一块换上一块，没翻到的淡着、说明写"翻译中…"）；
// - 先查缓存（一页一次批量问，命中的马上换上）；只翻快要看到的（视野上下各一屏、左右各半屏以内），先翻眼前的，一页同时最多 16 个请求；
// - 短的几条拼一个请求（0.19.4：标题、短评论，每个请求最多 4 条、合计 1200 字，流式、先译完的先换上；真 HN 列表 30 个标题九成换上 8.5 秒 → 3.5 秒左右）；
// - 带格式翻（richtext.js：链接、加粗、列表、代码留着；标记弄乱了换后备模型再翻一次，还不行那一段退回纯文字）；
// - 几种原位置换（swapText 标题这类一段字、swapBox 纯文字的一格、swapRich 带格式的一格逐个孩子克隆、swapRichWhole 带格式的一格整个克隆）、
//   说明（placeNote 一行；placeIconNote 列表里只放一个 ✦ 按钮）。
// 插件放的东西都带 FFDom.OWN，原来的只是藏起来：FFDom.readText 跳过插件的东西，判垃圾读到的还是原文。
// 设置里总开关"翻译增强"开着、填了 OpenRouter key 才工作。结果后台按"内容 + 模型"缓存 30 天。
(() => {
  if (globalThis.FFTx) return;
  const R = globalThis.FFRich, Dm = globalThis.FFDom;
  const { t, langName } = globalThis.FFI18n;
  const OWN = Dm.OWN;
  const MAX_INFLIGHT = 16; // 一页同时最多几个请求（后台所有标签页一起也是 16 个；0.19.4 以前 8、0.13.13 以前 4）
  // 几条短的拼一个请求（0.19.4）：每个请求最多几条、合计多少字。真模型量的（GPT-6 Luna，同时 16 个）：标题 3–5 条一批最快，
  // 10 条以上一个请求生成得久、反而慢；评论 4 条 / 1200 字一批，40 条 13 秒（一条一个、同时 8 个）→ 5 秒
  const BATCH_N = 4, BATCH_CHARS = 1200;
  const SMALL = 500, FIRST = 300, CHUNK = 800, MAX_TOTAL = 16000; // ≤500 字一次翻；超过 16000 字的只翻前面这些
  const SCRIPTS = [["han", /\p{Script=Han}/u], ["kana", /[\p{Script=Hiragana}\p{Script=Katakana}]/u], ["hangul", /\p{Script=Hangul}/u],
    ["cyrillic", /\p{Script=Cyrillic}/u], ["arabic", /\p{Script=Arabic}/u], ["thai", /\p{Script=Thai}/u], ["devanagari", /\p{Script=Devanagari}/u],
    ["latin", /\p{Script=Latin}/u]];
  const WIDE = new Set(["han", "kana", "hangul"]); // 一个字顶三个字母（"求推荐 Python 入门书"算中文）
  const SCRIPT_OF = { zh: "han", ja: "kana", ko: "hangul", ru: "cyrillic", ar: "arabic", th: "thai", hi: "devanagari" };
  const LANG_OF = { han: "zh", kana: "ja", hangul: "ko", cyrillic: "ru", arabic: "ar", thai: "th", devanagari: "hi" };
  const SPARK = '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>';
  const STOP = ["disabled", "noorkey", "or_badkey", "or_credit"];
  const DROP = ["id", "title", "aria-describedby", "aria-labelledby", "aria-label", "data-testid", "data-ks-id", "data-ff-tx-hidden", "data-faceplate-tracking-context"];

  function start(site) {
    const alive = () => { try { return !!chrome.runtime.id; } catch (e) { return false; } };
    const send = (msg) => new Promise((resolve) => {
      try { chrome.runtime.sendMessage(msg, (r) => resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : r || {})); }
      catch (e) { resolve({ error: String(e) }); }
    });
    const target = () => (site.uiLang ? site.uiLang() : Dm.uiLang());
    // ---------- 认文字 ----------
    function mainScript(text) {
      const n = {};
      for (const ch of text.replace(/https?:\/\/\S+|\bu\/\w+|\br\/\w+/g, "")) for (const [k, re] of SCRIPTS) if (re.test(ch)) { n[k] = (n[k] || 0) + (WIDE.has(k) ? 3 : 1); break; }
      // 日文里汉字多，有两个以上假名就算日文——但汉字加假名得比别的文字多（0.27.5，用户 10-18 截图：一段英文的 YouTube 简介末尾一行
      // "キャンプ"标签，整段被当成日文，说明写"原文（日语）"；日文界面还会因此不翻）
      const cjk = (n.han || 0) + (n.kana || 0);
      if ((n.kana || 0) >= 6 && Object.entries(n).every(([k, v]) => k === "han" || k === "kana" || v <= cjk)) return "kana";
      return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    }
    const targetScript = () => SCRIPT_OF[target().toLowerCase().split("-")[0]] || "latin";
    // 光看文字就知道和界面不是一种语言：文字不一样（界面是中文、原文有假名的也算不一样）
    function scriptDiffers(s, ts) {
      if (ts === "han") return s !== "han";
      if (ts === "kana") return s !== "kana" && s !== "han";
      return s !== ts;
    }
    // 只有一种语言用的文字：和界面同一种文字就一定是界面语言，不用再认（韩文、泰文；有假名的就是日文）
    const ONLY = new Set(["hangul", "thai", "kana"]);
    // 候选（建任务、认语言）：认得出文字，而且不是"和界面同一种、只有一种语言用的文字"。翻不翻建任务时认了语言再定（detect 的 other）：
    // 0.28 起所有文字都先问浏览器，日文界面看全是汉字的中文、俄文界面看乌克兰文、阿拉伯文界面看波斯文这些"文字一样、语言不一样"的也翻
    // （以前按文字一律不翻）。0.25 以前拉丁字母之间一律不翻：西、葡、印尼、德、土这些界面的人，最想看懂的英文反倒不翻
    function foreign(text) {
      const s = mainScript(text);
      return !!s && !(s === targetScript() && ONLY.has(s));
    }
    // 原文是什么语言（建任务时先填上，认不准时用）：非拉丁字母的按文字认；拉丁字母的先当和帖子标的语言一样（没标就不写，说明里显示成"外语"）
    function guessLang(text, postLang) {
      const s = mainScript(text);
      if (s === "latin") return postLang && /^[a-z]{2}$/.test(postLang) && !SCRIPT_OF[postLang] ? postLang : null;
      return LANG_OF[s] || null;
    }
    // 原文是哪种语言（label，写说明用）、要不要翻（other）。0.28 起所有文字都先问浏览器（chrome.i18n.detectLanguage，Chrome 自带的
    // CLD，本机认、不联网）：认得准（isReliable、头一个 ≥ 70%）就用它（用户 10-18 定："所有文字都先问浏览器，认不准再去算"）。
    // x_multi 1118 条 X 回复（X 标的语言当真值）上量的：说明写的语言和以前一条不差；日文界面下中文回复漏翻 115 → 47；
    // 中、韩、英、西、印尼界面一条不变（jev_eval/code/langdetect/cld_compare.mjs）。
    // 拉丁字母的还只认主流的几种（MAIN）：浏览器"认得准"地说成加利西亚语、世界语、爪哇语、马达加斯加语、弗里斯兰语……的，多半是
    // 西班牙文、印尼文、英文认错了，当认不准。
    // 认不准的（短句子多半认不准）按文字算：非拉丁字母的按文字定语言、文字和界面不一样才翻；拉丁字母的先信帖子标的，帖子没标、
    // 浏览器猜英语 ≥90% 也算英语（实测短标题猜英语都对；猜别的会错，比如西班牙语猜成加泰罗尼亚语，就写"外语"）；界面不是拉丁字母
    // 的照翻，界面也是拉丁字母的：认不出的不翻、浏览器头一个猜的就是界面语言的也不翻（"¡Qué bueno!" 不准、猜西班牙语）。
    // 真 Chrome 在 X 上 766 条拉丁字母回复、HN 2809 条英文评论上量的（0.25）：不限主流语言时把界面语言的翻掉 17/751、HN 英文界面
    // 5 条，限了以后 2/751、1 条，别的拉丁字母语言翻到 74%（认不准也照浏览器头一个猜的翻能到 84%，但误翻多三倍，没用）
    // detecting：还在认的有几条（先查缓存那一步等它们认完再一起查，见 flushPre）
    const base = (l) => String(l || "").toLowerCase().split("-")[0];
    const ALIKE = { ms: "id", nb: "no", nn: "no" }; // 浏览器分不清的：印尼文常被认成马来文
    const sameLang = (a, b) => (ALIKE[base(a)] || base(a)) === (ALIKE[base(b)] || base(b));
    const MAIN = new Set(["en", "es", "pt", "fr", "de", "it", "nl", "pl", "tr", "id", "ms", "vi"]); // 界面支持的拉丁字母语言（加马来文）
    let detecting = 0;
    const detect = (text, hint, s) => new Promise((res) => {
      detecting++;
      const ui = target(), ts = targetScript();
      const done = (label, other) => { detecting--; res({ label, other }); };
      const byScript = (r) => { // 浏览器认不准：按文字算
        if (s !== "latin") return done(hint || LANG_OF[s] || null, scriptDiffers(s, ts));
        const top = r && r.languages && r.languages[0], code = top ? base(top.language) : "";
        const guess = /^[a-z]{2}$/.test(code) && !SCRIPT_OF[code] ? code : null; // 浏览器头一个猜的
        const label = hint || (guess === "en" && top.percentage >= 90 ? "en" : null);
        if (ts !== "latin") return done(label, true);
        done(label, !!label && !sameLang(label, ui) && !(guess && sameLang(guess, ui)));
      };
      try {
        chrome.i18n.detectLanguage(text.slice(0, 1000), (r) => {
          void chrome.runtime.lastError;
          const top = r && r.languages && r.languages[0], code = top ? base(top.language) : "";
          const sure = top && r.isReliable && top.percentage >= 70 && /^[a-z]{2,3}$/.test(code) && code !== "und" && !(s === "latin" && !MAIN.has(code));
          if (sure) return done(code, !sameLang(code, ui));
          byScript(r);
        });
      } catch (e) { byScript(null); } // 测试页、老浏览器没有这个接口
    });
    // 认出来和界面是同一种语言（或认不出、按文字也不用翻）的：键 → 当时的原文，下次扫到原文没变就不再认
    const sameUi = new Map();

    // ---------- 切块 ----------
    // 先按空行分段；比一块还长的段落按句子切，句子还太长就在空白处硬切。sep 是它和下一段之间原来的分隔：
    // "\n\n" 段落之间，" " 同一段里的句子之间（拼译文时，中日韩的不加空格）
    function units(text) {
      const out = [];
      const paras = text.split(/\n{2,}/);
      paras.forEach((p, pi) => {
        const psep = pi < paras.length - 1 ? "\n\n" : "";
        if (p.length <= CHUNK) { out.push({ text: p, sep: psep }); return; }
        const pieces = [];
        for (const sent of p.split(/(?<=[.!?。！？…])\s+/)) {
          for (let rest = sent; rest; ) {
            if (rest.length <= CHUNK) { pieces.push(rest); break; }
            const i = rest.lastIndexOf(" ", CHUNK);
            const at = i > CHUNK * 0.5 ? i : CHUNK;
            pieces.push(rest.slice(0, at));
            rest = rest.slice(at).trimStart();
          }
        }
        pieces.forEach((x, i) => out.push({ text: x, sep: i < pieces.length - 1 ? " " : psep }));
      });
      return out;
    }
    // 拼成块：第一块 ≤ FIRST（早点出来），别的 ≤ CHUNK；一段本身比上限长就单独一块
    function pack(us) {
      const chunks = [];
      let cur = null;
      for (const u of us) {
        if (cur && cur.text.length + cur.sep.length + u.text.length > (chunks.length ? CHUNK : FIRST)) { chunks.push(cur); cur = null; }
        cur = cur ? { text: cur.text + cur.sep + u.text, sep: u.sep } : { ...u };
      }
      if (cur) chunks.push(cur);
      return chunks;
    }
    const split = (text) => (text.length <= SMALL ? [{ text, sep: "" }] : pack(units(text)));

    // ---------- 任务 ----------
    // 一段字一个任务：评论的键是它的 id；帖子的标题、正文、列表里的摘要是 "id|t"、"id|b"、"id|p"（一个帖子可能只翻其中几段）。
    // 每个任务切成几块（短的就一块），块的状态：todo 没发、sending 在翻、done 翻好了、failed 出错等着重试、gave_up 试了三次放弃（照原文）
    let on = false, inflight = 0, hasAlt = false;
    const jobs = new Map(); // 键 → {key, id, lang, el, ready（认完语言、查完缓存了）, truncated, model, chunks: [{src, sep, state, text, tries}]}
    const showing = new Map(); // 评论 / 帖子的 id → false：你点了"看原文"
    const ours = (id) => showing.get(id) !== false;
    const finished = (job) => job.chunks.every((c) => c.state === "done" || c.state === "gave_up");
    // 能换上了：第一块翻好了（从上往下换，没翻到的照原文）。译出来和原文一字不差的（"Apple HomeView""GLM-Legal" 这种只有名字的标题）
    // 不换、不挂说明（0.14 以前也挂一个 ✦，点开看原文还是那几个字）
    const ready = (key) => { const j = jobs.get(key); return j && j.ready && j.chunks[0].state === "done" && !(j.chunks.length === 1 && j.chunks[0].same) ? j : null; };
    const KEYS = (id) => [id, `${id}|t`, `${id}|b`, `${id}|p`];
    // 这一条（评论，或者帖子的标题、正文、摘要）还有没翻完的；有哪一段已经换上了
    const busy = (id) => KEYS(id).some((k) => { const j = jobs.get(k); return j && !finished(j); });
    const has = (id) => !!id && KEYS(id).some((k) => ready(k));
    const progress = (job) => job.chunks.map((c) => c.state[0]).join("");
    async function loadSettings() {
      const r = await send({ type: "settings" });
      if (!r.settings) return;
      // 这个网站开着翻译（0.20 起和收起分开：可以只翻译、不收起；以前要总开关和翻译增强都开）
      const st = globalThis.FFSettings.forSite(r.settings, site.name);
      const now = !!(st.translate && r.hasOrKey);
      hasAlt = !!(st.translateFallback && st.translateFallback !== st.translateModel);
      if (now !== on) { on = now; if (!on) { jobs.clear(); showing.clear(); sameUi.clear(); renderAll(); } }
      tick();
    }
    // 离视野多远：视野里的最近（从上往下排），然后是下面的（按距离），上面的距离多算一半（往下滚的多）；不在页面上、藏起来了的最后
    function distanceOf(e) {
      if (!e || !e.isConnected) return 1e9;
      const r = e.getBoundingClientRect(), vh = innerHeight || 800;
      if (!r.width && !r.height) return 1e9 - 1;
      if (r.bottom >= 0 && r.top <= vh) return r.top / 1e4;
      return r.top > vh ? r.top - vh : -r.bottom * 1.5;
    }
    // 发请求：离视野近的任务先发，同一个任务按块的先后；空出来一个位置就发。短的块按先后几条拼成一个请求（sendBatch）：
    // 只拼只有一块的（标题、短评论）：切了块的长文本第一块要先单独出来；换后备模型重翻的、上次在批里没回来的（solo）、截断了的、
    // 太长的、正文里本来就有 <uN> 的也单独发
    const batchable = (job, c) => job.chunks.length === 1 && !c.alt && !c.solo && !job.truncated && c.src.length <= BATCH_CHARS && !/<\/?u\d+>/.test(c.src);
    function pump() {
      if (!on || !alive() || inflight >= MAX_INFLIGHT) return;
      const todo = [...jobs.values()].filter((j) => j.ready && j.chunks.some((c) => c.state === "todo"));
      if (todo.length > 1) { const d = new Map(todo.map((j) => [j, distanceOf(j.el)])); todo.sort((a, b) => d.get(a) - d.get(b)); }
      let batch = [], chars = 0;
      const room = () => inflight + (batch.length ? 1 : 0) < MAX_INFLIGHT; // 还在攒的那一批也要占一个位置
      const flush = () => { if (batch.length === 1) sendChunk(...batch[0]); else if (batch.length) sendBatch(batch); batch = []; chars = 0; };
      outer: for (const job of todo) {
        for (let i = 0; i < job.chunks.length; i++) {
          const c = job.chunks[i];
          if (c.state !== "todo") continue;
          if (!batchable(job, c)) { if (!room()) break outer; sendChunk(job, i); continue; }
          if (batch.length && (batch.length >= BATCH_N || chars + c.src.length > BATCH_CHARS)) flush();
          if (!batch.length && inflight >= MAX_INFLIGHT) break outer; // 新开一批要一个位置
          batch.push([job, i]); chars += c.src.length;
        }
      }
      flush();
    }
    // 一块要发的东西（翻译和只查缓存都用它）
    const reqOf = (job, i) => ({ id: job.id, source: job.chunks[i].src, srcLang: job.lang, truncated: job.truncated && i === job.chunks.length - 1,
      part: job.chunks.length > 1 ? i : undefined, markup: job.rich || undefined, alt: job.chunks[i].alt || undefined, target: target() });
    // 收到一块的译文（新翻的或缓存里的）：带格式的每段标记都对才算数，不对就换后备模型再翻这一块一次（标成 todo 等 pump 发），
    // 还不对就照样用（对的段拼格式，不对的段退回纯文字）。返回 true：这一块好了
    function accept(job, c, r) {
      if (!(r && r.action === "fill" && r.text)) return false;
      if (job.rich) {
        const outs = R.splitParas(r.text, c.idx.length);
        const good = !!outs && outs.every((x, k) => R.tokens(x, job.blocks[c.idx[k]].parts, job.blocks[c.idx[k]].text).ok);
        if (!good && !c.alt && hasAlt) { c.alt = true; c.state = "todo"; return false; }
        c.outs = outs || mergedOuts(r.text, c.idx.length);
      } else { c.text = r.text; c.same = sameText(r.text, c.src); }
      c.state = "done";
      job.model = r.model;
      return true;
    }
    async function sendChunk(job, i) {
      const c = job.chunks[i];
      c.state = "sending";
      inflight++;
      try {
        const r = await send({ type: "translateFill", ...reqOf(job, i) });
        if (jobs.get(job.key) !== job || accept(job, c, r) || c.state === "todo") return;
        if (STOP.includes(r && r.code)) { on = false; jobs.delete(job.key); }
        else { // 别的错：等一会儿再试这一块，三次不行就照原文
          c.tries = (c.tries || 0) + 1;
          c.state = c.tries >= 3 ? "gave_up" : "failed";
          if (c.state === "failed") setTimeout(() => { if (jobs.get(job.key) === job && c.state === "failed") { c.state = "todo"; pump(); } }, 8000 * c.tries);
        }
      } finally {
        inflight--;
        renderAll();
        pump();
      }
    }
    // 几块一起发（0.19.4）：占一个请求的位置；回来的一条条照单发的处理。批里少了某一条（batch_miss）的单独再发；
    // 整批出错的，每一条都记一次失败、以后单独发（找得出是哪一条的问题）。
    // 流式：后台哪条先译完先推过来（txPart，按 rid 认是哪一批），先换上；最后整批回来时已经换上的不再管
    const parts = new Map(), RID = Math.random().toString(36).slice(2, 10);
    let ridN = 0, renderTimer = 0;
    const renderSoon = () => { if (!renderTimer) renderTimer = setTimeout(() => { renderTimer = 0; renderAll(); }, 16); };
    try {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === "txPart" && typeof msg.rid === "string") { const f = parts.get(msg.rid); if (f) f(msg.k, msg.result); }
      });
    } catch (e) { /* 插件刚重载 */ }
    async function sendBatch(list) {
      for (const [job, i] of list) job.chunks[i].state = "sending";
      inflight++;
      const rid = `${RID}:${++ridN}`, early = new Set(); // 流式时已经处理过的（换上了，或者标记乱了、改成单独再翻）：整批回来时不再管
      parts.set(rid, (k, x) => {
        const [job, i] = list[k] || [];
        if (!job || early.has(k) || jobs.get(job.key) !== job || job.chunks[i].state !== "sending") return;
        early.add(k);
        if (accept(job, job.chunks[i], x)) renderSoon();
        else if (job.chunks[i].state === "todo") pump(); // 标记弄乱了：马上换后备模型单独再翻
      });
      try {
        const r = await send({ type: "translateFillBatch", rid, items: list.map(([job, i]) => reqOf(job, i)) });
        const results = Array.isArray(r && r.results) ? r.results : null;
        list.forEach(([job, i], k) => {
          const c = job.chunks[i], x = results ? results[k] : r;
          if (early.has(k) || jobs.get(job.key) !== job || c.state !== "sending") return;
          if (accept(job, c, x) || c.state === "todo") return;
          if (STOP.includes(x && x.code)) { on = false; jobs.delete(job.key); return; }
          c.solo = true;
          if (x && x.code === "batch_miss") { c.state = "todo"; return; }
          c.tries = (c.tries || 0) + 1;
          c.state = c.tries >= 3 ? "gave_up" : "failed";
          if (c.state === "failed") setTimeout(() => { if (jobs.get(job.key) === job && c.state === "failed") { c.state = "todo"; pump(); } }, 8000 * c.tries);
        });
      } finally {
        parts.delete(rid);
        inflight--;
        renderAll();
        pump();
      }
    }
    const sameText = (a, b) => String(a).replace(/\s+/g, " ").trim() === String(b).replace(/\s+/g, " ").trim();
    // 先查缓存（0.13.6）：刚建好的任务攒一下，所有块一次问后台缓存里有没有（只查不翻），有的马上换上，没有的再排队一块块翻
    // 同一轮建的任务认语言有先有后：还有在认的就再等等（最多 40 毫秒），一起查、一起变成可以发，拼批不会被切碎
    // （0.19.4：不等的时候 30 个标题偶尔切成 11 个请求，等了是 8 个）
    const pre = [];
    let preTimer = 0, preSince = 0;
    function prefetch(job) { if (!pre.length) preSince = Date.now(); pre.push(job); if (!preTimer) preTimer = setTimeout(flushPre, 0); }
    async function flushPre() {
      if (detecting > 0 && Date.now() - preSince < 40) { preTimer = setTimeout(flushPre, 4); return; }
      preTimer = 0;
      const batch = pre.splice(0).filter((job) => jobs.get(job.key) === job);
      const items = batch.flatMap((job) => job.chunks.map((c, i) => [job, i]));
      for (let s = 0; s < items.length; s += 100) {
        const part = items.slice(s, s + 100);
        const r = await send({ type: "fillCachedBatch", items: part.map(([job, i]) => reqOf(job, i)) });
        (r.results || []).forEach((x, k) => { const [job, i] = part[k]; if (x && jobs.get(job.key) === job && job.chunks[i].state === "todo") accept(job, job.chunks[i], x); });
      }
      for (const job of batch) job.ready = true;
      renderAll();
      pump();
    }

    // ---------- 视野外先处理：上下各一屏、左右各半屏以内的先翻（0.13.11）----------
    const near = new Set();
    const io = new IntersectionObserver((es) => { for (const e of es) { if (e.isIntersecting) near.add(e.target); else near.delete(e.target); } if (es.some((e) => e.isIntersecting)) tick(); },
      { rootMargin: "100% 50%" });
    const watched = new WeakSet();
    const watch = (el) => { if (!watched.has(el)) { watched.add(el); io.observe(el); } };
    // 这一页上要看的几条：都盯着（进没进视野），快要看到的按离视野远近排——建任务、认语言、查缓存都按这个先后，先好的先发
    // （0.13.13 以前按页面上的先后建，往下滚了以后视野上面那一屏的先准备好、先占满了位置，眼前的要等）
    function nearOnes(els) {
      const out = [];
      for (const e of els) { watch(e); if (near.has(e)) out.push(e); }
      const d = new Map(out.map((e) => [e, distanceOf(e)]));
      return out.sort((a, b) => d.get(a) - d.get(b));
    }
    // 建任务（不在这里发，pump 按先后发）；先认原文语言，认完才发。el：这一条在页面上的那一块（排先后用）
    function want(key, id, text, lang, truncated = false, el = null) {
      if (jobs.has(key) || !text || !/\p{L}/u.test(text) || !foreign(text) || sameUi.get(key) === text) return;
      const [src, cutHere] = cut(text, MAX_TOTAL);
      const job = { key, id, lang, el, ready: false, truncated: truncated || cutHere, chunks: split(src).map((c) => ({ src: c.text, sep: c.sep, state: "todo" })) };
      jobs.set(key, job);
      (async () => {
        if (!(await classify(job, src, text))) return;
        if (jobs.get(key) !== job) return;
        prefetch(job); // 先查缓存，查完才算建好（job.ready），没命中的 pump 再发
      })();
    }
    // 带格式的任务（评论、帖子正文）：box 里的内容按段拆（richtext.js），有字可翻的段打包成块（第一块 ≤ FIRST、别的 ≤ CHUNK，
    // 总共不超过 MAX_TOTAL，更多的照原文），每块发 <p1>…</p1><p2>…</p2>。
    // whole：整格克隆着换（swapRichWhole），字和块可以混着放（HN 的评论）、只有一段字的也行；
    // 不是 whole 时（Reddit：逐个孩子克隆）内容里直接写着字、或者只有一段，就返回 false，退回纯文字
    const ownEl = (n) => n.nodeType === 1 && Dm.mine(n);
    function wantRich(key, id, box, lang, { whole = false } = {}) {
      if (jobs.has(key)) return true;
      if (!box) return false;
      if (!whole && [...box.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) return false;
      const blocks = R.blocks(box, ownEl, { mixed: whole });
      if (!blocks.length || (!whole && blocks[0] === box)) return false;
      const bl = blocks.map((el) => ({ el, ...R.serialize(el, ownEl) }));
      for (const b of bl) b.go = /\p{L}/u.test(b.text.replace(/<x\d+\/>/g, "").replace(/<\/?t\d+>/g, ""));
      const go = bl.filter((b) => b.go);
      const plain = go.map((b) => b.plain).join("\n\n");
      if (!go.length || !foreign(plain) || sameUi.get(key) === plain) return true;
      const packs = [], all = Math.min(MAX_TOTAL, plain.length); // 一共不到 SMALL 的一块翻完
      let cur = null, total = 0;
      bl.forEach((b, i) => {
        if (!b.go || total + b.plain.length > MAX_TOTAL) return;
        total += b.plain.length;
        if (cur && all > SMALL && cur.len + b.plain.length > (packs.length ? CHUNK : FIRST)) { packs.push(cur); cur = null; }
        if (!cur) cur = { idx: [], len: 0 };
        cur.idx.push(i);
        cur.len += b.plain.length;
      });
      if (cur) packs.push(cur);
      const job = { key, id, lang, el: box, rich: true, whole, ready: false, blocks: bl,
        chunks: packs.map((p) => ({ idx: p.idx, src: p.idx.map((bi, k) => `<p${k + 1}>${bl[bi].text}</p${k + 1}>`).join("\n"), state: "todo" })) };
      jobs.set(key, job);
      (async () => {
        if (!(await classify(job, plain, plain))) return;
        if (jobs.get(key) !== job) return;
        prefetch(job);
      })();
      return true;
    }
    // 认语言、写进任务；认出来不用翻的，撤掉任务、记下来。返回 false：不翻了
    async function classify(job, src, sig) {
      const d = await detect(src, job.lang, mainScript(src));
      if (jobs.get(job.key) !== job) return false;
      job.lang = d.label;
      if (d.other) return true;
      jobs.delete(job.key);
      sameUi.set(job.key, sig);
      return false;
    }
    // 模型没按段回（段数对不上）：整块译文放进第一段（去掉标记），这一块别的段藏起来
    function mergedOuts(text, n) {
      const flat = text.replace(/<\/?p\d+>/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      return [flat, ...Array(n - 1).fill(null)];
    }
    // 截前面一截（告诉后台"后面被截断了"，模型不会替作者补完）：在句子末尾或换行处截，太靠前就退到空白处，再不行硬截
    function cut(text, max) {
      if (text.length <= max) return [text, false];
      const s = text.slice(0, max);
      const lastEnd = (re) => { let i = -1; for (const m of s.matchAll(re)) i = m.index + m[0].length; return i; };
      const i = [lastEnd(/[.!?。！？…](?=\s)|\n/g), lastEnd(/\s/g)].find((x) => x > max * 0.6) ?? max;
      return [s.slice(0, i).trim(), true];
    }
    // 列表里的摘要只露几行：翻够 6 行的就行（中日韩的字密，截得更短）
    const previewMax = (text) => (WIDE.has(mainScript(text)) ? 220 : 500);
    function tick() {
      if (!alive() || !on || document.hidden) return;
      site.scan(api);
      pump();
    }

    // ---------- 画出来 ----------
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const sparkle = () => {
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 24 24"); icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = SPARK; // 固定图形
      return icon;
    };
    const labels = (job, id) => {
      const lang = (job.lang && langName(job.lang)) || t("tx.someLang");
      return ours(id) ? [t("tx.from", { lang }), t("tx.seeOriginal")] : [t("tx.original", { lang }), t("tx.seeTranslation")];
    };
    const flip = (id) => (ev) => { ev.preventDefault(); ev.stopPropagation(); showing.set(id, !ours(id)); renderAll(); };
    // 说明那一行：点"看原文 / 看翻译"切这一条（评论，或者帖子的标题和正文一起）。鼠标停在上面看得到用的模型
    // （0.13.11 以前用的是 X 上那句"X 没有翻译这条"）。compact：只露图标和按钮（Reddit 媒体那一栏挤在版块那一行里），
    // "翻译自英语"留给读屏、也放进鼠标提示
    function note(job, id, compact = false) {
      const n = el("div", `ff-tx-note ${OWN}`);
      n.title = t("tx.titleBy", { model: job.model || t("tx.model") });
      const [label, toggle] = labels(job, id);
      if (compact) n.title = `${label} · ${n.title}`;
      const b = el("button", "ff-tx-toggle", toggle);
      b.type = "button";
      b.title = n.title; // 帖子卡片上说明这一行让点击穿过去（见 content.css），鼠标停在按钮上也看得到用的模型
      b.addEventListener("click", flip(id), true);
      n.append(sparkle(), el("span", "ff-tx-label", label));
      if (busy(id)) n.append(el("span", "ff-tx-busy", t("tx.filling"))); // 长的还有几块在翻
      n.append(b);
      return n;
    }
    // 换没换、认的语言、模型、还在不在翻、每一块翻到哪了：变了就重画
    // 带上任务的键：站点拿同一个元素换着显示别的评论时（YouTube 会），旧的译文对不上新的这一条，重画
    const keyOf = (id, job, extra = "") => `${job.key}|${ours(id) ? 1 : 0}|${job.lang}|${job.model}|${busy(id) ? 1 : 0}|${progress(job)}|${extra}`;
    // 译文：翻好的块换成译文，没翻到的照原文、淡一点（试了三次没翻成的照原文、不淡）；块和块之间照原来的分隔
    // （同一段里切开的两块都翻成了中日韩文时不加空格，有一边还是原文就照原来的空格）。compact：列表里的摘要，段落之间不空行
    function fillText(textEl, job, compact) {
      const squeeze = (x) => (compact ? x.replace(/\n{2,}/g, "\n") : x);
      const cjk = WIDE.has(targetScript()), cs = job.chunks;
      cs.forEach((c, i) => {
        if (c.state === "done") textEl.append(squeeze(c.text));
        else textEl.append(el("span", c.state === "gave_up" ? "" : "ff-rtx-pending", squeeze(c.src)));
        if (i < cs.length - 1) textEl.append(squeeze(c.sep === " " && cjk && c.state === "done" && cs[i + 1].state === "done" ? "" : c.sep));
      });
    }
    const hide = (e) => { if (e.style.display !== "none") e.style.display = "none"; e.dataset.ffTxHidden = "1"; };
    const unhide = (e) => { if (e.dataset.ffTxHidden) { e.style.display = ""; delete e.dataset.ffTxHidden; } };
    // 一格内容原位置换（纯文字）：在 box 最前面放上（说明和）译文，box 里原来的孩子藏起来；看原文时译文藏起来、原来的露出来，说明还在。
    // wrap：译文外面那层照抄原来第一个孩子的 class、译文照抄原来 .md 的 class（Reddit 的边距、字号跟着走）
    function swapBox(box, id, job, { cls, withNote, wrap }) {
      let block = box.querySelector(`:scope > .${cls}`);
      const kids = [...box.children].filter((k) => !k.classList.contains(OWN));
      if (!job) { block?.remove(); kids.forEach(unhide); return; }
      const show = ours(id), key = keyOf(id, job, withNote ? "n" : "");
      if (!block || block.dataset.key !== key) {
        block?.remove();
        const first = wrap && kids[0];
        block = el("div", `${first && typeof first.className === "string" ? first.className + " " : ""}ff-tx ff-tx-fill ${cls} ${OWN}`);
        block.dataset.key = key;
        block.lang = target();
        const md = first && (first.matches(".md") ? first : first.querySelector(".md"));
        // 照抄了 Reddit 的 .md（摘要的话带着它自己的行数限制：窄屏 3 行、宽屏 6 行），就用它的；没抄到才用插件自己的 4 行
        const text = el("div", `${md ? md.className + " " : "ff-rtx-clamp "}ff-tx-text`);
        fillText(text, job, cls === "ff-rtx-preview"); // 列表里的摘要只露几行：段落之间不空行，省下地方给字
        text.dir = "auto";
        text.hidden = !show;
        if (withNote) block.append(note(job, id));
        block.append(text);
        box.prepend(block);
      }
      block.style.display = show || withNote ? "" : "none"; // 看原文、又没有说明：整块都不占地方
      kids.forEach(show ? hide : unhide);
    }
    // 在克隆出来的内容里逐段放译文（还没翻到的段淡着、没字可翻的段照原样）。返回 false：段数和建任务时对不上（站点换了内容）
    const rebuilt = new WeakMap(); // box → 内容对不上重建过几次
    function fillBlocks(holderEl, job, box, mixed) {
      const cb = R.blocks(holderEl, ownEl, { mixed });
      if (cb.length !== job.blocks.length) { // 丢掉这个任务，下一轮照新的重来（最多两次）
        const n = (rebuilt.get(box) || 0) + 1;
        rebuilt.set(box, n);
        if (n <= 2) jobs.delete(job.key);
        return false;
      }
      for (const c of job.chunks) c.idx.forEach((bi, k) => {
        const src = job.blocks[bi];
        if (c.state === "done") {
          const blk = R.holder(cb[bi]);
          if (c.outs[k] == null) blk.style.display = "none"; // 这一块的译文整个放进了第一段（模型没按段回）
          else { R.fill(blk, c.outs[k], src.parts, src.text); blk.lang = target(); }
        } else if (c.state !== "gave_up") R.holder(cb[bi]).classList.add("ff-rtx-pending");
      });
      return true;
    }
    const cleanClone = (c) => { c.removeAttribute("style"); c.removeAttribute("id"); delete c.dataset.ffTxHidden; for (const x of c.querySelectorAll("[id]")) x.removeAttribute("id"); return c; };
    // 带格式的原位置换（Reddit）：box 里原来的每个孩子深克隆一份（去掉 id），放在原来的前面，克隆里每段换成译文；
    // 说明是 box 的第一个孩子。看原文：克隆藏起来、原来的露出来，说明还在
    function swapRich(box, id, job, withNote) {
      const mineKids = [...box.children].filter((k) => k.classList.contains("ff-rtx-clone") || k.classList.contains("ff-rtx-bnote"));
      const origs = [...box.children].filter((k) => !ownEl(k));
      if (!job) { mineKids.forEach((k) => k.remove()); origs.forEach(unhide); return; }
      const show = ours(id), key = keyOf(id, job, withNote ? "n" : "");
      const head = box.querySelector(":scope > .ff-rtx-clone");
      if (!head || head.dataset.key !== key) {
        mineKids.forEach((k) => k.remove());
        const fresh = origs.map((k) => cleanClone(k.cloneNode(true)));
        // 先在克隆里找段（这时还没打上插件的 class，不然会被当成插件自己的东西跳过），找完再打
        const holderEl = document.createElement("div");
        holderEl.append(...fresh);
        if (!fillBlocks(holderEl, job, box, false)) { origs.forEach(unhide); return; }
        for (const c of fresh) c.classList.add(OWN, "ff-rtx-clone");
        fresh[0].dataset.key = key;
        for (const c of fresh) box.insertBefore(c, origs[0]);
        if (withNote) {
          const n = note(job, id);
          n.classList.add("ff-rtx-bnote");
          box.insertBefore(n, fresh[0]);
        }
      }
      for (const k of box.querySelectorAll(":scope > .ff-rtx-clone")) k.style.display = show ? "" : "none";
      origs.forEach(show ? hide : unhide);
    }
    // 带格式的原位置换，整格克隆（0.14，Hacker News 的评论：字直接写在格子里，没法逐个孩子藏）：box 整个深克隆一份放在它后面，
    // 克隆里每段换成译文，原来的藏起来；说明放在 box 前面。看原文：克隆藏起来、原来的露出来，说明还在
    function swapRichWhole(box, id, job, withNote = true) {
      const parent = box.parentElement;
      if (!parent) return;
      let clone = box.nextElementSibling?.classList.contains("ff-rtx-whole") ? box.nextElementSibling : null;
      let n = box.previousElementSibling?.classList.contains("ff-rtx-bnote") ? box.previousElementSibling : null;
      for (const x of parent.querySelectorAll(":scope > .ff-rtx-whole, :scope > .ff-rtx-bnote")) if (x !== clone && x !== n) x.remove();
      if (!job) { clone?.remove(); n?.remove(); unhide(box); return; }
      const show = ours(id), key = keyOf(id, job);
      if (!clone || clone.dataset.key !== key) {
        const fresh = cleanClone(box.cloneNode(true));
        if (!fillBlocks(fresh, job, box, true)) { clone?.remove(); n?.remove(); unhide(box); return; }
        clone?.remove();
        fresh.classList.add(OWN, "ff-rtx-whole");
        fresh.dataset.key = key;
        box.after(fresh);
        clone = fresh;
      }
      if (withNote && (!n || n.dataset.key !== key)) {
        n?.remove();
        n = note(job, id);
        n.classList.add("ff-rtx-bnote");
        n.dataset.key = key;
        box.before(n);
      } else if (!withNote) n?.remove();
      clone.style.display = show ? "" : "none";
      if (show) hide(box); else unhide(box);
    }
    // 一段字原位置换（标题、搜索结果的摘要）：照原来那个元素克隆一个（标签、class、slot、链接都一样，去掉 id 这类不能重复的）放在它后面
    // 换上译文，原来的藏起来；看原文：克隆的藏起来、原来的露出来。原来的里面是一层块（<p>、<div>）包着字时，克隆也带上这一层（边距、字号跟着走）。
    // lines：最多几行（Reddit 媒体那一栏：不比原来的高）。plain：放一个插件自己的 span，不克隆原来的元素（YouTube 的 yt-formatted-string
    // 这类组件克隆了会被它自己重画；span 放在原来的那个链接里，字体、行数照链接的）。第五个参数可以直接给 lines，也可以给 {lines, plain}
    // tidy：放上去以前再改一下译文（YouTube 收起时的简介：它自己会加"…"，译文末尾的"…"去掉）
    function swapText(orig, id, job, cls, opts = null) {
      const { lines = null, plain = false, tidy = null } = opts && ("plain" in opts || "lines" in opts || "tidy" in opts) ? opts : { lines: opts };
      const next = orig.nextElementSibling;
      let clone = next && next.classList.contains(cls) ? next : null;
      // 站点换掉了原来的元素时，旧的克隆不挨着新的了：清掉，不然会多出一份
      for (const x of orig.parentElement.querySelectorAll(`:scope > .${cls}`)) if (x !== clone) x.remove();
      if (!job) { clone?.remove(); unhide(orig); return; }
      if (!clone) {
        clone = plain ? document.createElement("span") : orig.cloneNode(false);
        for (const a of DROP) clone.removeAttribute(a);
        clone.classList.add(OWN, cls);
        const wrap = plain || [...orig.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()) ? null : [...orig.children].find((k) => /^(P|DIV)$/.test(k.tagName) && !k.classList.contains(OWN));
        if (wrap) { const w = wrap.cloneNode(false); for (const a of DROP) w.removeAttribute(a); w.removeAttribute("style"); w.classList.add("ff-rtx-in"); clone.append(w); }
        if (lines) { clone.style.setProperty("-webkit-line-clamp", String(lines.n)); clone.style.maxHeight = `${Math.ceil(lines.n * lines.lh)}px`; clone.style.overflow = "hidden"; }
        orig.after(clone);
      }
      const holderEl = clone.querySelector(":scope > .ff-rtx-in") || clone;
      const raw = job.chunks.map((c) => (c.state === "done" ? c.text : c.src)).join(""), tt = tidy ? tidy(raw) : raw; // 标题、摘要都短，一块
      if (holderEl.textContent !== tt) holderEl.textContent = tt;
      clone.lang = target();
      clone.dir = "auto";
      if (ours(id)) { hide(orig); clone.style.display = ""; } else { unhide(orig); clone.style.display = "none"; }
    }
    // 原来的标题占几行、一行多高（换上译文以前量，藏起来以后就量不到了）
    const measured = new WeakMap();
    function linesOf(e) {
      if (measured.has(e)) return measured.get(e);
      if (e.dataset.ffTxHidden || !e.getClientRects().length) return null;
      const cs = getComputedStyle(e), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25, h = e.getBoundingClientRect().height;
      const r = lh > 0 && h > 0 ? { n: Math.max(1, Math.round(h / lh)), lh } : null;
      if (r) measured.set(e, r);
      return r;
    }
    // 说明那一行（一条一个）。where：放在哪个元素前面；row：放进这一行的最右边（Reddit 媒体那一栏）。slot：带上和这个元素一样的 slot
    // （不带的话放进 shreddit-post 里不显示）。scope 里已有的说明：deep 为假只看 scope 自己的孩子（帖子卡片里可能还套着别的帖子），
    // 为真看整条里面（说明可能在中间那一格、版块那一行里）
    // opts.compact：只露图标和按钮（默认放进一行里时是）；opts.cls：再加一个 class（站点自己的样式）；
    // opts.rowClass：false 时不给那一行加 ff-rtx-mrow（不改站点那一行自己的排版，YouTube 的作者行）
    function placeNote(scope, id, job, where, row = null, deep = false, opts = {}) {
      const compact = opts.compact ?? !!row;
      const old = [...scope.querySelectorAll(deep ? ".ff-rtx-note" : ":scope > .ff-rtx-note")];
      let n = old.find((x) => (row ? x.parentElement === row : x.nextElementSibling === where)) || null;
      for (const x of old) if (x !== n) x.remove();
      if (deep) for (const r of scope.querySelectorAll(".ff-rtx-mrow")) if (r !== row || !job) r.classList.remove("ff-rtx-mrow");
      if (!job || !(row || where)) { n?.remove(); return; }
      if (row && opts.rowClass !== false) row.classList.add("ff-rtx-mrow");
      const key = keyOf(id, job);
      if (n && n.dataset.key === key) return;
      n?.remove();
      n = note(job, id, compact);
      n.classList.add("ff-rtx-note");
      if (opts.cls) n.classList.add(opts.cls);
      n.dataset.key = key;
      if (row) { row.append(n); return; }
      const slot = where.getAttribute("slot");
      if (slot) n.setAttribute("slot", slot);
      where.before(n);
    }
    // 列表里一行一个的标题（HN 首页这种很紧凑的）：说明不另占一行，标题后面只放一个 ✦ 按钮——鼠标停上去写着"翻译自英语 · 由某模型翻译"，
    // 点它看原文 / 看翻译（读屏读得到"翻译自英语，看原文"）。before：放在这个元素前面（YouTube 的标题限 2–3 行，放后面会被截掉）
    function placeIconNote(after, id, job, { before = false } = {}) {
      const parent = after.parentElement;
      if (!parent) return;
      let n = [...parent.querySelectorAll(":scope > .ff-tx-inote")].find((x) => (before ? x.nextElementSibling : x.previousElementSibling) === after) || null;
      for (const x of parent.querySelectorAll(":scope > .ff-tx-inote")) if (x !== n) x.remove();
      if (!job) { n?.remove(); return; }
      const key = keyOf(id, job);
      if (n && n.dataset.key === key) return;
      n?.remove();
      const [label, toggle] = labels(job, id);
      n = el("button", `ff-tx-inote ${before ? "ff-tx-inote-before " : ""}${OWN}`);
      n.type = "button";
      n.dataset.key = key;
      n.title = `${label} · ${t("tx.titleBy", { model: job.model || t("tx.model") })} · ${toggle}`;
      n.setAttribute("aria-label", `${label} · ${toggle}`);
      n.append(sparkle());
      n.addEventListener("click", flip(id), true);
      if (before) after.before(n); else after.after(n);
    }
    // 标题：克隆换上译文（swapText），说明放在原来的前面。看原文：克隆的藏起来、原来的露出来，说明还在。
    function renderTitle(id, titleEl, job, withNote) {
      swapText(titleEl, id, job, "ff-rtx-title");
      placeNote(titleEl.parentElement, id, withNote ? job : null, titleEl);
    }
    function renderAll() { if (alive()) site.render(api); }

    const known = (key) => jobs.has(key); // 有这个任务（还在认语言、查缓存的也算）
    const api = { want, wantRich, nearOnes, watch, ready, has, known, cut, previewMax, guessLang, foreign, mainScript,
      swapText, swapBox, swapRich, swapRichWhole, placeNote, placeIconNote, renderTitle, linesOf, isOn: () => on };
    // 弹窗问"这个页面"时：这一页翻了几条（折叠那边的 pageSummary 带上）
    globalThis.FFTxSummary = () => ({ improved: 0, filled: site.count(api), on });

    let pending = 0;
    // 插件自己的东西变了不用管；站点只换了字（YouTube 拿同一个元素换着显示别的评论，只改里面的字）也要重画
    // site.quiet：这些地方的变化不用管（YouTube 的播放器每秒都在换进度时间）
    const ownTarget = (t) => t.nodeType === 1 && !!t.closest?.(site.quiet ? `.${OWN}, .ff-bar, ${site.quiet}` : `.${OWN}, .ff-bar`);
    const observer = new MutationObserver((muts) => {
      if (muts.every((m) => ownTarget(m.target) || [...m.addedNodes, ...m.removedNodes].every((n) => n.nodeType === 1 && Dm.mine(n)))) return;
      if (pending) return;
      pending = setTimeout(() => { pending = 0; if (alive()) { renderAll(); tick(); } }, 300);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    try { chrome.storage.onChanged.addListener((ch) => { if (ch.ff_settings || ch.ff_or_key || ch.ff_key) loadSettings(); }); } catch (e) { /* 插件刚重载 */ }
    setInterval(() => { if (alive()) tick(); }, 1500);
    loadSettings();
    return api;
  }
  globalThis.FFTx = Object.freeze({ start });
})();
