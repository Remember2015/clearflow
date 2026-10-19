// 界面和原文都是拉丁字母时的翻译（0.25：以前一律不翻）：Reddit、YouTube、Hacker News 共用的翻译引擎（tx_engine.js）认了是哪种语言再定。
// 替身的 detectLanguage（build_inject_bundle.py）：带西班牙文字母的算西班牙语（认得准）、纯 ASCII 够长的算英语（80 字以上才"认得准"），别的认不准。
// ① Reddit 英文帖子页 post_en.html，英文界面：西班牙文评论翻成英文（原文语言 es），日文、中文照旧翻，英文的（帖子、评论、夹了个汉字的那条）不翻；
//    说明写"Translated from Spanish"；再扫一遍不再认语言、不发请求。①b 浏览器"认得准"地认成冷门语言（加利西亚语）的不翻。
// ② 同一页，西班牙文界面：英文的帖子标题、正文、评论都翻成西班牙文（短的认不准，照帖子标的 en），西班牙文的那条不翻。
// ③ Hacker News 评论页，西班牙文界面：英文评论翻、中文的也翻；英文界面：英文的不翻、中文的翻。
// ④ YouTube 视频页，英文界面：西班牙文评论翻成英文，英文评论不翻。
// ⑤ YouTube 简介是一段英文、末尾一行日文标签"キャンプ"（0.27.5，用户 10-18 截图）：中文界面翻、原文语言不写日语；日文界面也翻（以前整段当成日文、不翻）。
// ⑥ 所有文字都先问浏览器（0.28，用户 10-18 定）：Reddit 英文帖子页，替身浏览器把全是汉字的认成中文（认得准）、有假名的认成日文——
//    日文界面：中文评论翻（原文语言 zh，以前全是汉字的在日文界面一律不翻），日文评论不翻；中文界面：浏览器认得准地说中文那条是日文的，照翻。
// 目标语言是网站自己的界面语言（<html lang>），测试里和插件的界面语言一起换。
// 用法：node test/latin_tx_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]（run_all.mjs 会起服务）
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  // 用某个界面语言打开一页，等翻译跑完，返回发出去的补翻请求 [id, 原文语言, 目标语言, 原文]
  async function open(url, lang) {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    // 目标语言跟着网站自己的界面语言走（<html lang>，HN 没有就用插件的界面语言）：两个都换成 lang
    await page.evaluateOnNewDocument((l) => {
      window.__ffUiLang = l;
      const mo = new MutationObserver(() => { if (document.documentElement) { document.documentElement.lang = l; mo.disconnect(); } });
      mo.observe(document, { childList: true });
    }, lang);
    await page.setViewport({ width: 900, height: 2400 });
    await page.goto(`${BASE}${url}`, { waitUntil: "load" });
    await wait(4000);
    const msgs = await page.evaluate(() => (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").map((m) => [m.id, m.srcLang, m.target, m.source]));
    return { page, msgs };
  }
  const ids = (msgs) => [...new Set(msgs.map((m) => m[0]))].sort(); // 帖子的标题、正文都记在帖子的 id 下
  const asked = (msgs, re) => msgs.filter((m) => re.test(m[3].replace(/<\/?[ptx]\d+\/?>/g, "")));
  try {
    // ① Reddit，英文界面
    let { page, msgs } = await open("/fakex/reddit/post_en.html", "en");
    ok("Reddit 英文界面：西班牙文、日文、中文评论翻，英文的帖子和评论（含夹了个汉字的）不翻",
      JSON.stringify(ids(msgs)) === JSON.stringify(["t1_e2", "t1_e5", "t1_e6"]), JSON.stringify(ids(msgs)));
    const es = msgs.find((m) => m[0] === "t1_e6");
    ok("Reddit 英文界面：西班牙文那条原文语言 es、目标 en", !!es && es[1] === "es" && es[2] === "en", JSON.stringify(es));
    const label = await page.evaluate(() => {
      const c = document.querySelector('shreddit-comment[thingid="t1_e6"]');
      return c?.querySelector(".ff-tx-label")?.textContent || null;
    });
    ok("Reddit 英文界面：西班牙文那条换上了，说明写 Translated from Spanish", /Spanish/.test(label || ""), String(label));
    // 再扫：认过是英文的不再认、不发请求
    await page.evaluate(() => {
      window.__ffDetectN = 0;
      const f = chrome.i18n.detectLanguage;
      chrome.i18n.detectLanguage = (t, cb) => { window.__ffDetectN++; f(t, cb); };
      document.body.appendChild(document.createElement("div")); window.scrollBy(0, 5);
    });
    await wait(2500);
    const again = await page.evaluate(() => ({ n: window.__ffDetectN, fills: (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill").length }));
    ok("Reddit 英文界面：再扫一遍，认过的不再认语言、不多发请求", again.n === 0 && again.fills === msgs.length, JSON.stringify(again));
    await page.close();

    // ② Reddit，西班牙文界面
    ({ page, msgs } = await open("/fakex/reddit/post_en.html", "es"));
    ok("Reddit 西班牙文界面：英文的帖子标题、正文和评论翻，日文、中文翻，西班牙文那条不翻",
      JSON.stringify(ids(msgs)) === JSON.stringify(["t1_e1", "t1_e2", "t1_e3", "t1_e4", "t1_e5", "t3_def456"]) && msgs.filter((m) => m[0] === "t3_def456").length === 2,
      JSON.stringify(msgs.map((m) => [m[0], m[3].slice(0, 30)])));
    const en = msgs.filter((m) => ["t1_e1", "t1_e3", "t1_e4"].includes(m[0]));
    ok("Reddit 西班牙文界面：英文评论原文语言 en、目标 es", en.length === 3 && en.every((m) => m[1] === "en" && m[2] === "es"), JSON.stringify(en));
    await page.close();

    // ①b 浏览器"认得准"地说成冷门语言（真 Chrome 常把短的西班牙文认成加利西亚语）：英文界面不翻
    {
      const page = await browser.newPage();
      await page.evaluateOnNewDocument(() => {
        window.__ffUiLang = "en";
        window.__ffDetect = (t) => /[¿¡]/.test(t) ? { isReliable: true, languages: [{ language: "gl", percentage: 100 }] }
          : /^[\x00-\x7f]{12,}$/.test(t) ? { isReliable: t.length >= 80, languages: [{ language: "en", percentage: 100 }] } : { isReliable: false, languages: [] };
        const mo = new MutationObserver(() => { if (document.documentElement) { document.documentElement.lang = "en"; mo.disconnect(); } });
        mo.observe(document, { childList: true });
      });
      await page.setViewport({ width: 900, height: 2400 });
      await page.goto(`${BASE}/fakex/reddit/post_en.html`, { waitUntil: "load" });
      await wait(4000);
      const m = await page.evaluate(() => (window.__ffTxMsgs || []).filter((x) => x.type === "translateFill").map((x) => x.id));
      ok("Reddit 英文界面：浏览器认成加利西亚语这种冷门语言的不翻（日文、中文照翻）", JSON.stringify([...new Set(m)].sort()) === JSON.stringify(["t1_e2", "t1_e5"]), JSON.stringify(m));
      await page.close();
    }

    // ③ Hacker News
    ({ page, msgs } = await open("/fakex/hn/item.html", "es"));
    ok("HN 西班牙文界面：英文评论翻（目标 es），中文的也翻",
      asked(msgs, /^Thanks, this is a really useful list/).length === 1 && asked(msgs, /^这个说法有道理/).length === 1 && msgs.every((m) => m[2] === "es"),
      JSON.stringify(msgs.map((m) => m[3].slice(0, 30))));
    await page.close();
    ({ page, msgs } = await open("/fakex/hn/item.html", "en"));
    ok("HN 英文界面：英文的不翻，中文的翻",
      asked(msgs, /^Thanks, this is a really useful list/).length === 0 && asked(msgs, /^这个说法有道理/).length === 1 && msgs.every((m) => !/^[\x00-\x7f]+$/.test(m[3].replace(/<\/?[ptx]\d+\/?>/g, ""))),
      JSON.stringify(msgs.map((m) => m[3].slice(0, 30))));
    await page.close();

    // ④ YouTube，英文界面
    ({ page, msgs } = await open("/fakex/yt/watch.html", "en"));
    const ytEs = asked(msgs, /^¿Alguien de verdad gana dinero/);
    ok("YouTube 英文界面：西班牙文评论翻成英文（原文语言 es）", ytEs.length === 1 && ytEs[0][1] === "es" && ytEs[0][2] === "en", JSON.stringify(msgs.map((m) => [m[1], m[3].slice(0, 30)])));
    ok("YouTube 英文界面：英文评论不翻", asked(msgs, /^This explanation finally made|^Agreed, the second half/).length === 0, JSON.stringify(msgs.map((m) => m[3].slice(0, 30))));
    await page.close();

    // ⑤ 英文简介夹一行日文标签
    for (const lang of ["zh-CN", "ja"]) {
      const page = await browser.newPage();
      page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
      await page.evaluateOnNewDocument((l) => {
        window.__ffUiLang = l;
        let swapped = false;
        const mo = new MutationObserver(() => {
          if (document.documentElement && document.documentElement.lang !== l) document.documentElement.lang = l;
          const sn = document.querySelector("#attributed-snippet-text > span");
          if (sn && !swapped) { swapped = true; sn.textContent = "I set up a huge 2-story tent in the forest and enjoyed a peaceful night of solo camping in heavy rain with two dogs.\nキャンプ"; }
        });
        mo.observe(document, { childList: true, subtree: true });
      }, lang);
      await page.setViewport({ width: 900, height: 2400 });
      await page.goto(`${BASE}/fakex/yt/watch.html`, { waitUntil: "load" });
      await wait(4000);
      const m = await page.evaluate(() => (window.__ffTxMsgs || []).filter((x) => x.type === "translateFill" && /huge 2-story tent/.test(x.source)).map((x) => [x.srcLang, x.target]));
      ok(`YouTube ${lang} 界面：英文简介末尾一行"キャンプ"——照样翻（目标 ${lang.split("-")[0]}），原文语言不当日语`,
        m.length === 1 && m[0][0] !== "ja" && m[0][1].split("-")[0] === lang.split("-")[0], JSON.stringify(m));
      await page.close();
    }

    // ⑥ 所有文字都先问浏览器
    const cldPage = async (lang, sayJa, unsure = false) => {
      const page = await browser.newPage();
      page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
      await page.evaluateOnNewDocument((l, sayJa, unsure) => {
        window.__ffUiLang = l;
        window.__ffDetect = (t) => /[\u3040-\u30ff]/.test(t) ? { isReliable: true, languages: [{ language: "ja", percentage: 98 }] }
          : /\p{Script=Han}/u.test(t) ? { isReliable: !unsure, languages: [{ language: sayJa ? "ja" : "zh-CN", percentage: unsure ? 60 : 95 }] }
          : /[¿¡]/.test(t) ? { isReliable: true, languages: [{ language: "es", percentage: 96 }] }
          : { isReliable: t.length >= 40, languages: [{ language: "en", percentage: 97 }] };
        const mo = new MutationObserver(() => { if (document.documentElement) { document.documentElement.lang = l; mo.disconnect(); } });
        mo.observe(document, { childList: true });
      }, lang, sayJa, unsure);
      await page.setViewport({ width: 900, height: 2400 });
      await page.goto(`${BASE}/fakex/reddit/post_en.html`, { waitUntil: "load" });
      await wait(4000);
      const m = await page.evaluate(() => (window.__ffTxMsgs || []).filter((x) => x.type === "translateFill").map((x) => [x.id, x.srcLang, x.target]));
      await page.close();
      return m;
    };
    let m = await cldPage("ja", false);
    const zhC = m.filter((x) => x[0] === "t1_e2"), jaC = m.filter((x) => x[0] === "t1_e5");
    ok("先问浏览器，日文界面：全是汉字、浏览器认得准是中文的评论翻（原文语言 zh），日文评论不翻",
      zhC.length === 1 && zhC[0][1] === "zh" && zhC[0][2] === "ja" && jaC.length === 0, JSON.stringify(m));
    m = await cldPage("ja", false, true);
    const zhU = m.filter((x) => x[0] === "t1_e2"), jaU = m.filter((x) => x[0] === "t1_e5");
    ok("浏览器认不准，日文界面：全是汉字的评论按文字算是中文，照翻（0.28.2）；有假名的日文不翻",
      zhU.length === 1 && zhU[0][1] === "zh" && jaU.length === 0, JSON.stringify(m));
    m = await cldPage("zh-CN", true);
    const e2 = m.filter((x) => x[0] === "t1_e2");
    ok("先问浏览器，中文界面：全是汉字、但浏览器认得准是日文的评论照翻（原文语言 ja）", e2.length === 1 && e2[0][1] === "ja", JSON.stringify(m));

    // ⑦ 0.28.6（review）：@账号、英文 #话题、不带 http 的域名不算这种语言的字——中文界面，浏览器认不准（替身对非 ASCII 的都说认不准）时，
    //    "@SomeLongEnglishChannelName 我觉得说得对"、"看这个 www.example.com/abc/def 太好笑了"都按中文算、不翻
    {
      const page = await browser.newPage();
      page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
      await page.evaluateOnNewDocument(() => {
        window.__ffUiLang = "zh-CN";
        const swap = { t1_e2: "@SomeLongEnglishChannelName 我觉得说得对", t1_e3: "看这个 www.example.com/abc/def 太好笑了 #funny" };
        const done = new Set();
        const mo = new MutationObserver(() => {
          if (document.documentElement && document.documentElement.lang !== "zh-CN") document.documentElement.lang = "zh-CN";
          for (const [id, t] of Object.entries(swap)) {
            const p = !done.has(id) && document.querySelector(`shreddit-comment[thingid="${id}"] [slot="comment"] p`);
            if (p) { p.textContent = t; done.add(id); }
          }
        });
        mo.observe(document, { childList: true, subtree: true });
      });
      await page.setViewport({ width: 900, height: 2400 });
      await page.goto(`${BASE}/fakex/reddit/post_en.html`, { waitUntil: "load" });
      await wait(4000);
      const m = await page.evaluate(() => (window.__ffTxMsgs || []).filter((x) => x.type === "translateFill").map((x) => x.id));
      ok("中文界面：\"@英文账号 + 中文\"、夹着域名和英文 #话题 的中文评论不翻（浏览器认不准时）", !m.includes("t1_e2") && !m.includes("t1_e3") && m.includes("t1_e1"), JSON.stringify(m));
      await page.close();
    }
  } catch (e) {
    out.push(`FAIL 出错 ${e.stack || e}`);
  } finally {
    await browser.close();
  }
  console.log(out.join("\n"));
  const fails = out.filter((l) => !l.startsWith("PASS")).length;
  console.log(`\n${out.length - fails}/${out.length} PASS`);
  process.exit(fails ? 1 : 0);
})();
