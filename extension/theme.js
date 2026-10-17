// 工具栏图标跟浏览器的深浅色走（0.16.1）：浅色是 Chrome 蓝底白图形（icons/icon-*），深色换成 Chrome 深色主色的浅蓝底（icons/dark-*）。
// 后台（service worker）没有 matchMedia，由插件的页面和各站点的内容脚本看 prefers-color-scheme（跟的是浏览器的外观设置，不是网站自己的深色模式），
// 打开时说一次、变了再说一次；后台记着现在是哪一套，一样的不重设。
(() => {
  if (globalThis.__ffTheme) return;
  globalThis.__ffTheme = true;
  if (typeof matchMedia !== "function" || typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) return;
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const tell = () => { try { chrome.runtime.sendMessage({ type: "theme", dark: mq.matches }, () => void chrome.runtime.lastError); } catch (e) { /* 插件刚重新加载过 */ } };
  tell();
  mq.addEventListener("change", tell);
})();
