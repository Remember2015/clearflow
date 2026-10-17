// 带格式的翻译（Reddit 的评论、帖子正文）：译文里留住原文的链接、加粗、斜体、代码、列表、引用、换行。
// 做法：
// 1. 把原文拆成一段段（块：<p>、<li>、<h1>…、表格的格子……里面只有文字和行内元素的那一层），每段转成带标记的文字：
//    链接、加粗这类行内元素 → <t1>…</t1>（里面的字要翻），网址本身、u/账号 r/版块、代码、表情图片、Reddit 自己的小组件 → <x1/>（原样留着），
//    <br> → 换行。整块的代码（<pre>）、没有字的块不翻。
// 2. 交给模型时一段包一层 <p1>…</p1>，要它把标记原样留着（translator.js 的 MARKUP_ZH / MARKUP_EN）。
// 3. 拼回去：把原来的内容整个克隆一份（Reddit 的 class、列表、引用的结构都在），每段的行内内容换成译文——<tN> 照原来那个元素
//    浅克隆一个再放进译文、<xN/> 照原来的深克隆；克隆里去掉 id。
// 模型把标记弄丢、弄乱了（编号不对、不成对、多了少了）就退一步：这一段只放纯文字，但 <xN/>（网址这些）一个都不丢——
// 译文里出现的照原位置放，没出现的补在这一段最后。
// mixed（Hacker News 这种，0.14）：字和块混着放——HN 的评论第一段是裸文字、后面才是 <p>：夹在块中间的一串字和行内元素也算一段
// （Run：{run: true, nodes}），整个 root 里只有字和行内元素时 root 自己就是一段。往一段里放译文前用 holder() 拿到装它的元素
// （Run 先包一层 <span class=ff-rtx-run>）。
// 不碰 chrome.*，读页面也不靠 innerText（藏起来的元素读出来不一样，见 ffdom.js）。
(() => {
  if (globalThis.FFRich) return;
  const BLOCK = /^(P|DIV|LI|UL|OL|BLOCKQUOTE|PRE|H[1-6]|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|HR|FIGURE|FIGCAPTION|SECTION|ARTICLE|DETAILS|SUMMARY|HEADER|FOOTER|DL|DT|DD)$/;
  const SKIP = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/;
  const ATOM_TAG = /^(IMG|SVG|CODE|KBD|SAMP|VIDEO|AUDIO|IFRAME|PICTURE|CANVAS|INPUT|BUTTON|SELECT|TEXTAREA)$/;
  const isBlock = (n) => n.nodeType === 1 && BLOCK.test(n.tagName);
  // 链接的字就是网址、账号、版块：原样留着（翻了也是一样，还容易被模型改坏）
  const LITERAL = /^(https?:\/\/\S+|www\.\S+|\/?(u|r|user)\/[\w-]+\/?|@[\w.]+|#[\p{L}\p{N}_]+|\$[A-Za-z]{1,6})$/iu;
  const atomic = (n, own) => {
    const tag = n.tagName;
    if (ATOM_TAG.test(tag) || tag.includes("-")) return true; // 图片、代码、Reddit 自己的组件（faceplate-…、shreddit-…）
    if (tag === "A") { const t = (n.textContent || "").trim(); return !t || LITERAL.test(t) || t === n.getAttribute("href"); }
    return !own(n) && !(n.textContent || "").trim(); // 没字的行内元素（图标之类）
  };

  // 一段段：只看 root 里面、不是插件自己放的东西（own(元素) 为真的跳过）
  const hasContent = (n) => n.nodeType === 1 || (n.nodeType === 3 && n.nodeValue.trim());
  function blocks(root, own = () => false, { mixed = false } = {}) {
    if (mixed) return mixedBlocks(root, own);
    const out = [];
    const walk = (el) => {
      for (const n of el.childNodes) {
        if (n.nodeType !== 1 || SKIP.test(n.tagName) || own(n)) continue;
        if (!isBlock(n)) continue;
        if (n.tagName === "PRE") continue; // 整块代码不翻
        if ([...n.children].some((c) => isBlock(c) && !own(c))) walk(n); // 里面还有块：往下找
        else out.push(n);
      }
    };
    // root 自己就是一段（比如只有文字的评论 div）
    if (![...root.children].some((c) => isBlock(c) && !own(c))) return [root];
    walk(root);
    return out;
  }

  function mixedBlocks(root, own) {
    const out = [];
    const blockKids = (el) => [...el.children].some((c) => isBlock(c) && !own(c));
    const walk = (el) => {
      let run = null;
      const flush = () => { if (run && run.nodes.some(hasContent)) out.push(run); run = null; };
      for (const n of [...el.childNodes]) {
        if (n.nodeType === 1 && (SKIP.test(n.tagName) || own(n))) continue;
        if (n.nodeType === 1 && isBlock(n)) {
          flush();
          if (n.tagName === "PRE") continue; // 整块代码不翻
          if (blockKids(n)) walk(n); else if ([...n.childNodes].some(hasContent)) out.push(n);
          continue;
        }
        if (n.nodeType === 1 || n.nodeType === 3) (run ||= { run: true, nodes: [] }).nodes.push(n);
      }
      flush();
    };
    if (!blockKids(root)) return [root];
    walk(root);
    return out;
  }
  // 装这一段的元素：块元素就是它自己；Run 先包一层 span（放译文、标"翻译中"都在它上面）
  function holder(b) {
    if (!b.run) return b;
    const span = document.createElement("span");
    span.className = "ff-rtx-run";
    b.nodes[0].before(span);
    span.append(...b.nodes);
    return span;
  }
  // 一段转成带标记的文字。parts[N] 是 <tN> / <xN/> 对应的原来那个元素
  function serialize(block, own = () => false) {
    const parts = [null];
    const walk = (el) => {
      let s = "";
      for (const n of el.run ? el.nodes : el.childNodes) {
        if (n.nodeType === 3) { s += n.nodeValue.replace(/\s+/g, " "); continue; }
        if (n.nodeType !== 1 || SKIP.test(n.tagName) || own(n)) continue;
        if (n.tagName === "BR") { s += "\n"; continue; }
        const i = parts.length;
        parts.push(n);
        if (atomic(n, own)) s += `<x${i}/>`;
        else s += `<t${i}>${walk(n)}</t${i}>`;
      }
      return s;
    };
    const text = walk(block).replace(/ *\n */g, "\n").replace(/^ +| +$/g, "");
    return { text, parts, plain: plainOf(text, parts) };
  }
  // 带标记的文字 → 纯文字（<xN/> 换成它原来的字）：认语言、算长度、判断有没有字可翻用
  function plainOf(text, parts) {
    return text.replace(/<x(\d+)\/>/g, (_, i) => (parts[i] ? ` ${(parts[i].textContent || "").trim()} ` : " ")).replace(/<\/?t\d+>/g, "").replace(/ {2,}/g, " ").trim();
  }

  // ---------- 读模型的输出 ----------
  // 一块请求里几段：<p1>…</p1><p2>…</p2>；返回 [段 1 的文字, 段 2 的……]，对不上（少了、多了、编号乱了）返回 null
  function splitParas(out, n) {
    const res = [];
    const re = /<p(\d+)>([\s\S]*?)<\/p\1>/g;
    for (const m of out.matchAll(re)) res[Number(m[1]) - 1] = m[2].trim();
    if (res.length === n && res.every((x) => typeof x === "string")) return res;
    if (n === 1 && !/<\/?p\d+>/.test(out)) return [out.trim()]; // 只有一段、模型把外面那层丢了
    return null;
  }
  // 一段译文 → 记号：文字、<tN>、</tN>、<xN/>。检查：原文里的 <xN/>、<tN> 每个都在、正好一次，<tN> 成对且嵌套对，没有原文里没有的编号
  // （只查"有没有"还不够：实测模型会丢掉一个 <t1>、把 <t1> 挪去包别的词——链接就指错地方了）
  function tokens(text, parts, src) {
    const toks = [];
    const re = /<(\/?)t(\d+)>|<x(\d+)\/>/g;
    let last = 0;
    for (const m of text.matchAll(re)) {
      if (m.index > last) toks.push({ text: text.slice(last, m.index) });
      if (m[3]) toks.push({ x: Number(m[3]) });
      else toks.push({ t: Number(m[2]), close: m[1] === "/" });
      last = m.index + m[0].length;
    }
    if (last < text.length) toks.push({ text: text.slice(last) });
    // 原文里有哪些标记
    const want = new Set([...src.matchAll(/<x(\d+)\/>/g)].map((m) => Number(m[1])));
    const wantT = new Set([...src.matchAll(/<t(\d+)>/g)].map((m) => Number(m[1])));
    const seenX = new Set(), seenT = new Set(), stack = [];
    let ok = true;
    for (const k of toks) {
      if (k.x != null) { if (!want.has(k.x) || seenX.has(k.x) || !parts[k.x]) ok = false; seenX.add(k.x); }
      else if (k.t != null && !k.close) { if (!wantT.has(k.t) || seenT.has(k.t) || !parts[k.t]) ok = false; seenT.add(k.t); stack.push(k.t); }
      else if (k.t != null) { if (stack.pop() !== k.t) ok = false; }
    }
    if (stack.length || seenX.size !== want.size || seenT.size !== wantT.size) ok = false;
    return { toks, ok };
  }
  // 往一段（克隆出来的那个块）里放译文
  function fill(blockEl, text, parts, src) {
    const { toks, ok } = tokens(text, parts, src);
    const frag = document.createDocumentFragment();
    const addText = (parent, s) => s.split("\n").forEach((line, i) => { if (i) parent.append(document.createElement("br")); if (line) parent.append(line); });
    const clean = (e) => { e.removeAttribute("id"); for (const x of e.querySelectorAll("[id]")) x.removeAttribute("id"); return e; };
    if (ok) {
      const stack = [frag];
      for (const k of toks) {
        const top = stack[stack.length - 1];
        if (k.text != null) addText(top, k.text);
        else if (k.x != null) top.append(clean(parts[k.x].cloneNode(true)));
        else if (!k.close) { const e = clean(parts[k.t].cloneNode(false)); top.append(e); stack.push(e); }
        else stack.pop();
      }
    } else {
      // 退一步：纯文字，网址这些（<xN/>）一个不丢
      const used = new Set();
      for (const k of toks) {
        if (k.text != null) addText(frag, k.text);
        else if (k.x != null && parts[k.x] && !used.has(k.x)) { used.add(k.x); frag.append(clean(parts[k.x].cloneNode(true))); }
      }
      for (const m of src.matchAll(/<x(\d+)\/>/g)) {
        const i = Number(m[1]);
        if (!used.has(i) && parts[i]) { used.add(i); frag.append(" ", clean(parts[i].cloneNode(true))); }
      }
    }
    blockEl.replaceChildren(frag);
    return ok;
  }
  globalThis.FFRich = Object.freeze({ blocks, holder, serialize, plainOf, splitParas, tokens, fill });
})();
