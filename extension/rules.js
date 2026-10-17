// 本地规则（L1），与 jev_eval/code/final_pipeline.py 的 P2 对齐。
// 内容脚本里作为普通脚本加载（挂到 globalThis.FFRules）；Node 测试里 require 进来。
// 0.15.3 起只看结构、不认话术和语言（评估见 jev_eval/code/xr_general）：长度按"汉字当量"算（units），邀请码只认链接参数，
// base64 只看解出来的像不像链接 / 号码，D1 没有引流词表了；求推荐帖改由 Jev 问帖子本身（jev.js 的 POST_QUESTIONS）。
(function () {
  const MENT = /@([A-Za-z0-9_]{1,15})/g;
  const CJK = /[一-鿿]/;
  const URL_RE = /https?:\/\/\S+/g;
  // M1 用：去掉 @、链接、空白、表情、标点、数字后剩下的部分（按汉字当量算长度）
  const CORE_STRIP = /https?:\/\/\S+|[\/\s]|[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}~～!！?？。，,.:：#\d+\-]/gu;
  // 短文本豁免用：同上但保留数字和字母（"啰妹扣号2096209202" 不算短）
  const VIS_STRIP = /https?:\/\/\S+|[\/\s]|[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}~～!！?？。，,.:：#\-]/gu;
  // 邀请码：只认链接里的推广参数。以前还认"邀请码 / 推荐码"这几个中文字，换种语言就不灵，Jev 的"引流"那一问本来就认得出
  const AFF = /[?&#](ref|aff|code|invite|inviter|i)=[\w-]{3,}/i;
  const B64 = /(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{12,}={0,2}(?![A-Za-z0-9+/=])/g;
  // base64 解出来是能读的字，里面还有链接、域名、邮箱、@账号、电话那样的一串数字（7 位以上，可以隔空格、横线）、5 位以上的数字
  // 或"字母 + 数字"的号：藏的是联系方式。以前认 qq / 微信 / tg 这几个词，换成 WhatsApp、LINE 这些平台就漏（改写集上漏了 1 条）
  const CONTACTISH = /https?:\/\/|\b[\w-]+(\.[\w-]+)*\.[a-z]{2,}\b|@\w|\+?\d(?:[\s.-]?\d){6,}|\d{5,}|[A-Za-z]+[_-]?\d{3,}/i;

  // 长度按"汉字当量"算：汉字 1，假名 0.45，谚文 0.7，别的字母和数字 0.25（大约 4 个字母算一个字），符号不算。
  // 权重是把中文回复译成 10 种语言对出来的（每个汉字：英文 3.4、西班牙文 4.0、德文 4.4 个字母；日文 0.48 个汉字 + 1.17 个假名；韩文 1.4 个谚文字），
  // "很短的一句话"在哪种文字里都是差不多的长度。以前按字符数算，同一句话译成英文长了三四倍，M1 在拼音文字里几乎不生效（改写集上 39 条剩 4 条）
  const HAN = /\p{Script=Han}/u, KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u, HANGUL = /\p{Script=Hangul}/u, LN = /[\p{L}\p{N}]/u;
  function units(s) {
    let u = 0;
    for (const ch of s || "") u += HAN.test(ch) ? 1 : KANA.test(ch) ? 0.45 : HANGUL.test(ch) ? 0.7 : LN.test(ch) ? 0.25 : 0;
    return u;
  }

  function mentions(text) {
    return [...text.matchAll(MENT)].map((m) => m[1].toLowerCase());
  }
  function coreUnits(text) {
    return units(text.replace(MENT, "").replace(CORE_STRIP, ""));
  }
  function visibleLen(text) {
    return text.replace(MENT, "").replace(VIS_STRIP, "").length;
  }
  function decodeB64(s) {
    try {
      const pad = s + "=".repeat((4 - (s.length % 4)) % 4);
      const bin = typeof atob === "function" ? atob(pad) : Buffer.from(pad, "base64").toString("binary");
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (e) {
      return null;
    }
  }
  const readable = (d) => d.length >= 4 && !/[\x00-\x08\x0e-\x1f\x7f\ufffd]/.test(d) && (d.match(/[\p{L}\p{N}]/gu) || []).length / [...d].length >= 0.6;
  function b64Lure(text) {
    for (const m of text.matchAll(B64)) {
      const d = decodeB64(m[0]);
      if (d && readable(d) && CONTACTISH.test(d)) return d;
    }
    return null;
  }

  // 只 @ 了本帖之外的账号，且正文很短（不超过 maxLen 个汉字当量，默认 10）：X 上"@某号 + 擦边夸赞"的主力形态。
  // 带图片 / 视频的不算：X 数据里 M1 抓到的 39 条全是纯文字；带截图的"一句话 + @某人"多是点名开撕
  // （"绞杀评论区海狗@xxx" + 对方帖子的截图），交给 Jev 判。
  // 10 是 0.15.3 按汉字当量重定的、0.15.4 在 X 自己的数据上复核过：中文热帖里 M1 抓到的这类回复正文都不超过 10 个字
  // （以前的 15 按字符数算），8 会少抓 2 条、译成别的语言少 6 条；12 / 15 在 33 个多语言热帖（11 种语言、1149 条回复）上
  // 多折错 3 条。代价：多语言热帖上它一条垃圾都没抓到、折错 3 条（"Well said @某名人"这类，@ 名人的短回复在拼音文字里常见），
  // 主要是中文评论区里在用；设置里能关
  function m1(text, participants, maxLen = 10, media = false) {
    if (media) return null;
    const outsiders = mentions(text).filter((h) => !participants.has(h) && h !== "grok");
    if (outsiders.length && coreUnits(text) <= maxLen) return outsiders[0];
    return null;
  }

  // @ 了帖子外的号、稍长一点的（0.21.1）：M1 管不到（超过 10 个字），但这类回复在 X 上常见的是"一句挑逗话 + @ 推的号"
  // （用户报漏的就是这种：Jev 引流 / 推广两问 0.54–0.66，正好卡在线上）。不直接清理，只让 X 帖子页上
  // 引流、推广两问的门槛降 MENTION_NUDGE（content.js）。20 个字、0.1 是在 X 自己的标注集（eval_x + x_multi，1404 条回复）上定的：
  // 多清理 2 条，1 条是该清理的同一个模板、1 条误伤（德语"刚在 @某号 那儿看到"，0.53）；降到 0.55 不误伤，但用户报的那条换个主帖就 0.54、
  // 还会漏（jev_eval/code/xr_general/eval_mention_nudge.cjs）
  const MENTION_NUDGE_UNITS = 20, MENTION_NUDGE = 0.1;
  const mentionNudge = (text, participants, media = false) => (m1(text, participants, MENTION_NUDGE_UNITS, media) ? MENTION_NUDGE : 0);

  // "BTC""#amc" 这类拉丁短码不交给 Jev 判折叠；中文 4 字（"网课代刷"）照判
  // 「赞」「mark」这类回复（0.22）：哪几条要多问 Jev 那一问（jev.js 的 filler）——不超过 FILLER_UNITS 个汉字当量（去掉 @、链接、表情、
  // 标点、数字以后，大约 8 个汉字、6 个英文词），不带链接（带链接的是在给出处）。带图、带视频的由调用的地方排除（图本身就是内容）。
  // 8 按 X、小红书、YouTube 各自的数据定（jev_eval/code/xr_general/short_jev2.mjs）：放到 8 比 5 多抓的那些一条有内容的都没藏错
  const FILLER_UNITS = 8;
  const fillerShort = (text) => !!text && !!text.trim() && !/https?:\/\/|www\./i.test(text) && coreUnits(text) <= FILLER_UNITS;

  function shortExempt(text) {
    MENT.lastIndex = 0;
    return visibleLen(text) <= 4 && !CJK.test(text.replace(MENT, "")) && !/@[A-Za-z0-9_]/.test(text) && !/https?:\/\//.test(text);
  }

  // ---- 隐形字符打乱（0.19.1）：每个字中间塞零宽字符（ZWSP、ZWNJ、ZWJ、WJ……），读者看着一样，按字比对的过滤就认不出 ----
  // 正常文字里也有这些字符，但用在固定的地方：表情序列里的 ZWJ（👨‍👩‍👧）、阿拉伯文 / 波斯文 / 希伯来文 / 印度系 / 东南亚文字里的
  // ZWNJ、ZWJ，方向标记 LRM / RLM——这些不算。剩下的至少 4 个、而且不少于字母数字的四分之一才算。
  // 在所有标过的评测集（约 2.4 万条，X、YouTube、小红书、V2EX 和几份公开集，含改写成 10 种语言的）上只命中 1 条，是该折的
  // （2026-10-15 用户报的 X 帖子下面的一条色情引流，每个字中间都塞了零宽字符）
  const INVIS = /[\u200B-\u200F\u2060-\u2064\uFEFF\u180E\u034F\u115F\u1160\u3164\uFFA0\u00AD]/u;
  const EMOJI_PART = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u20E3]/u;
  const JOINING = /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Mongolian}]/u;
  const ALNUM = /[\p{L}\p{N}]/u;
  function hiddenChars(text) {
    const cs = [...(text || "")];
    let n = 0, vis = 0;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (ALNUM.test(c)) vis++;
      if (!INVIS.test(c) || c === "\u200E" || c === "\u200F") continue;
      if (c === "\u200C" || c === "\u200D") {
        let p = i - 1; while (p >= 0 && INVIS.test(cs[p])) p--;
        let q = i + 1; while (q < cs.length && INVIS.test(cs[q])) q++;
        const a = cs[p] || "", b = cs[q] || "";
        if ((EMOJI_PART.test(a) && EMOJI_PART.test(b)) || JOINING.test(a) || JOINING.test(b)) continue;
      }
      n++;
    }
    return n >= 4 && n >= 0.25 * Math.max(vis, 1) ? n : 0;
  }

  // 返回 {kind, detail} 或 null
  function localVerdict(text, participants, opts = {}) {
    const maxLen = opts.m1MaxLen ?? 10;
    if (opts.m1 !== false) {
      const h = m1(text, participants, maxLen, !!opts.media);
      if (h) return { kind: "m1", detail: "@" + h };
    }
    if (hiddenChars(text)) return { kind: "hidden", detail: "" };
    if (AFF.test(text)) return { kind: "aff", detail: "" };
    const d = b64Lure(text);
    if (d) return { kind: "b64", detail: d.slice(0, 40) };
    return null;
  }

  // ---- D1 同帖复读：去掉表情 / 标点 / @ / 链接 / 零宽字符后一字不差（或者近乎一样，见 mergeNear），≥3 个号在 6 小时内发 ----
  // （0.15.3 以前句子里带"主页 / 头像 / 不信你看"这类词时 2 个号就算；这张词表在哪份数据上都没多抓到一条，删了）
  // 链接：X 页面上的 innerText 把它拆成"https://"换行"t.cn/xxx"两段（2026-10-15 在真 X 上量的），协议后面允许有空白，不然整条链接留在句子里、
  // 只差链接的复读就成了不一样的话
  const SLOGAN_STRIP = /https?:\/\/\s*\S+|[\s\/]|[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200B}-\u{200F}\u{2060}\u{FEFF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{3000}-\u{303F}\u{FF00}-\u{FF0F}\u{FF1A}-\u{FF20}\u{FF3B}-\u{FF40}\u{FF5B}-\u{FF65}!-\/:-@\[-\x60{-~…—·“”‘’「」『』【】《》〈〉]/gu;
  function normSlogan(text) {
    return (text || "").replace(MENT, "").replace(SLOGAN_STRIP, "").toLowerCase();
  }
  // 你点"记住这句话"记下的句子：至少 8 个字符、5 种不同的字（你自己挑的，按字符算就够了）
  function sloganOk(n, minLen = 8, minDistinct = 5) {
    const chars = [...n];
    return chars.length >= minLen && new Set(chars).size >= minDistinct;
  }
  // 自动算的 D1：至少 minUnits 个汉字当量（默认 6，大约 24 个字母）、5 种不同的字。按字符数 8 算的时候，英文里
  // "thank you so much""i love this song"这种十几个字母的话真人也会撞（UCI 的 YouTube 评论里三个号一字不差的真人评论有 7 组）
  function dupOk(n, minUnits = 6) {
    return units(n) >= minUnits && new Set([...n]).size >= 5;
  }
  // 近乎一样的模板（0.19.1）：一批号用同一个模板、只换掉里面推的号或者链接——叫人去某个短视频号看"瓜"的长句每条换一个号，
  // 问"是不是帖子里说的那种人"的一句短话加短链每条换一个链接、偶尔换一个字——一字不差的比法认不出。去掉表情 / 标点 / 链接以后编辑距离不超过两成的并成一组。
  // 长句（两句都 ≥12 个汉字当量）直接比；短句真人也容易说得差不多，要两句的每一条都带链接才比。
  // 在所有标过的评测集（约 2.4 万条，见上面 hiddenChars）上比一字不差多折 39 条，都是该折的（YouTube 上 3 条没标过的，是三个号各发一遍的
  // 同一段骗局铺垫，其中一条故意打错一个词），没有一条折错。
  // 先用字的二元 / 三元组建索引挑出可能像的，再算编辑距离（超过上限就停），几千条评论的页面也不会慢
  const NEAR_SIM = 0.8, NEAR_LONG = 12, NEAR_MAX_CHARS = 300;
  const HAS_LINK = /https?:\/\/\s*\S/; // 同上：X 的 innerText 里协议和地址中间隔着换行
  // 编辑距离（a、b 是字的数组），只算对角线两边 max 宽的带子；超过 max 就返回 max + 1
  function editDistance(a, b, max) {
    const m = a.length, n = b.length, BIG = max + 1;
    if (Math.abs(m - n) > max) return BIG;
    let prev = new Array(n + 1).fill(BIG), cur = new Array(n + 1).fill(BIG);
    for (let j = 0; j <= Math.min(n, max); j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const lo = Math.max(1, i - max), hi = Math.min(n, i + max);
      cur.fill(BIG, Math.max(0, lo - 1), Math.min(n, hi + 1) + 1);
      if (lo === 1) cur[0] = i <= max ? i : BIG;
      let low = lo === 1 ? cur[0] : BIG;
      for (let j = lo; j <= hi; j++) {
        const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        cur[j] = v > BIG ? BIG : v;
        if (cur[j] < low) low = cur[j];
      }
      if (low > max) return BIG;
      [prev, cur] = [cur, prev];
    }
    return prev[n] > max ? BIG : prev[n];
  }
  // 近乎一样的比较是增量的：一个页面一份 nearState()（调用方存着、换页面重开），每次只把新出现的句子和以前的比。
  // 评论多的页面每次扫描都要重算 D1，全量两两比要上百毫秒，增量的只算新来的那几条
  const nearState = () => ({ keys: [], at: new Map(), info: [], index: new Map(), par: [] });
  const allLinked = (list) => list.every((it) => HAS_LINK.test(it.text || ""));
  function nearAdd(st, groups) {
    const find = (i) => (st.par[i] === i ? i : (st.par[i] = find(st.par[i])));
    for (const [n, list] of groups) {
      if (st.at.has(n)) { const x = st.info[st.at.get(n)]; if (x.link && !allLinked(list)) x.link = false; continue; } // 以后来了不带链接的同一句，不再拿它比
      const i = st.keys.length;
      const cs = [...n].slice(0, NEAR_MAX_CHARS), k = cs.length >= 16 ? 3 : 2, g = new Set(); // 短句用二元组：改一个字只坏两个
      for (let t = 0; t + k <= cs.length; t++) g.add(cs.slice(t, t + k).join(""));
      const a = { cs, g, long: units(n) >= NEAR_LONG, link: allLinked(list) };
      st.keys.push(n); st.at.set(n, i); st.info.push(a); st.par.push(i);
      if (a.long || a.link) {
        // 倒排索引：每个组合只看最近的 40 句（同一个模板发了几百条也连得上：并查集会把它们串起来）
        const shared = new Map(), la = cs.length;
        for (const gram of g) {
          const ids = st.index.get(gram);
          if (!ids) continue;
          for (let t = Math.max(0, ids.length - 40); t < ids.length; t++) {
            const j = ids[t], lb = st.info[j].cs.length;
            if (Math.min(la, lb) >= NEAR_SIM * Math.max(la, lb)) shared.set(j, (shared.get(j) || 0) + 1);
          }
        }
        for (const [j, c] of shared) {
          const b = st.info[j];
          if (c < 0.5 * Math.max(g.size, b.g.size) || find(i) === find(j)) continue; // 只是初筛，真正的判据是下面的编辑距离
          if (!(a.long && b.long) && !(a.link && b.link)) continue;
          const max = Math.floor((1 - NEAR_SIM) * Math.max(la, b.cs.length));
          if (editDistance(cs, b.cs, max) <= max) st.par[find(i)] = find(j);
        }
      }
      for (const gram of g) { if (!st.index.has(gram)) st.index.set(gram, []); st.index.get(gram).push(i); }
    }
    return find;
  }
  // groups: Map(口号 → [条…])，原地把近乎一样的几组并起来；并成的组用条数最多的那句当键
  function mergeNear(groups, st = nearState()) {
    if (groups.size < 2 && !st.keys.length) return;
    const find = nearAdd(st, groups);
    const comps = new Map();
    for (const n of groups.keys()) { const r = find(st.at.get(n)); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(n); }
    for (const ns of comps.values()) {
      if (ns.length < 2) continue;
      const head = ns.reduce((x, y) => (groups.get(y).length > groups.get(x).length ? y : x));
      const all = ns.flatMap((n) => groups.get(n));
      for (const n of ns) groups.delete(n);
      groups.set(head, all);
    }
  }
  // items: [{id, handle, text, time(ms|null)}]；返回 Map(口号 → [id…])；near: false 只认一字不差的；
  // nearCache：同一个页面反复调用时传同一份 nearState()（见上面），不传就每次从头比
  function findDupSlogans(items, postText, { minAuthors = 3, windowMs = 6 * 3600e3, minUnits = 6, near = true, nearCache = null } = {}) {
    const np = normSlogan(postText);
    const groups = new Map();
    for (const it of items) {
      const n = normSlogan(it.text);
      if (!dupOk(n, minUnits) || np.includes(n)) continue;   // 主帖里要求大家评论的那句话不算
      if (!groups.has(n)) groups.set(n, []);
      groups.get(n).push(it);
    }
    if (near) mergeNear(groups, nearCache || nearState());
    const out = new Map();
    for (const [n, g] of groups) {
      const authors = new Set(g.map((it) => (it.handle || "").toLowerCase()).filter(Boolean));
      if (authors.size < minAuthors) continue;
      const ts = g.map((it) => it.time).filter((t) => Number.isFinite(t));
      if (ts.length === g.length && Math.max(...ts) - Math.min(...ts) > windowMs) continue; // 真人自然重复会拉得很开
      out.set(n, g.map((it) => it.id));
    }
    return out;
  }

  // ---- 你标记的垃圾（0.27）：先在本地和样例比，不花请求 ----
  // 用户 10-17 截图：标了"是这一部吧 t.cn/…"，下面一模一样的、只换了链接的"是这部吧 t.cn/…"都没清理——一字不差的那句去掉链接只剩 5 个字，
  // 够不着"记住的句子"的长度；Jev 那一问给换了链接的只有 0.39。三种本地就认：
  // same 原文一字不差（连链接一起比，空白不算；短句也算）；link 推的是同一个链接（协议后面那串，至少 8 个字符；
  // 只有域名、而且是 X / YouTube / Reddit 这种大站的不算）；near 近乎一样的模板（和 D1 同一个判法：去掉表情、标点、链接后编辑距离
  // 不超过两成，长句直接比、短句要两边都带链接；去掉以后至少 3 个字，免得只有一个链接的回复互相都算像）。
  // YouTube 1756 条、X 370 条标过的评论上，拿别处的垃圾当"标过的"，同一模板 + 同一链接 0 条误伤（jev_eval/code/learn/）
  const MARK_LINK = /https?:\/\/\s*([^\s…]+)/gi;
  const BIG_SITES = /^(www\.)?(x\.com|twitter\.com|youtube\.com|youtu\.be|reddit\.com|google\.com|xiaohongshu\.com|news\.ycombinator\.com|wikipedia\.org|github\.com)\/?$/i;
  const markLinks = (text) => {
    const out = new Set();
    for (const m of String(text || "").matchAll(MARK_LINK)) {
      const k = m[1].replace(/[)\]}>.,;:!?'"，。！？、）】」』]+$/u, "");
      if (k.length >= 8 && !BIG_SITES.test(k)) out.add(k.toLowerCase().startsWith("www.") ? k.slice(4) : k);
    }
    return out;
  };
  const squash = (text) => String(text || "").replace(/\s+/g, "").toLowerCase();
  // list：[{raw, text}]（feedback.js 存的；旧的只有 text）→ 预先算好的样例
  function markedPrep(list) {
    return (list || []).map((x) => {
      const raw = typeof x.raw === "string" && x.raw ? x.raw : "";
      const n = raw ? normSlogan(raw) : String(x.text || "");
      return { full: raw ? squash(raw) : "", links: markLinks(raw), cs: [...n].slice(0, NEAR_MAX_CHARS), long: units(n) >= NEAR_LONG, link: HAS_LINK.test(raw) };
    }).filter((x) => x.full || x.cs.length);
  }
  // 这条回复像不像哪一条样例：{kind: "same" | "link" | "near", detail}，都不像给 null
  function markedMatch(text, prepared) {
    if (!prepared || !prepared.length || !text) return null;
    const full = squash(text), links = markLinks(text), n = normSlogan(text), cs = [...n].slice(0, NEAR_MAX_CHARS);
    const long = units(n) >= NEAR_LONG, link = HAS_LINK.test(text);
    let near = null;
    for (const p of prepared) {
      if (p.full && p.full.length >= 2 && p.full === full) return { kind: "same" };
      for (const k of p.links) if (links.has(k)) return { kind: "link", detail: k };
      if (!near && cs.length >= 3 && p.cs.length >= 3 && ((long && p.long) || (link && p.link))) {
        // 两成：1 - 0.8 是 0.19999…，5 个字乘出来 0.9999… 取整成 0，所以加一点再取整（D1 那边一直是这样算的，没动它）
        const max = Math.floor((1 - NEAR_SIM) * Math.max(cs.length, p.cs.length) + 1e-9);
        if (editDistance(cs, p.cs, max) <= max) near = { kind: "near" };
      }
    }
    return near;
  }
  const api = { markedPrep, markedMatch, mentions, units, coreUnits, visibleLen, FILLER_UNITS, fillerShort, b64Lure, m1, mentionNudge, MENTION_NUDGE_UNITS, MENTION_NUDGE, shortExempt, hiddenChars, localVerdict, normSlogan, sloganOk, dupOk, editDistance, nearState, findDupSlogans };
  globalThis.FFRules = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
