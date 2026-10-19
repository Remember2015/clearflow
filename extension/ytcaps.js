// YouTube 字幕（0.29.0；用户 10-19：视频没有简体中文字幕、但有繁体中文字幕和"自动翻译"——繁体的转成简体给你，自动翻译的判一下、不行就重翻）。
// 1. 你选了繁体中文字幕（中文（台湾）、中文（香港）……）、YouTube 的界面是简体中文：字幕显示成简体，台湾、香港用词一起换成大陆用词
//    （zhconv.js，OpenCC 的词表，本地转、不花钱；设置里 captionConvert）。
// 2. 你选了"自动翻译 → 某种语言"（YouTube 一行一行地机翻，一句话跨两三行的就翻碎了）、设置里 captionFix 开着：
//    a. 翻成的是简体中文、视频有人工的中文字幕：换成它（繁体的照 1 转）；
//    b. 不然拿前面一段原文和 YouTube 的译文问 Jev（和判 X 的 Grok 译文同一套），最低分不到重译阈值（设置里 translateThreshold）就用模型重翻：
//       原文字幕每 CHUNK 行一段整段翻（background.js 的 captionTranslate），一行一行放回原来的时间；看到哪儿翻到哪儿（眼前这段走标准通道，
//       往后预翻一段走 flex），没看到的不花钱。还没翻好的那几行照样用 YouTube 的。
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
  const schemeOf = (lang) => (/^zh-(hk|mo)\b/i.test(lang) ? "hk2sp" : /^zh-tw\b/i.test(lang) ? "tw2sp" : "t2s");
  const CHUNK = 40, SAMPLE = 40, AHEAD = 20; // 一段几行；判 YouTube 的译文用前面几行；离已经翻好的结尾还剩几行时去翻下一段
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
  const on = () => !!st && st.enabled !== false && st.translate !== false;
  async function decide() {
    const my = ++epoch;
    mode = null; showOurs = true;
    render();
    if (!on() || !track) return;
    const ui = Y.uiLang();
    if (!track.tlang) {
      if (HANT.test(track.lang) && HANS.test(ui) && st.captionConvert !== false) { mode = { kind: "convert", scheme: schemeOf(track.lang) }; render(); }
      return;
    }
    if (st.captionFix === false) return;
    // a. 翻成简体中文、视频有人工的中文字幕：换成它（简体的优先）
    if (HANS.test(track.tlang)) {
      const human = tracks.filter((x) => x.kind !== "asr" && ZH.test(x.lang)).sort((a, b) => Number(HANT.test(a.lang)) - Number(HANT.test(b.lang)))[0];
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
    mode = { kind: "replace", why: "fixed", cues: src.map((c) => ({ t: c.t, d: c.d, text: null })), src, lang: track.lang, tlang: track.tlang, asked: new Set(), failed: false };
    ensureAhead();
  }
  // fixed：眼前这一段没翻就去翻（标准通道），离翻好的结尾不到 AHEAD 行就预翻下一段（flex）
  function ensureAhead() {
    const m = mode;
    if (!m || m.why !== "fixed" || m.failed) return;
    const i = Math.max(0, cueIndex(m.cues, now()));
    const want = [Math.floor(i / CHUNK)];
    if ((i % CHUNK) >= CHUNK - AHEAD) want.push(want[0] + 1);
    for (const [k, c] of want.entries()) {
      if (c * CHUNK >= m.cues.length || m.asked.has(c)) continue;
      m.asked.add(c);
      const my = epoch, lines = m.src.slice(c * CHUNK, (c + 1) * CHUNK).map((x) => x.text);
      send({ type: "captionTranslate", lines, srcLang: m.lang, target: m.tlang, flex: k > 0 }).then((r) => {
        if (my !== epoch || mode !== m) return;
        if (r.error || !Array.isArray(r.lines) || r.lines.length !== lines.length) { if (!r.retryable) m.failed = true; else m.asked.delete(c); return; }
        r.lines.forEach((x, k2) => { m.cues[c * CHUNK + k2].text = x; });
        render();
      });
    }
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
