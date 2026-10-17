#!/usr/bin/env python3
"""生成 test/inject_bundle.js：chrome API 替身 + settings.js + i18n_page.js + i18n.js + xdom.js + rules.js + foldbar.js + content.js + pagedata.js + translate.js + content.css。
（pagedata.js 在真插件里跑在页面自己的 JS 环境里，这里和别的脚本挤在同一个环境，事件照样通）
用途：不装插件、直接把内容脚本注入已登录的 X 页面（DevTools 控制台或浏览器自动化）看折叠效果。
替身里 Jev 一律返回 0.1 分（带"傻""绞杀"的辱骂分 0.9、带"露骨"的色情分 0.95；站点多问的问题（YouTube 的 setup）、某一条多问的（ask 里的 filler）也给 0.1；URL 加 ?jev={"片段":分} 可以指定某条的 benefit），测本地规则、阈值、折叠界面和诱饵帖提示。
首页翻译：替身按 window.__ffTxPlan[帖子 id] 回结果（没有就 keep），收到的请求存在 window.__ffTxMsgs；
在真 X 上看效果时设 window.__ffTxDemo = true，每条都回 replace（译文是"【替身译文】"加 Grok 的译文）。
帖子页补翻（translateFill，0.19.4 起短的几条拼成 translateFillBatch）：按 window.__ffTxPlan["fill:帖子 id"] 回，没有就回"【替身补翻】"加原文。
window.__ffNoJevKey = true 模拟没填 TypeSafe key（帖子页补翻照样工作，首页改进和评论区 Jev 不工作）。
用法（在 extension/ 下）: python3 test/build_inject_bundle.py [--content 旧版 content.js] [--out inject_bundle_old.js]
（--content/--out 用来拿旧版本在仿 X 页上对照复现 bug）"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.dirname(HERE)
read = lambda f: open(os.path.join(EXT, f), encoding="utf-8").read()

stub = r'''
(() => {
  if (window.__ffInjected) return; window.__ffInjected = true;
  const st = document.createElement("style"); st.textContent = %s; document.head.appendChild(st);
  window.__ffLog = [];
  const listeners = [];
  const marked = () => (chrome.storage.local._d.ff_confirmed_slogans || []).length > 0; // 标记过垃圾，"是不是同一类"那一问才有
  // onMessage：弹窗发来的消息（pageSummary），测试里用 window.__ffOnMessage[i](消息, {}, 回调) 代替弹窗问
  // i18n.detectLanguage 的替身：带西班牙文字母的算西班牙语、纯 ASCII 够长的算英语，别的认不准（真浏览器用 CLD）
  // window.__ffDetect(文本)：页面自己给语言（商店截图的展示页用，见 scripts/showcase.mjs）
  const detectLanguage = (text, cb) => setTimeout(() => cb(window.__ffDetect ? window.__ffDetect(text) : /[¿¡ñáéíóú]/i.test(text) ? { isReliable: true, languages: [{ language: "es", percentage: 96 }] }
    : /^[\x00-\x7f]{12,}$/.test(text) ? { isReliable: text.length >= 80, languages: [{ language: "en", percentage: 100 }] } : { isReliable: false, languages: [] }), 5); // 和真浏览器一样：短句子都说"不准\"
  globalThis.chrome = { i18n: { detectLanguage, getUILanguage: () => window.__ffUiLang || "zh-CN" }, runtime: { id: "fake-extension-id", lastError: undefined, onMessage: { addListener(f) { (window.__ffOnMessage ||= []).push(f); } }, sendMessage(msg, cb) {
    window.__ffLog.push(msg.type);
    let r = { ok: true };
    if (msg.type === "settings") r = { settings: { ...FFSettings.DEFAULTS, ...chrome.storage.local._d.ff_settings }, hasKey: !window.__ffNoJevKey, hasOrKey: true };
    if (msg.type === "folded") (window.__ffFolded ||= []).push(JSON.parse(JSON.stringify(msg.entry))); // 折叠记录（弹窗"判对了吗"用）
    if (msg.type === "evalRecord") (window.__ffEval ||= []).push(JSON.parse(JSON.stringify(msg))); // 评测记录：0.24 起去掉了，不该再有人发（reddit_headless 查它是空的）
    if (msg.type === "translate") {
      (window.__ffTxMsgs ||= []).push(JSON.parse(JSON.stringify(msg)));
      const plan = window.__ffTxPlan?.[msg.id];
      r = plan || (window.__ffTxDemo
        ? { action: "replace", tried: true, text: "【替身译文】" + msg.xText, model: "stub/model", weak: "natural", grokMin: 0.4, oursMin: 0.8, cached: false }
        : { action: "keep", grokMin: 0.9, cached: false });
    }
    let delay = 30;
    if (msg.type === "translateFill") {
      (window.__ffTxMsgs ||= []).push(JSON.parse(JSON.stringify(msg)));
      // 带标记的（评论、正文）："【替身补翻】"放进每一段里面，标记原样回；__ffTxPlan["fill:id"] 指定回什么（测模型把标记弄乱了）
      // window.__ffTxFn(消息)：页面自己给译文（商店截图的展示页用）
      r = window.__ffTxPlan?.["fill:" + msg.id] || window.__ffTxFn?.(msg) || { action: "fill", text: msg.markup ? msg.source.replace(/<p(\d+)>/g, "<p$1>【替身补翻】") : "【替身补翻】" + msg.source,
        model: msg.alt ? "stub/alt" : "stub/model", cost: 0, cached: false };
      // window.__ffTxDelay(消息) → 这一条多久回（测切块的长正文一块块换上）；同时在翻的有几条记在 __ffTxLive / __ffTxMaxLive
      if (window.__ffTxDelay) delay = window.__ffTxDelay(msg);
      window.__ffTxLive = (window.__ffTxLive || 0) + 1;
      window.__ffTxMaxLive = Math.max(window.__ffTxMaxLive || 0, window.__ffTxLive);
      const done = cb;
      cb = (x) => { window.__ffTxLive--; done(x); };
    }
    // 几条一起补翻（0.19.4）：每一条照单条那样回、也照单条记进 __ffTxMsgs（带 batch: 几条），批的大小记在 __ffTxBatches；
    // window.__ffTxBatchDrop(这一条) 为真的那条回 batch_miss（模型少回了一条）；延迟取这一批里最长的；同时在翻的按请求算。
    // 流式：每一条到了自己的延迟就先推一个 txPart（和后台 chrome.tabs.sendMessage 推的一样），整批最后回；
    // window.__ffTxNoPart = true 不推（推不到时只靠整批回来的）
    if (msg.type === "translateFillBatch") {
      const one = (m) => window.__ffTxPlan?.["fill:" + m.id] || window.__ffTxFn?.(m) || { action: "fill", text: m.markup ? m.source.replace(/<p(\d+)>/g, "<p$1>【替身补翻】") : "【替身补翻】" + m.source,
        model: "stub/model", cost: 0, cached: false };
      for (const m of msg.items) (window.__ffTxMsgs ||= []).push({ ...JSON.parse(JSON.stringify(m)), type: "translateFill", batch: msg.items.length });
      (window.__ffTxBatches ||= []).push(msg.items.length);
      (window.__ffTxBatchSrc ||= []).push(msg.items.map((m) => m.source));
      r = { results: msg.items.map((m) => (window.__ffTxBatchDrop && window.__ffTxBatchDrop(m) ? { error: "少了这一条", code: "batch_miss", retryable: true } : one(m))) };
      const delays = msg.items.map((m) => (window.__ffTxDelay ? window.__ffTxDelay(m) : 30));
      delay = Math.max(...delays) + 5;
      if (msg.rid && !window.__ffTxNoPart) r.results.forEach((x, k) => {
        if (x.action !== "fill") return;
        setTimeout(() => { (window.__ffTxParts ||= []).push([msg.items[k].id, Math.round(performance.now())]);
          for (const f of window.__ffOnMessage || []) f({ type: "txPart", rid: msg.rid, k, result: x }, {}, () => {}); }, delays[k]);
      });
      window.__ffTxLive = (window.__ffTxLive || 0) + 1;
      window.__ffTxMaxLive = Math.max(window.__ffTxMaxLive || 0, window.__ffTxLive);
      const done = cb;
      cb = (x) => { window.__ffTxLive--; done(x); };
    }
    // 只查缓存：window.__ffTxCacheSeed["id|源文"]（alt 的是 "id|alt|源文"）里有就给，没有给 null
    if (msg.type === "fillCachedBatch") {
      (window.__ffTxMsgs ||= []).push({ type: msg.type, n: msg.items.length });
      const seed = window.__ffTxCacheSeed || {};
      r = { results: msg.items.map((m) => seed[`${m.id}|${m.alt ? "alt|" : ""}${m.source}`] || null) };
    }
    if (msg.type === "jev") {
      window.__ffLastJev = msg;
      (window.__ffJevAll ||= []).push(JSON.parse(JSON.stringify(msg))); // 发过的每一次（查有没有把译文当原文发出去）
      // ?jev={"文本片段":0.55}：回复里含这个片段时 benefit 给这个分，测阈值用；{"文本片段":{"promo_mention":0.85}}：指定哪一问给多少
      let over = {}; try { over = JSON.parse(new URLSearchParams(location.search).get("jev") || "{}"); } catch (e) {}
      const s = {};
      // ?jevimg=0.9：带图（看图片开着时消息里有 images）的回复 benefit 给这个分（测只有图的垃圾）
      const imgScore = Number(new URLSearchParams(location.search).get("jevimg") || 0);
      for (const x of msg.replies) {
        const hit = Object.keys(over).find((k) => x.text && x.text.includes(k)), v = hit ? over[hit] : imgScore && x.images && x.images.length ? imgScore : null;
        s[x.id] = { benefit: typeof v === "number" ? v : 0.1, disguised: 0.1, promo_mention: 0.1, abuse: /傻|绞杀/.test(x.text) ? 0.9 : 0.1,
                    sexual: /露骨/.test(x.text) ? 0.95 : 0.05, ...Object.fromEntries([...(msg.extra || []), ...(x.ask || [])].map((k) => [k, 0.1])),
                    // 指定的分里只认问了的（没多问 setup 就不会有 setup 分；这一条没带 ask: ["filler"] 就不会有 filler 分，和真 Jev 一样）
                    ...(v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => ["benefit", "disguised", "promo_mention", "abuse", "sexual", ...(msg.extra || []), ...(x.ask || []), ...(marked() && !window.__ffNoMarkedInJev ? ["marked"] : [])].includes(k))) : {}) }; // __ffNoMarkedInJev：当作五问从缓存拿的、没有 marked
      }
      r = { scores: s };
    }
    // 帖子本身那一问（求推荐帖 rec）：网址加 ?rec=0.95 指定分，不加就是 0.02（普通帖子）；?recDelay=毫秒 让它晚点回来
    if (msg.type === "jevPost") {
      (window.__ffJevPost ||= []).push(JSON.parse(JSON.stringify(msg)));
      const q = new URLSearchParams(location.search);
      r = { scores: { rec: q.has("rec") ? Number(q.get("rec")) : 0.02 } };
      if (q.has("recDelay")) { const d = Number(q.get("recDelay")); setTimeout(() => cb(r), d); return; }
    }
    if (msg.type === "cachedForPost") r = { scores: window.__ffCached || {} };
    if (msg.type === "replyOverrides") r = { overrides: Object.fromEntries(msg.ids.filter((id) => chrome.storage.local._d["ff_reply_override:" + id]).map((id) => [id, chrome.storage.local._d["ff_reply_override:" + id].label])) };
    if (msg.type === "feedback") {
      const label = msg.entry.label === "confirm" ? "missed" : msg.entry.label;
      const set = { ["ff_reply_override:" + msg.entry.id]: { label } };
      // 手动清理掉一条没被清理的（missed）：和后台一样记进"你标记的垃圾"（0.26）
      if (msg.entry.label === "missed") set.ff_confirmed_slogans = [...(chrome.storage.local._d.ff_confirmed_slogans || []).filter((x) => x.source?.id !== msg.entry.id),
        { text: FFRules.normSlogan(msg.entry.text), raw: msg.entry.text, site: "", source: { id: msg.entry.id, postId: msg.entry.postId, handle: msg.entry.handle || "" }, createdAt: Date.now() }];
      chrome.storage.local.set(set);
      r = { ok: true, label };
    }
    if (msg.type === "sloganRemember" || msg.type === "sloganRemove") {
      const text = msg.text || FFRules.normSlogan(msg.entry.text), id = msg.id || (msg.entry && msg.entry.id);
      let slogans = (chrome.storage.local._d.ff_confirmed_slogans || []).filter((x) => !(x.text === text && FFRules.sloganOk(text)) && x.source?.id !== id);
      if (msg.type === "sloganRemember") slogans.push({ text, raw: msg.entry.text, site: "", source: msg.entry, createdAt: Date.now() });
      chrome.storage.local.set({ ff_confirmed_slogans: slogans });
    }
    // 你刚标了一条（0.26）：这一页没清理的问"是不是同一类"——?jev= 里给了 marked 的按它给，记下每次问了哪些
    if (msg.type === "markedCheck") {
      (window.__ffMarkedCheck ||= []).push(JSON.parse(JSON.stringify(msg)));
      let over = {}; try { over = JSON.parse(new URLSearchParams(location.search).get("jev") || "{}"); } catch (e) {}
      const s = {};
      if (marked()) for (const x of msg.replies) { const hit = Object.keys(over).find((k) => x.text && x.text.includes(k)); s[x.id] = hit && typeof over[hit] === "object" && typeof over[hit].marked === "number" ? over[hit].marked : 0.05; }
      r = { scores: s };
    }
    if (msg.type === "markUndo") {
      delete chrome.storage.local._d["ff_reply_override:" + msg.id];
      chrome.storage.local.set({ ff_confirmed_slogans: (chrome.storage.local._d.ff_confirmed_slogans || []).filter((x) => x.source?.id !== msg.id) });
      r = { ok: true };
    }
    setTimeout(() => cb(r), delay);
  } }, storage: { onChanged: { addListener(f) { listeners.push(f); } }, local: {
    _d: Object.assign({}, window.__ffSeed || {}),
    async get(k) { const ks = k === null ? Object.keys(this._d) : Array.isArray(k) ? k : [k]; return structuredClone(Object.fromEntries(ks.filter((x) => x in this._d).map((x) => [x, this._d[x]]))); },
    async set(o) { const ch = Object.fromEntries(Object.entries(o).map(([k,v]) => [k, {oldValue:this._d[k],newValue:v}])); Object.assign(this._d, structuredClone(o)); window.__ffStore = this._d; queueMicrotask(() => listeners.forEach((f) => f(ch, "local"))); },
    async remove(k) { for (const key of Array.isArray(k) ? k : [k]) delete this._d[key]; },
  } } };
})();
''' % repr(read("content.css"))

arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
content = open(arg("--content", os.path.join(EXT, "content.js")), encoding="utf-8").read()
out = arg("--out", "inject_bundle.js")
bundle = stub + "\n" + read("settings.js") + "\n" + read("i18n_page.js") + "\n" + read("i18n.js") + "\n" + read("xdom.js") + "\n" + read("rules.js") + "\n" + read("foldbar.js") + "\n" + content + "\n" + read("pagedata.js") + "\n" + read("translate.js") + "\n'injected';\n"
open(os.path.join(HERE, out), "w", encoding="utf-8").write(bundle)
print(len(bundle), "字符 → test/" + out)
# 别的站点（Reddit、Hacker News……）：同一个替身 + manifest 里这个站点的那组内容脚本（照 manifest 读，加了文件不用再改这里；
# 开发用的结构记录器不装）。test/fakex/reddit/ 下的仿 Reddit 页面加载 inject_reddit.js，test/fakex/hn/ 下的加载 inject_hn.js，fakex/xhs/ 下的加载 inject_xhs.js
import json as _json
_manifest = _json.load(open(os.path.join(EXT, "manifest.json"), encoding="utf-8"))
def site_scripts(host):
    # 页面环境里的（MAIN world，YouTube 的 ytdata.js 这种旁听页面数据的）放在前面：测试页里大家在同一个环境，照真页面的先后
    main = [f for cs in _manifest["content_scripts"] if cs.get("world") == "MAIN" and any(host in m for m in cs["matches"]) for f in cs["js"]]
    for cs in _manifest["content_scripts"]:
        if cs.get("world") != "MAIN" and any(host in m for m in cs["matches"]):
            return main + [f for f in cs["js"] if not f.endswith("_probe.js")]
    raise SystemExit("manifest 里没有 " + host + " 的内容脚本")
for name, host in [("reddit", "www.reddit.com"), ("hn", "news.ycombinator.com"), ("yt", "www.youtube.com"), ("xhs", "www.xiaohongshu.com")]:
    try:
        files = site_scripts(host)
    except SystemExit as e:
        print(e); continue
    code = stub + "\n" + "\n".join(read(f) for f in files) + "\n'injected';\n"
    open(os.path.join(HERE, f"inject_{name}.js"), "w", encoding="utf-8").write(code)
    print(len(code), f"字符 → test/inject_{name}.js（{len(files)} 个文件）")
