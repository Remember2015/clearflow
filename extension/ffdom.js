// 各站点（Reddit、Hacker News……）读页面共用的几样，X 的在 xdom.js 里另有一套。不碰 chrome.*。
// - OWN：插件自己放进页面的东西（译文、说明、克隆的标题）都带这个 class；折叠条是 .ff-bar。读字、重扫时都跳过它们。
// - readText：一段内容的文字。自己走一遍 DOM 拼，不用 innerText——innerText 跟着显示走，元素藏起来（折叠了、换成译文了）以后
//   读到的是 textContent，空白、换行都不一样，会被当成新内容重判（Reddit 0.13.2 的"一闪一闪"）。块级元素之间换行，<br> 换行，
//   别的空白并成一个空格（<pre> 里照原样）。
(() => {
  if (globalThis.FFDom) return;
  const OWN = "ff-own";
  const BLOCK = /^(P|DIV|LI|UL|OL|BLOCKQUOTE|PRE|H[1-6]|TABLE|TR|HR|FIGURE|FIGCAPTION|SECTION|ARTICLE|DETAILS|SUMMARY|HEADER|FOOTER)$/;
  const SKIP = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/;
  const mine = (el) => !!el && el.nodeType === 1 && (el.classList.contains(OWN) || el.classList.contains("ff-bar"));
  function readText(el) {
    if (!el) return "";
    const out = [];
    const walk = (n, pre) => {
      if (n.nodeType === 3) { out.push(pre ? n.nodeValue : n.nodeValue.replace(/\s+/g, " ")); return; }
      if (n.nodeType !== 1 || SKIP.test(n.tagName) || mine(n)) return;
      if (n.tagName === "BR") { out.push("\n"); return; }
      const block = BLOCK.test(n.tagName);
      if (block) out.push("\n");
      for (const c of n.childNodes) walk(c, pre || n.tagName === "PRE");
      if (block) out.push("\n");
    };
    walk(el, false);
    return out.join("").replace(/[ \t\f\v ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  const uiLang = () => (document.documentElement.lang || navigator.language || "en").trim() || "en";
  // 页面底色是不是深的（站点自己没标深浅色时用）
  function darkByBg() {
    const m = (getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) || []).map(Number);
    return m.length >= 3 && (m[3] ?? 1) > 0 && 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2] < 128;
  }
  globalThis.FFDom = Object.freeze({ OWN, mine, readText, uiLang, darkByBg });
})();
