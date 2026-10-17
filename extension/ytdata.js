// YouTube 页面数据（页面自己的 JS 环境里跑，MAIN world，document_start）：评论的作者是谁、是不是这个频道的主人，只在接口返回里有
// （页面上的名牌认证频道也有，不一定是频道主；Polymer 组件上的数据内容脚本那边读不到），照 X 的 pagedata.js 的办法旁听：
// - 评论：youtubei/v1/next 的返回里 frameworkUpdates.entityBatchUpdate.mutations[].payload.commentEntityPayload
//   （properties.commentId、content.content 正文全文、replyLevel；author.channelId / displayName / isCreator / isVerified）；
// - 这个视频是谁的：ytInitialPlayerResponse.videoDetails（打开时）、yt-navigate-finish 事件里的 playerResponse（站内跳转）。
// 只读不改：fetch 照原样返回，读的是 clone()；用 window.postMessage({source: "ff-yt", …}) 交给内容脚本（ytdom.js）。
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
  const orig = window.fetch;
  if (typeof orig === "function") {
    window.fetch = function (input, init) {
      const p = orig.apply(this, arguments);
      try {
        const url = typeof input === "string" ? input : input && input.url;
        if (url && NEXT.test(String(url))) {
          p.then((r) => { try { r.clone().json().then(comments, () => {}); } catch (e) { /* 读不了就算了 */ } }, () => {});
        }
      } catch (e) { /* 不影响页面自己的请求 */ }
      return p;
    };
  }
  // 万一走的是 XHR（老版本的页面）：一样旁听
  const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) { try { this.__ffYtNext = NEXT.test(String(url)); } catch (e) {} return XO.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (this.__ffYtNext) this.addEventListener("load", () => { try { comments(JSON.parse(this.responseText)); } catch (e) { /* 不是 JSON */ } });
    return XS.apply(this, arguments);
  };
  // 打开时的这个视频；站内跳转换视频
  const first = () => { try { video(window.ytInitialPlayerResponse); } catch (e) {} };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", first, { once: true }); else first();
  document.addEventListener("yt-navigate-finish", (e) => { try { video(e?.detail?.response?.playerResponse); } catch (err) {} });
  // 内容脚本晚到的话问一声（插件刚重新加载、页面已经开着）
  window.addEventListener("message", (e) => { if (e.source === window && e.data && e.data.source === "ff-yt-ask") first(); });
})();
