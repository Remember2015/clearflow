// 清流会员的网页提示（0.30.0，草图 5）：后台发来 {type: "ffNotice", kind}，在页面底部中间显示一条，只这一次（后台记着提示过什么）。
// kind：ended（试用结束、会员到期）、quota_daily / quota_monthly（额度用完）、signed_out（登录失效）、paid（刚开通，几秒后自己消失）。
// 按钮经后台开设置页那一块（内容脚本打不开插件自己的页面）。放在 Shadow DOM 里，网站的样式碰不到；深浅色看页面背景
(function () {
  if (globalThis.__ffNotice) return;
  globalThis.__ffNotice = true;
  const t = (k, v) => (globalThis.FFI18n ? globalThis.FFI18n.t(k, v) : k);
  const open = (page) => { try { chrome.runtime.sendMessage({ type: "openPage", page }, () => void chrome.runtime.lastError); } catch (e) { /* 插件刚重载 */ } };
  function dark() {
    for (const el of [document.body, document.documentElement]) {
      const m = el && getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
      if (m && (m.length < 4 || Number(m[3]) > 0)) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 128;
    }
    return matchMedia("(prefers-color-scheme: dark)").matches;
  }
  const TEXT = {
    ended: (plan) => t(plan === "trial" ? "notice.trialEnded" : "notice.memberEnded"),
    quota_daily: () => t("notice.quotaDay"), quota_monthly: () => t("notice.quotaMonth"),
    signed_out: () => t("notice.signedOut"), paid: () => t("notice.paid"),
  };
  const BUTTONS = {
    ended: [["notice.subscribe", "plans", true], ["notice.useKey", "conn"]],
    quota_monthly: [["notice.useKey", "conn"]],
    signed_out: [["notice.signIn", "login", true]],
  };
  let host = null;
  function show(kind, plan) {
    if (!TEXT[kind]) return;
    if (host) host.remove();
    host = document.createElement("div");
    host.setAttribute("data-ff-notice", kind);
    const root = host.attachShadow({ mode: "open" });
    const d = dark();
    root.innerHTML = `<style>
.bar{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;max-width:min(640px,calc(100vw - 32px));box-sizing:border-box;
  display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;padding:10px 10px 10px 14px;border-radius:14px;font:14px/1.45 -apple-system,"Segoe UI",system-ui,sans-serif;
  background:${d ? "#20262f" : "#fff"};color:${d ? "#edf0f5" : "#0f1419"};box-shadow:0 0 0 .5px ${d ? "#47515f" : "#d2d7de"},0 8px 24px rgba(0,0,0,${d ? ".45" : ".14"})}
.i{flex:none;width:18px;height:18px;color:${d ? "#93baff" : "#0b57d0"}}
.tx{flex:1;min-width:200px}
button{font:inherit;font-size:13px;border:0;border-radius:9px;padding:6px 12px;cursor:pointer;background:none;color:inherit;box-shadow:inset 0 0 0 .5px ${d ? "#47515f" : "#c4cad3"}}
button.p{background:${d ? "#93baff" : "#0b57d0"};color:${d ? "#102745" : "#fff"};box-shadow:none}
button.x{padding:6px;line-height:0;box-shadow:none;color:${d ? "#c0cad6" : "#525b66"}}
button:focus-visible{outline:2px solid ${d ? "#93baff" : "#0b57d0"};outline-offset:2px}
</style><div class="bar" role="status"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/></svg><span class="tx"></span></div>`;
    const bar = root.querySelector(".bar");
    root.querySelector(".tx").textContent = TEXT[kind](plan);
    for (const [label, page, primary] of BUTTONS[kind] || []) {
      const b = document.createElement("button");
      b.type = "button";
      if (primary) b.className = "p";
      b.textContent = t(label);
      b.addEventListener("click", () => { open(page); host.remove(); host = null; });
      bar.appendChild(b);
    }
    const x = document.createElement("button");
    x.type = "button"; x.className = "x"; x.setAttribute("aria-label", t("notice.close"));
    x.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    x.addEventListener("click", () => { host.remove(); host = null; });
    bar.appendChild(x);
    document.documentElement.appendChild(host);
    if (kind === "paid") { const h = host; setTimeout(() => { if (host === h) { h.remove(); host = null; } }, 6000); }
  }
  try {
    chrome.runtime.onMessage.addListener((msg) => { if (msg && msg.type === "ffNotice") show(msg.kind, msg.plan); });
  } catch (e) { /* 插件刚重载 */ }
  globalThis.FFNoticeShow = show; // 测试用
})();
