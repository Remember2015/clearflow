// YouTube 页面数据（页面自己的 JS 环境里跑，MAIN world，document_start）：评论的作者是谁、是不是这个频道的主人，只在接口返回里有
// （页面上的名牌认证频道也有，不一定是频道主；Polymer 组件上的数据内容脚本那边读不到），照 X 的 pagedata.js 的办法旁听：
// - 评论：youtubei/v1/next 的返回里 frameworkUpdates.entityBatchUpdate.mutations[].payload.commentEntityPayload
//   （properties.commentId、content.content 正文全文、replyLevel；author.channelId / displayName / isCreator / isVerified）；
// - 这个视频是谁的：ytInitialPlayerResponse.videoDetails（打开时）、yt-navigate-finish 事件里的 playerResponse（站内跳转）。
// - 字幕（0.29.0，ytcaps.js 用）：现在选的是哪条字幕（播放器的 getOption("captions", "track")，每秒看一眼）、这个视频有哪几条；
//   播放器请求字幕（/api/timedtext）的返回；内容脚本要别的语言、YouTube 的自动翻译时，照播放器最近一次请求的网址改 lang / tlang 去要——
//   网址里带着播放器的凭据（pot 这些），自己拼的请求不带它会拿到空的（10-19 在真页面上试过：200 但没有内容）。
// 只读不改：fetch 照原样返回，读的是 clone()；用 window.postMessage({source: "ff-yt", …}) 交给内容脚本（ytdom.js、ytcaps.js）。
(() => {
  if (window.__ffYtData) return;
  window.__ffYtData = true;
  const post = (msg) => { try { window.postMessage({ source: "ff-yt", ...msg }, location.origin); } catch (e) { /* 页面关了 */ } };
  function comments(body) {
    const out = [];
    for (const m of body?.frameworkUpdates?.entityBatchUpdate?.mutations || []) {
      const c = m?.payload?.commentEntityPayload;
      const id = c?.properties?.commentId;
      if (!id) continue;
      out.push({ id, text: String(c.properties?.content?.content || "").slice(0, 5000), level: c.properties?.replyLevel || 0,
        channelId: c.author?.channelId || "", name: c.author?.displayName || "", creator: !!c.author?.isCreator, verified: !!c.author?.isVerified });
    }
    if (out.length) post({ type: "comments", items: out });
  }
  function video(pr) {
    const v = pr?.videoDetails;
    if (v && v.videoId) post({ type: "video", videoId: v.videoId, channelId: v.channelId || "", author: v.author || "" });
  }
  const NEXT = /\/youtubei\/v1\/next(?:[?#]|$)/;
  // ---- 字幕 ----
  const TT = /\/api\/timedtext(?:[?#]|$)/;
  const ttUrls = new Map(); // 视频 id → 播放器最近一次请求字幕的网址
  const cuesOf = (body) => (body?.events || []).filter((e) => Array.isArray(e.segs))
    .map((e) => ({ t: (e.tStartMs || 0) / 1000, d: (e.dDurationMs || 0) / 1000, text: e.segs.map((s) => s.utf8 || "").join("") })).filter((c) => c.text.trim());
  function sawTimedtext(url, text) {
    try {
      const u = new URL(url, location.href), v = u.searchParams.get("v");
      if (!v) return;
      ttUrls.delete(v); ttUrls.set(v, u.href);
      if (ttUrls.size > 20) ttUrls.delete(ttUrls.keys().next().value);
      if (u.searchParams.get("fmt") !== "json3" || typeof text !== "string" || !text) return;
      post({ type: "captions", vid: v, lang: u.searchParams.get("lang") || "", tlang: u.searchParams.get("tlang") || "", kind: u.searchParams.get("kind") || "", cues: cuesOf(JSON.parse(text)) });
    } catch (e) { /* 不是 JSON、网址不对：不管 */ }
  }
  const orig = window.fetch;
  if (typeof orig === "function") {
    window.fetch = function (input, init) {
      const p = orig.apply(this, arguments);
      try {
        const url = typeof input === "string" ? input : input && input.url;
        if (url && NEXT.test(String(url))) {
          p.then((r) => { try { r.clone().json().then(comments, () => {}); } catch (e) { /* 读不了就算了 */ } }, () => {});
        }
        if (url && TT.test(String(url))) p.then((r) => { try { r.clone().text().then((t) => sawTimedtext(String(url), t), () => {}); } catch (e) { /* 读不了就算了 */ } }, () => {});
      } catch (e) { /* 不影响页面自己的请求 */ }
      return p;
    };
  }
  // 万一走的是 XHR（老版本的页面）：一样旁听
  const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) { try { this.__ffYtNext = NEXT.test(String(url)); this.__ffYtTT = TT.test(String(url)) ? String(url) : null; } catch (e) {} return XO.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (this.__ffYtNext) this.addEventListener("load", () => { try { comments(JSON.parse(this.responseText)); } catch (e) { /* 不是 JSON */ } });
    if (this.__ffYtTT) this.addEventListener("load", () => {
      let text = null;
      try { text = !this.responseType || this.responseType === "text" ? this.responseText : this.responseType === "json" ? JSON.stringify(this.response) : null; } catch (e) { /* 读不了 */ }
      sawTimedtext(this.__ffYtTT, text);
    });
    return XS.apply(this, arguments);
  };
  // 现在选的是哪条字幕：{lang, kind（asr 是自动生成的）, tlang（选了"自动翻译"时翻成的语言）}，关着是 null；这个视频有哪几条 [{lang, kind}]
  let trackKey = "";
  function trackNow(force = false) {
    const p = document.getElementById("movie_player");
    if (!p || typeof p.getOption !== "function") return;
    let tr = null, pr = null;
    try { tr = p.getOption("captions", "track"); } catch (e) { /* 字幕模块还没加载 */ }
    try { pr = typeof p.getPlayerResponse === "function" ? p.getPlayerResponse() : null; } catch (e) { /* 没有 */ }
    const vid = pr?.videoDetails?.videoId || new URLSearchParams(location.search).get("v") || "";
    const tracks = (pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []).map((x) => ({ lang: x.languageCode || "", kind: x.kind || "" }));
    const track = tr && tr.languageCode ? { lang: tr.languageCode, kind: tr.kind || "", tlang: tr.translationLanguage?.languageCode || "" } : null;
    const key = JSON.stringify([vid, track, tracks]);
    if (key === trackKey && !force) return;
    trackKey = key;
    post({ type: "captionTrack", vid, track, tracks });
  }
  setInterval(() => { if (!document.hidden && location.pathname === "/watch") trackNow(); }, 1000);
  // 内容脚本要别的语言 / YouTube 的自动翻译（同一个视频）：照播放器的网址改 lang、tlang、kind
  async function fetchTrack(d) {
    const base = ttUrls.get(String(d.vid || ""));
    if (!base) { post({ type: "captionGot", id: d.id, error: "nourl" }); return; }
    try {
      const u = new URL(base);
      u.searchParams.set("lang", String(d.lang || ""));
      if (d.tlang) u.searchParams.set("tlang", String(d.tlang)); else u.searchParams.delete("tlang");
      if (d.kind) u.searchParams.set("kind", String(d.kind)); else u.searchParams.delete("kind");
      u.searchParams.set("fmt", "json3");
      const r = await (orig || window.fetch).call(window, u.href, { credentials: "include" });
      const cues = cuesOf(await r.json());
      post({ type: "captionGot", id: d.id, cues });
    } catch (e) { post({ type: "captionGot", id: d.id, error: String(e && e.message || e) }); }
  }
  // 打开时的这个视频；站内跳转换视频
  const first = () => { try { video(window.ytInitialPlayerResponse); } catch (e) {} };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", first, { once: true }); else first();
  document.addEventListener("yt-navigate-finish", (e) => { try { video(e?.detail?.response?.playerResponse); } catch (err) {} });
  // 内容脚本晚到的话问一声（插件刚重新加载、页面已经开着）
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.source === "ff-yt-ask") first();
    if (e.data.source === "ff-yt-cap-ask") trackNow(true); // 字幕那边刚起来：报一下现在选的是哪条
    if (e.data.source === "ff-yt-cap-get") fetchTrack(e.data);
  });
})();
