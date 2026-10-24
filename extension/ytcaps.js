// YouTube 字幕（0.29.0；用户 10-19：视频没有简体中文字幕、但有繁体中文字幕和"自动翻译"——繁体的转成简体给你，自动翻译的判一下、不行就重翻）。
// 1. 你选了繁体中文字幕（中文（台湾）、中文（香港）……）、YouTube 的界面是简体中文：字幕显示成简体，台湾、香港用词一起换成大陆用词
//    （zhconv.js，OpenCC 的词表，本地转、不花钱；设置里 captionConvert）。视频本来就有人工的简体中文字幕（中文（中国）、zh-Hans……）时不转
//    （0.29.2，用户 10-19：有简体的就不要转繁体那条——你特意选了繁体，就照你选的显示；YouTube 自动生成的简体字幕不算，它多半不如人工的繁体字幕）。
// 2. 你选了"自动翻译 → 某种语言"（YouTube 一行一行地机翻，一句话跨两三行的就翻碎了）、设置里 captionFix 开着：
//    a. 翻成的是简体中文、视频有人工的中文字幕：换成它（繁体的照 1 转）；
//    b. 不然拿前面一段原文和 YouTube 的译文问 Jev（和判 X 的 Grok 译文同一套），最低分不到重译阈值（设置里 translateThreshold）就用模型重翻：
//       原文字幕从眼前这一行起最多 CHUNK 行一段整段翻（background.js 的 captionTranslate），一行一行放回原来的时间；看到哪儿翻到哪儿
//       （眼前这段走标准通道，往后预翻一段走 flex），没看到的不花钱。流式：翻好一行先换上一行（0.29.5）。还没翻好的那几行照样用 YouTube 的。
// 不动 YouTube 的菜单和播放器：字幕画在 #movie_player .ytp-caption-window-container 里（每个 .caption-window 一块，一行一个 .ytp-caption-segment），
// 1 是每次画出来就把字换成简体；2 是按视频现在的时间找到我们这一行，换进 YouTube 画的那一块（那一刻 YouTube 没有字幕就不显示）。
// 换过的那一块后面一个小 ✦：鼠标停上去说是怎么换的，点它看 YouTube 原来的，再点换回来。
// 字幕原文、YouTube 的译文从 ytdata.js（页面自己的环境里）拿：它旁听播放器的字幕请求，照它带的凭据去要别的语言。
(() => {
  if (globalThis.__ffYtCaps) return;
  globalThis.__ffYtCaps = true;
  const Y = globalThis.FFYT, Z = globalThis.FFZhConv;
  const { t } = globalThis.FFI18n;
  const alive = () => { try { return !!chrome.runtime.id; } catch (e) { return false; } };
  const send = (msg) => new Promise((resolve) => {
    try { chrome.runtime.sendMessage(msg, (r) => resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message, code: "network", retryable: true } : r || {})); }
    catch (e) { resolve({ error: String(e) }); }
  });
  const HANT = /^zh-(tw|hk|mo|hant)\b/i, HANS = /^zh(-(cn|sg|my|hans)\b.*)?$/i, ZH = /^zh\b/i;
  // 人工的简体中文字幕（zh、zh-CN、zh-SG、zh-Hans……；不是自动生成的）
  const humanHans = (list) => list.find((x) => x.kind !== "asr" && ZH.test(x.lang) && !HANT.test(x.lang)) || null;
  const schemeOf = (lang) => (/^zh-(hk|mo)\b/i.test(lang) ? "hk2sp" : /^zh-tw\b/i.test(lang) ? "tw2sp" : "t2s");
  const CHUNK = 40, SAMPLE = 40, AHEAD = 20; // 一段最多几行；判 YouTube 的译文用前面几行；离已经翻了的结尾还剩几行时去翻下一段
  // 拖进度（0.29.0，用户 10-19："播放器可以调进度"）：拖的过程中时间一路在变，路过的每一段都去翻就白花钱了——停下来 SETTLE 毫秒不再拖了才翻
  // 停在的那一段；显示不用等（每次重画、每次时间变了都按现在的时间找那一行，没翻好的那几行先用 YouTube 的）
  const SETTLE = 600;
  let lastSeek = 0, settleTimer = 0;
  // 后台流式推回来的字幕行（txPart；rid 是 "cap:" 开头的，和 tx_engine.js 的批不会撞）
  const parts = new Map(), RID = Math.random().toString(36).slice(2, 10);
  let ridN = 0;
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "txPart" && typeof msg.rid === "string" && msg.rid.startsWith("cap:")) { const f = parts.get(msg.rid); if (f) f(msg.k, msg.result); }
    });
  } catch (e) { /* 插件刚重载 */ }
  const SPARK = '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>';

  let st = null, hasKey = false, hasOrKey = false;
  let vid = "", track = null, tracks = [];
  // mode：null 不管；{kind: "convert", scheme}；{kind: "replace", why: "human" | "fixed", cues: [{t, d, text}]}（fixed 的还没翻好的那几行 text 是 null）
  let mode = null, showOurs = true, epoch = 0;
  const loaded = new Map(); // "视频|语言|翻成的语言" → 播放器自己请求过的字幕
  const waiters = new Map();
  let seq = 0;

  // ---------- 从 ytdata.js 拿字幕 ----------
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (e.source !== window || !d || d.source !== "ff-yt") return;
    if (d.type === "captionTrack") {
      const same = d.vid === vid && JSON.stringify(d.track) === JSON.stringify(track);
      vid = d.vid; track = d.track; tracks = Array.isArray(d.tracks) ? d.tracks : [];
      if (!same) decide();
    } else if (d.type === "captions" && Array.isArray(d.cues)) {
      loaded.set(`${d.vid}|${d.lang}|${d.tlang}`, d.cues);
      if (loaded.size > 30) loaded.delete(loaded.keys().next().value);
    } else if (d.type === "captionGot") {
      const w = waiters.get(d.id);
      if (w) { waiters.delete(d.id); w(Array.isArray(d.cues) ? d.cues : null); }
    }
  });
  function getTrack(lang, tlang = "", kind = "") {
    const hit = loaded.get(`${vid}|${lang}|${tlang}`);
    if (hit) return Promise.resolve(hit);
    const id = ++seq;
    return new Promise((resolve) => {
      waiters.set(id, resolve);
      window.postMessage({ source: "ff-yt-cap-get", id, vid, lang, tlang, kind }, location.origin);
      setTimeout(() => { if (waiters.get(id) === resolve) { waiters.delete(id); resolve(null); } }, 8000);
    });
  }

  // ---------- 这一条字幕怎么处理 ----------
  // 只看这个网站开没开翻译（forSite 的 translate 已经包含"网站开着"）；以前还要 enabled（= 开着清理），YouTube 设成"只翻译"时繁转简和字幕改善都不工作（0.29.12 修）
  const on = () => !!st && st.translate !== false;
  async function decide() {
    const my = ++epoch;
    mode = null; showOurs = true;
    render();
    if (!on() || !track) return;
    const ui = Y.uiLang();
    if (!track.tlang) {
      if (HANT.test(track.lang) && HANS.test(ui) && st.captionConvert !== false && !humanHans(tracks)) { mode = { kind: "convert", scheme: schemeOf(track.lang) }; render(); }
      return;
    }
    if (st.captionFix === false) return;
    // a. 翻成简体中文、视频有人工的中文字幕：换成它（简体的优先）
    if (HANS.test(track.tlang)) {
      const human = humanHans(tracks) || tracks.find((x) => x.kind !== "asr" && HANT.test(x.lang)); // 有人工简体的用它，没有才用繁体的转
      if (human) {
        const cues = await getTrack(human.lang, "", "");
        if (my !== epoch) return;
        if (cues && cues.length) {
          mode = { kind: "replace", why: "human", cues: HANT.test(human.lang) ? cues.map((c) => ({ ...c, text: Z.convert(c.text, schemeOf(human.lang)) })) : cues };
          render();
          return;
        }
      }
    }
    // b. 判 YouTube 的译文，差了重翻
    if (!hasKey || !hasOrKey) return;
    const [src, yt] = await Promise.all([getTrack(track.lang, "", track.kind), getTrack(track.lang, track.tlang, track.kind)]);
    if (my !== epoch || !src || !src.length || !yt || !yt.length) return;
    const n = Math.min(SAMPLE, src.length, yt.length);
    const j = await send({ type: "captionJudge", source: src.slice(0, n).map((c) => c.text).join("\n").slice(0, 5000),
      translation: yt.slice(0, n).map((c) => c.text).join("\n").slice(0, 5000), srcLang: track.lang, target: track.tlang });
    if (my !== epoch || j.error || !(j.min < (Number(st.translateThreshold) || 0.7))) return;
    mode = { kind: "replace", why: "fixed", cues: src.map((c) => ({ t: c.t, d: c.d, text: null })), src, lang: track.lang, tlang: track.tlang, asked: [], failed: false };
    ensureAhead();
  }
  // fixed：眼前这一行还没人翻就从这一行起翻一段（标准通道），已经在翻了、离翻了的那一截的结尾不到 AHEAD 行就接着往后预翻一段（flex）。
  // 0.29.5（用户 10-20：字幕要跟得上）：段从眼前这一行起（以前按 40 行对齐，拖到一段中间要等前面跳过的那些行一起翻完）；
  // m.asked[k] 记第 k 行有没有人在翻 / 翻好了，一段到下一个已经有人翻的行为止；后台流式推回来的行先换上（txPart，按 rid 认）
  function ensureAhead() {
    const m = mode;
    if (!m || m.why !== "fixed" || m.failed) return;
    const v = video();
    if ((v && v.seeking) || Date.now() - lastSeek < SETTLE) return; // 还在拖：等停下来（seeked 以后 SETTLE 再来）
    const n = m.cues.length, i = Math.min(n - 1, Math.max(0, cueIndex(m.cues, now())));
    let start = -1, flex = false;
    if (!m.asked[i]) start = i;
    else { let j = i; while (j < n && m.asked[j]) j++; if (j < n && j - i < AHEAD) { start = j; flex = true; } }
    if (start < 0) return;
    let end = start;
    while (end < n && end - start < CHUNK && !m.asked[end]) m.asked[end++] = true;
    const my = epoch, lines = m.src.slice(start, end).map((x) => x.text), rid = `cap:${RID}:${++ridN}`;
    parts.set(rid, (k, x) => {
      if (my !== epoch || mode !== m || !x || typeof x.text !== "string" || !x.text || !(k >= 0 && k < lines.length)) return;
      m.cues[start + k].text = x.text;
      scheduleRender();
    });
    send({ type: "captionTranslate", lines, srcLang: m.lang, target: m.tlang, flex, rid }).then((r) => {
      parts.delete(rid);
      if (my !== epoch || mode !== m) return;
      if (r.error || !Array.isArray(r.lines) || r.lines.length !== lines.length) {
        if (!r.retryable) m.failed = true; else for (let k = start; k < end; k++) if (m.cues[k].text == null) m.asked[k] = false;
        return;
      }
      r.lines.forEach((x, k2) => { m.cues[start + k2].text = x; });
      render();
    });
  }

  // ---------- 画出来 ----------
  const video = () => document.querySelector("#movie_player video");
  const now = () => { const v = video(); return v ? v.currentTime : 0; };
  // 现在这一刻是第几行：开始时间不晚于现在的最后一行（二分）
  function cueIndex(cues, time) {
    let lo = 0, hi = cues.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cues[mid].t <= time + 0.05) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  }
  // replace：这一刻该显示的那一行（结束以后 1 秒内还算，YouTube 的字幕多半比原文那一行晚一点收）；没有就 ""；fixed 的还没翻好是 null（用 YouTube 的）
  function cueNow() {
    const i = cueIndex(mode.cues, now());
    if (i < 0) return "";
    const c = mode.cues[i];
    if (now() > c.t + c.d + 1) return "";
    return c.text;
  }
  function setText(seg, want) {
    if (seg.textContent !== want) seg.textContent = want;
    seg.dataset.ffCapOut = want;
  }
  function original(seg) {
    if (seg.dataset.ffCapOut !== seg.textContent) seg.dataset.ffCapOrig = seg.textContent; // 播放器换了字（或者头一回见）：这就是原来的
    return seg.dataset.ffCapOrig ?? seg.textContent;
  }
  function render() {
    const box = document.querySelector("#movie_player .ytp-caption-window-container");
    if (!box) return;
    const wins = [...box.querySelectorAll(".caption-window")];
    const text = mode && mode.kind === "replace" && showOurs ? cueNow() : null;
    wins.forEach((w, wi) => {
      const segs = [...w.querySelectorAll(".ytp-caption-segment")];
      let mark = w.querySelector(".ff-cap-mark");
      if (!mode || !segs.length) {
        for (const s of segs) if (s.dataset.ffCapOut !== undefined) { const o = original(s); setText(s, o); delete s.dataset.ffCapOut; delete s.dataset.ffCapOrig; }
        if (mark) mark.remove();
        return;
      }
      if (mode.kind === "convert") for (const s of segs) { const o = original(s); setText(s, showOurs ? Z.convert(o, mode.scheme) : o); }
      else segs.forEach((s, k) => { const o = original(s); setText(s, text == null ? o : wi === 0 && k === 0 ? text : ""); });
      if (wi > 0) { if (mark) mark.remove(); return; }
      if (!mark) {
        mark = document.createElement("span");
        mark.className = "ff-cap-mark ff-own";
        mark.setAttribute("role", "button");
        mark.tabIndex = 0;
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("viewBox", "0 0 24 24"); icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = SPARK; // 固定图形
        mark.append(icon);
        const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
        for (const type of ["mousedown", "pointerdown", "dblclick"]) mark.addEventListener(type, stop, true); // 别让播放器当成拖字幕、暂停
        mark.addEventListener("click", (ev) => { stop(ev); showOurs = !showOurs; render(); }, true);
        mark.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { stop(ev); showOurs = !showOurs; render(); } }, true);
        (segs[segs.length - 1].closest(".caption-visual-line") || w).append(mark);
      }
      const title = !showOurs ? t("tx.capOriginal") : mode.kind === "convert" ? t("tx.capConverted") : mode.why === "human" ? t("tx.capHuman") : t("tx.capFixed");
      if (mark.title !== title) { mark.title = title; mark.setAttribute("aria-label", title); }
    });
  }
  let raf = 0;
  const scheduleRender = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (alive()) render(); }); };
  // 播放器换字幕那一块（一行画完、换一行）就跟着换；replace 还要跟着时间走
  const observer = new MutationObserver((muts) => {
    if (!mode || !alive()) return;
    for (const m of muts) {
      const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (el && el.closest && el.closest(".ytp-caption-window-container") && !el.closest(".ff-cap-mark")) { scheduleRender(); return; }
    }
  });
  let watching = null;
  setInterval(() => {
    if (!alive()) return;
    const p = document.getElementById("movie_player");
    if (p && p !== watching) { observer.disconnect(); observer.observe(p, { childList: true, subtree: true, characterData: true }); watching = p; }
  }, 1000);
  document.addEventListener("timeupdate", (e) => {
    if (!mode || mode.kind !== "replace" || !(e.target instanceof HTMLMediaElement) || !e.target.closest("#movie_player")) return;
    scheduleRender();
    ensureAhead();
  }, true);
  // 拖进度：每一下都记时间；停下来以后（最后一下 seeked 过了 SETTLE）翻停在的那一段
  for (const type of ["seeking", "seeked"]) document.addEventListener(type, (e) => {
    if (!(e.target instanceof HTMLMediaElement) || !e.target.closest("#movie_player")) return;
    lastSeek = Date.now();
    if (!mode) return;
    scheduleRender();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { if (alive()) { ensureAhead(); scheduleRender(); } }, SETTLE + 30);
  }, true);

  // ---------- 设置 ----------
  async function loadSettings() {
    const r = await send({ type: "settings" });
    if (!r.settings) return;
    st = globalThis.FFSettings.forSite(r.settings, "yt");
    hasKey = !!r.hasKey; hasOrKey = !!r.hasOrKey;
    decide();
  }
  try { chrome.storage.onChanged.addListener((ch) => { if (ch.ff_settings || ch.ff_keys || ch.ff_key || ch.ff_or_key) loadSettings(); }); } catch (e) { /* 插件刚重载 */ }
  loadSettings().then(() => window.postMessage({ source: "ff-yt-cap-ask" }, location.origin));
})();
