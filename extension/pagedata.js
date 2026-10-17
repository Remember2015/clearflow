// 在 X 页面自己的 JS 环境里跑（manifest 里 world: "MAIN"、run_at: "document_start"），给 translate.js 提供帖子的原文和 X 的译文：
// 有了它就不用去点"显示原文 / 显示翻译"，长帖也不用先展开。数据从哪来（都只读，不发任何请求）：
// ① X 自己的接口返回：页面一开始就在 XHR 和 fetch 上旁听 /i/api/graphql/… 的返回（时间线、帖子详情、搜索都是这个格式），
//    把里面每条帖子的原文、长帖全文、Grok 译文记在内存里（最多 3000 条，先进先出）。这是 X 前后端之间的数据格式，比 React 内部稳；
// ② 接口里没有的（插件晚于页面加载、记录被挤掉了）：退回 React 交给帖子组件的数据（xdom.js 的 fiberTweet）；
// ③ 都没有就回 missing，translate.js 退回点按钮读原文 / 等展开（长帖）。
// 读法（字段名、选择器）都在 xdom.js。translate.js 在隔离环境里，读不到页面的 JS 对象，所以走事件：
// 它发 ff-tx-ask（detail 是帖子 id），这里回 ff-tx-data（detail 是 JSON 字符串，src 说明数据来自 net 还是 fiber）。
// ff-pd-stats：探针（test/x_probe.js）问旁听的情况，回 ff-pd-stats-data。
(() => {
  if (window.__ffPageData) return;
  window.__ffPageData = true;
  const X = globalThis.FFX;
  const CAP = 3000;
  const net = new Map(); // 帖子 id → 记录（xdom.js 的 apiRecord 格式）
  const stats = { xhr: 0, fetch: 0, responses: 0, tweets: 0, errors: 0, since: Date.now() };
  function ingest(json, via) {
    stats.responses++;
    stats[via]++;
    stats.tweets += X.apiTweets(json, (rec) => {
      // 同一条帖子又来了一份：有的接口不带译文、长帖全文，别把先前记下的冲掉（X 改帖子会换新 id，同一个 id 内容不变）
      const old = net.get(rec.id);
      if (old) { if (!rec.tr) rec.tr = old.tr; if (!rec.note) rec.note = old.note; net.delete(rec.id); }
      net.set(rec.id, rec);
    });
    while (net.size > CAP) net.delete(net.keys().next().value);
  }

  // XHR（X 现在用的是它）：只看接口的请求，load 之后读返回，不改 X 拿到的东西
  const P = XMLHttpRequest.prototype, open = P.open, send = P.send;
  function onLoad() {
    try {
      if (this.status !== 200) return;
      const type = this.responseType;
      const j = type === "json" ? this.response : type === "" || type === "text" ? JSON.parse(this.responseText) : null;
      if (j && typeof j === "object") ingest(j, "xhr");
    } catch (e) { stats.errors++; }
  }
  P.open = function (method, url) {
    try { this.__ffApi = X.API_URL.test(String(url)); } catch (e) { this.__ffApi = false; }
    return open.apply(this, arguments);
  };
  P.send = function () {
    if (this.__ffApi) this.addEventListener("load", onLoad);
    return send.apply(this, arguments);
  };
  // fetch（以后 X 换成它也照样听得到）：读的是返回的副本
  const fetch0 = window.fetch;
  if (typeof fetch0 === "function") {
    window.fetch = function (input) {
      const p = fetch0.apply(this, arguments);
      try {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        if (X.API_URL.test(String(url))) p.then((r) => { if (r.ok) r.clone().json().then((j) => ingest(j, "fetch"), () => { stats.errors++; }); }, () => {});
      } catch (e) { /* 不影响 X 自己的请求 */ }
      return p;
    };
  }

  const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  // 图片、视频（也包括转发的别人帖子里的视频）在正文里留着一个 t.co：页面上显示成图或视频，这段字不显示，X 的译文里也没有。
  // 不去掉的话 Jev 会判 X 的译文"漏了内容"，换上的译文还会多出一条页面上本来没有的链接。
  // 别的 t.co 换成页面上显示的样子（https:// + display_url），和从页面读出来的正文一致；顺便记下 显示文字 → t.co
  function withLinks(text, urls, links, media) {
    let out = text;
    for (const u of media) out = out.split(u).join("");
    for (const u of Array.isArray(urls) ? urls : []) {
      if (!u || typeof u.url !== "string" || typeof u.display_url !== "string" || media.has(u.url)) continue;
      out = out.split(u.url).join("https://" + u.display_url);
      links[u.display_url.replace(/…$/, "")] = u.url;
    }
    return unescape(out).replace(/\s+$/, "");
  }
  // 短帖的正文按 display_text_range 截（去掉开头回复时带的 @ 和结尾的图片链接）；下标按码点算
  const visible = (full, range) => (range ? [...full].slice(range[0], range[1]).join("") : full);
  function answer(rec, src) {
    const links = {}, media = new Set(rec.media || []);
    const raw = rec.note ? rec.note.text : typeof rec.full === "string" ? visible(rec.full, rec.range) : null;
    if (raw == null) return null;
    const out = { id: rec.id, src, long: !!rec.note, source: withLinks(raw, rec.note ? rec.note.urls : rec.urls, links, media),
      srcLang: (rec.tr && rec.tr.src) || rec.lang || null, links };
    if (rec.tr) {
      out.translation = withLinks(rec.tr.text, rec.tr.urls, links, media);
      out.preview = rec.tr.preview;
      out.dest = rec.tr.dest;
    }
    return out;
  }
  function lookup(id) {
    const rec = net.get(id);
    if (rec) return answer(rec, "net");
    for (const a of X.articlesFor(id)) {
      const t = X.fiberTweet(a, id);
      if (t) return answer(X.fiberRecord(t), "fiber");
    }
    return null;
  }
  document.addEventListener("ff-tx-ask", (e) => {
    const id = String(e.detail || "");
    if (!/^\d{1,25}$/.test(id)) return;
    let out = null;
    try { out = lookup(id); } catch (err) { /* X 改了数据格式：当没找到 */ }
    document.dispatchEvent(new CustomEvent("ff-tx-data", { detail: JSON.stringify(out || { id, missing: true }) }));
  });
  document.addEventListener("ff-pd-stats", () => {
    document.dispatchEvent(new CustomEvent("ff-pd-stats-data", { detail: JSON.stringify({ ...stats, cached: net.size }) }));
  });
})();
