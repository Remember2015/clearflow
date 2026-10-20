// 界面语言测试（不调任何接口）：
// ① 仿 X 帖子页（test/fakex/status/123/?lang=xx，<html lang="xx">，从右往左的语言还带 dir="rtl"，和 X 一样）上，
//    折叠条、理由、按钮、X "…"菜单里的那一项跟着界面语言：英文逐字查；日语、阿拉伯语、葡萄牙语对照构建出来的 i18n_page.js，
//    阿拉伯语的折叠条从右往左排，"@账号"不被排反，分数和账号之间隔开。不带 ?lang（中文界面）是中文。
//    弹窗和设置页在 19 种语言下都放得下（打开真页面量：?uilang=xx 换语言，不撑宽、三档 / 类别 / 按钮不折行、开关不被挤扁）。
// ② 真插件装进无头 Chrome，界面语言是 en-US / zh-CN / ja / ar 时，设置页、弹窗是对应的语言（阿拉伯语 dir="rtl"），
//    扩展名按 _locales 换。
// 用法：先 python3 test/build_inject_bundle.py && python3 test/build_fakex.py，用 launch.json 的 ext-fakex 起服务，
// 然后 node test/i18n_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]
// 设了 SHOT_DIR 就把阿拉伯语的仿 X 页和设置页截图存进去，用来看从右往左的排版。
const fs = require("fs");
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const EXT = path.resolve(__dirname, "..");
const BASE = process.argv[3] || "http://localhost:8767";
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SHOT = process.env.SHOT_DIR;
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 0.22.1 起连着 3 条以上被折的合成一条：这里测的是一条条的折叠条，先把合起来的都点开（和用户点开一样）
const openGroups = async (pg) => { await pg.evaluate(() => document.querySelectorAll('.ff-group[aria-expanded="false"]').forEach((b) => b.click())); await new Promise((r) => setTimeout(r, 300)); };
const HAN = /[一-鿿]/;
const load = (f) => { new Function(fs.readFileSync(path.join(EXT, f), "utf8"))(); const s = globalThis.FFI18nStrings; delete globalThis.FFI18nStrings; return s; };
const PAGE = load("i18n_page.js"), ALL = load("i18n_all.js");
const extName = (dir) => JSON.parse(fs.readFileSync(path.join(EXT, "_locales", dir, "messages.json"), "utf8")).extName.message;
// 页面上没换掉的中文。日语也用汉字，不能只看有没有汉字：看有没有中文界面的原句（去掉占位符后 ≥4 字的片段）
function leftZh(text, code) {
  if (code !== "ja") return text.split("\n").filter((l) => HAN.test(l)).slice(0, 5);
  const found = new Set();
  for (const [k, v] of Object.entries(ALL["zh-CN"])) {
    if (ALL.ja[k] === v) continue;
    for (const piece of v.split(/\{\w+\}/)) if (piece.length >= 4 && HAN.test(piece) && text.includes(piece)) found.add(piece);
  }
  return [...found].slice(0, 5);
}

async function foldPage(browser, q, shot) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
  await page.setViewport({ width: 700, height: 1400 });
  await page.goto(`${BASE}/fakex/status/123/${q}`, { waitUntil: "load" });
  await wait(2500);
  await openGroups(page);
  const bars = await page.evaluate(() => [...document.querySelectorAll(".ff-bar")].map((b) => ({
    tag: b.querySelector(".ff-tag")?.textContent, reason: b.querySelector(".ff-reason")?.textContent, dir: getComputedStyle(b).direction,
    buttons: [...b.querySelectorAll("button")].map((x) => x.getAttribute("aria-label")) })));
  // "@账号"显示出来 @ 在左边（从右往左的界面里没隔离的话会排成 "user@"）：量 @ 和后面那个字的横坐标
  const order = await page.evaluate(() => [...document.querySelectorAll(".ff-bar .ff-who bdi, .ff-bar .ff-reason")].map((s) => {
    const node = s.firstChild, i = node ? node.textContent.indexOf("@") : -1;
    if (i < 0 || i + 1 >= node.textContent.length) return null;
    const r = document.createRange();
    const x = (k) => { r.setStart(node, k); r.setEnd(node, k + 1); return r.getBoundingClientRect().left; };
    return x(i) < x(i + 1);
  }).filter((v) => v != null));
  // 分数和"· @账号"之间留着空：按界面方向，账号那一段在分数后面（从右往左时在左边），中间隔 ≥4px
  const gaps = await page.evaluate(() => [...document.querySelectorAll(".ff-bar")].filter((b) => b.querySelector(".ff-score") && b.querySelector(".ff-who")).map((b) => {
    const sc = b.querySelector(".ff-score").getBoundingClientRect(), who = b.querySelector(".ff-who").getBoundingClientRect();
    return getComputedStyle(b).direction === "rtl" ? sc.left - who.right : who.left - sc.right;
  }));
  if (shot) await page.screenshot({ path: shot });
  // 打开一条没折叠的回复的"…"菜单，看插件加的那一项
  await page.evaluate(() => {
    const a = [...document.querySelectorAll('article[data-testid="tweet"]')].find((x) => x.querySelector('a[href*="/status/901"]'));
    a.querySelector('[data-testid="caret"]').click();
  });
  await wait(400);
  const menu = await page.evaluate(() => [...document.querySelectorAll(".ff-menuitem")].map((m) => m.textContent.trim()));
  await page.close();
  return { bars, menu, order, gaps };
}

(async () => {
  try {
    const plain = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-first-run"] });
    try {
      const en = await foldPage(plain, "?lang=en");
      const tags = en.bars.map((b) => b.tag);
      ok("英文界面：折叠条的标签是英文", tags.length >= 4 && tags.includes("Likely spam") && tags.includes("Likely abuse") && tags.includes("Likely sexual content"), JSON.stringify(tags));
      ok("英文界面：理由和按钮没有中文", en.bars.every((b) => !HAN.test(b.reason || "") && b.buttons.every((x) => !HAN.test(x || ""))), JSON.stringify(en.bars));
      ok("英文界面：理由说的是人话", en.bars.some((b) => /accounts posted the same line/.test(b.reason || "")) && en.bars.some((b) => /^@-mentions an account/.test(b.reason || "")),
        JSON.stringify(en.bars.map((b) => b.reason)));
      ok("英文界面：X 菜单里只加一项、是英文（0.21.2 起只有一项）", en.menu.length === 1 && en.menu[0] === "Hide this reply", JSON.stringify(en.menu));
      ok("英文界面：分数和账号之间隔开", en.gaps.length >= 3 && en.gaps.every((g) => g >= 4), JSON.stringify(en.gaps));
      const zh = await foldPage(plain, "");
      ok("中文界面：照旧是中文", zh.bars.some((b) => b.tag === "疑似垃圾回复") && JSON.stringify(zh.menu) === JSON.stringify(["清理掉这条"]), JSON.stringify([zh.bars.map((b) => b.tag), zh.menu]));
      // 和 X 的显示语言对齐的其他语言
      for (const lang of ["ja", "ar", "pt"]) {
        const r = await foldPage(plain, `?lang=${lang}`, SHOT && lang === "ar" && path.join(SHOT, "fakex-ar.png")), s = PAGE[lang];
        ok(`${lang} 界面：折叠条标签、X 菜单里那一项`, r.bars.length >= 4 && r.bars.some((b) => b.tag === s["cat.spam.tag"]) && JSON.stringify(r.menu) === JSON.stringify([s["bar.cleanThis"]]),
          JSON.stringify([r.bars.map((b) => b.tag), r.menu]));
        const text = r.bars.map((b) => [b.reason, ...b.buttons].join("\n")).join("\n");
        ok(`${lang} 界面：理由和按钮里没有中文原句`, leftZh(text, lang).length === 0, JSON.stringify(leftZh(text, lang)));
        if (lang === "ar") {
          ok("ar 界面：折叠条从右往左", r.bars.every((b) => b.dir === "rtl"), JSON.stringify(r.bars.map((b) => b.dir)));
          ok("ar 界面：@账号没被排反（账号、理由里的都是）", r.order.length >= 4 && r.order.every(Boolean), JSON.stringify(r.order));
          ok("ar 界面：分数和账号之间隔开、账号在分数后面", r.gaps.length >= 3 && r.gaps.every((g) => g >= 4), JSON.stringify(r.gaps));
        }
      }
    } finally { await plain.close(); }

    // 弹窗（340px）和设置页（0.16 起是 feed-filter/ui 里的 React + Base UI）：19 种语言都放得下——不撑出横向滚动、
    // 三档、类别、按钮、key 的状态都是一行，开关不被挤扁（插件自己的页面上 ?uilang=xx 换语言，见 i18n.js）
    {
      const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", pipe: true,
        args: ["--enable-unsafe-extension-debugging", "--no-first-run", "--lang=zh-CN", "-AppleLanguages", "(zh-CN)"], ignoreDefaultArgs: ["--disable-extensions"] });
      const misfit = [];
      try {
        const { id } = await (await browser.target().createCDPSession()).send("Extensions.loadUnpacked", { path: EXT });
        await wait(800);
        const page = await browser.newPage();
        page.on("pageerror", (err) => out.push(`PAGEERROR ${err.message}`));
        // 弹窗当普通标签页开时"当前标签页"是它自己：tabs 换成假的。?tab=none 假装是插件不管的网站，别的假装是 X 的帖子页（0.20 起弹窗按当前网站显示）
        await page.evaluateOnNewDocument(() => {
          const none = new URLSearchParams(location.search).get("tab") === "none";
          chrome.tabs.query = async () => [{ id: 4242, url: none ? "https://www.google.com/" : "https://x.com/a/status/1909000000000000001" }];
          chrome.tabs.sendMessage = (tid, msg, cb) => setTimeout(() => cb(none ? undefined : { site: "x", kind: "status", enabled: true, folds: { spam: 3, abuse: 2, sexual: 0 }, pending: 1, seen: 40, tx: { improved: 2, filled: 1 } }), 10);
        });
        await page.goto(`chrome-extension://${id}/options.html`, { waitUntil: "load" });
        const today = new Date().toLocaleDateString("sv-SE"), now = Date.now();
        await page.evaluate((today, now) => chrome.storage.local.set({ ff_key: "k", ff_or_key: "", ff_health: { jev: { code: "badkey", at: 1 } },
          ff_stats: { [today]: { posts: 179, profiles: 12, searches: 4, feeds: 3, fold_jev: 128, fold_abuse: 128, fold_sexual: 128, tokens: 1e6, tx_replaced: 56, tx_fill: 10, tx_usd: 0.1 } },
          ff_recent_folds: [{ id: "1910000000000000001", postId: "1909000000000000001", page: "status", handle: "@a_very_long_handle_x", name: "N", text: "测试 test ".repeat(30), kind: "abuse", reason: "r", scores: {}, at: now }],
          ff_confirmed_slogans: [{ text: "只入身体不入生活", at: now }] }), today, now);
        const fit = () => page.evaluate(() => {
          const bad = [];
          const one = (el) => { const cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
            return el.getBoundingClientRect().height <= lh * 1.5 + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 2; };
          // #cost、#feedback（0.24）：弹窗最下面的花费那一句和"反馈"不折行（放不下时右边整体换行）
          for (const el of document.querySelectorAll(".seg-item, .chip, .btn, .state, .menu-item, .adv-trigger, #cost, a#feedback")) if (el.offsetParent && !one(el)) bad.push(`${el.id || el.className.split(" ")[0]}:${el.textContent.trim().slice(0, 20)}`);
          for (const sw of document.querySelectorAll(".switch")) if (sw.getBoundingClientRect().width < 24) bad.push("switch squeezed"); // 0.16.1 起照 Chrome 的开关，26px 宽
          const doc = document.documentElement;
          return { over: doc.scrollWidth - doc.clientWidth, bad };
        });
        for (const l of Object.keys(ALL)) {
          await page.setViewport({ width: 340, height: 700 });
          await page.goto(`chrome-extension://${id}/popup.html?uilang=${l}`, { waitUntil: "load" });
          await page.waitForSelector("#todayN", { timeout: 4000 }).catch(() => {});
          let r = await fit();
          if (r.over > 0 || r.bad.length) misfit.push(`${l} 弹窗: ${r.over > 0 ? `宽出 ${r.over}px ` : ""}${r.bad.join(", ")}`);
          await page.goto(`chrome-extension://${id}/popup.html?uilang=${l}&tab=none`, { waitUntil: "load" });
          await page.waitForSelector("#unsupported", { timeout: 4000 }).catch(() => {});
          r = await fit();
          if (r.over > 0 || r.bad.length) misfit.push(`${l} 不支持的网站的弹窗: ${r.over > 0 ? `宽出 ${r.over}px ` : ""}${r.bad.join(", ")}`);
          await page.setViewport({ width: 720, height: 1400 });
          await page.goto(`chrome-extension://${id}/options.html?uilang=${l}`, { waitUntil: "load" });
          await page.waitForSelector("#fold", { timeout: 4000 }).catch(() => {});
          await page.click("#advTrigger").catch(() => {});
          await page.click("#sloganToggle").catch(() => {});
          await wait(250);
          r = await fit();
          if (r.over > 0 || r.bad.length) misfit.push(`${l} 设置页: ${r.over > 0 ? `宽出 ${r.over}px ` : ""}${r.bad.join(", ")}`);
          // 网站页（0.20）：Reddit 那一页有单独设置的提示，放不放得下
          await page.evaluate(async () => { const { ff_settings = {} } = await chrome.storage.local.get("ff_settings");
            await chrome.storage.local.set({ ff_settings: { ...ff_settings, rev: 5, sites: { reddit: { threshold: 0.5, dup: false } } } }); });
          await page.goto(`chrome-extension://${id}/options.html?uilang=${l}#site=reddit`, { waitUntil: "load" });
          await page.waitForSelector("#siteFold", { timeout: 4000 }).catch(() => {});
          await wait(250);
          r = await fit();
          if (r.over > 0 || r.bad.length) misfit.push(`${l} 网站页: ${r.over > 0 ? `宽出 ${r.over}px ` : ""}${r.bad.join(", ")}`);
          // 首次设置（0.23）：三步的按钮、勾、key 那一行放不放得下
          for (const step of [1, 2, 3]) {
            await page.goto(`chrome-extension://${id}/options.html?uilang=${l}#welcome`, { waitUntil: "load" });
            await page.waitForSelector("#welcomeNav", { timeout: 4000 }).catch(() => {});
            for (let k = 1; k < step; k++) { await page.click("#welcomeNext").catch(() => {}); await wait(150); }
            r = await fit();
            if (r.over > 0 || r.bad.length) misfit.push(`${l} 首次设置第 ${step} 步: ${r.over > 0 ? `宽出 ${r.over}px ` : ""}${r.bad.join(", ")}`);
          }
        }
      } finally { await browser.close(); }
      ok(`弹窗和设置页：${Object.keys(ALL).length} 种语言都放得下、三档 / 类别 / 按钮不折行、开关不被挤扁`, misfit.length === 0, misfit.join(" | "));
    }

    for (const [lang, code, expect] of [["en-US", "en", { h1: "Settings", fold: "Filtering rules", pop: "Hidden for you today", name: "ClearFlow" }],
      ["zh-CN", "zh-CN", { h1: "设置", fold: "清理规则", pop: "今天帮你清理", name: "清流" }],
      ["ja", "ja", { name: extName("ja") }],
      ["ar", "ar", { name: extName("ar"), rtl: true }]]) {
      const e = { h1: ALL[code]["opt.h1"], fold: ALL[code]["opt.foldTitle"], pop: ALL[code]["pop.today"], ...expect };
      const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", pipe: true,
        // 界面语言：Windows 认 --lang；macOS 要用 -AppleLanguages 覆盖系统偏好；Linux 看环境变量 LANGUAGE / LANG（0.28.12 以前 CI 上全成了英文）
        args: ["--enable-unsafe-extension-debugging", "--no-first-run", `--lang=${lang}`, "-AppleLanguages", `(${lang})`],
        env: { ...process.env, LANGUAGE: lang.replace("-", "_"), LANG: `${lang.replace("-", "_")}.UTF-8` }, // Linux 上 Chrome 的界面语言看这两个
        ignoreDefaultArgs: ["--disable-extensions"] });
      try {
        const { id } = await (await browser.target().createCDPSession()).send("Extensions.loadUnpacked", { path: EXT });
        await wait(800);
        const page = await browser.newPage();
        page.on("pageerror", (err) => out.push(`PAGEERROR ${err.message}`));
        // 弹窗当普通标签页开时"当前标签页"是它自己：tabs 换成假的。?tab=none 假装是插件不管的网站，别的假装是 X 的帖子页（0.20 起弹窗按当前网站显示）
        await page.evaluateOnNewDocument(() => {
          const none = new URLSearchParams(location.search).get("tab") === "none";
          chrome.tabs.query = async () => [{ id: 4242, url: none ? "https://www.google.com/" : "https://x.com/a/status/1909000000000000001" }];
          chrome.tabs.sendMessage = (tid, msg, cb) => setTimeout(() => cb(none ? undefined : { site: "x", kind: "status", enabled: true, folds: { spam: 3, abuse: 2, sexual: 0 }, pending: 1, seen: 40, tx: { improved: 2, filled: 1 } }), 10);
        });
        await page.setViewport({ width: 900, height: 1600 });
        await page.goto(`chrome-extension://${id}/options.html`, { waitUntil: "load" });
        await wait(500);
        await openGroups(page);
        const o = await page.evaluate(() => ({ ui: chrome.i18n.getUILanguage(), dir: document.documentElement.dir, h1: document.querySelector("h1").textContent,
          h2: [...document.querySelectorAll("main h2")].map((h) => h.textContent), title: document.title, htmlLang: document.documentElement.lang, sites: document.querySelectorAll("#sites .site-row").length,
          name: chrome.i18n.getMessage("extName"), body: document.body.innerText }));
        ok(`${lang}：设置页`, o.h1 === e.h1 && o.h2.includes(e.fold) && o.sites === 5 && o.name === e.name && o.htmlLang === code && o.dir === (e.rtl ? "rtl" : "ltr"),
          JSON.stringify({ ...o, body: undefined }));
        if (SHOT && e.rtl) await page.screenshot({ path: path.join(SHOT, `options-${code}.png`), fullPage: true });
        if (code !== "zh-CN") ok(`${lang}：设置页正文没有中文`, leftZh(o.body, code).length === 0, leftZh(o.body, code).join(" | "));
        await page.goto(`chrome-extension://${id}/popup.html`, { waitUntil: "load" });
        await wait(800);
        await openGroups(page);
        const p = await page.evaluate(() => ({ h2: [...document.querySelectorAll("h2")].map((h) => h.textContent), body: document.body.innerText }));
        ok(`${lang}：弹窗`, p.h2.includes(e.pop), JSON.stringify(p.h2));
        if (code !== "zh-CN") ok(`${lang}：弹窗没有中文`, leftZh(p.body, code).length === 0, leftZh(p.body, code).join(" | "));
        // 不支持的网站上的弹窗、网站页（0.20）也没有中文
        for (const [where, url] of [["不支持的网站的弹窗", "popup.html?tab=none"], ["Reddit 那一页", "options.html#site=reddit"]]) {
          await page.goto(`chrome-extension://${id}/${url}`, { waitUntil: "load" });
          await wait(700);
          await openGroups(page);
          const body = await page.evaluate(() => document.body.innerText);
          if (code !== "zh-CN") ok(`${lang}：${where}没有中文`, body.trim() && leftZh(body, code).length === 0, leftZh(body, code).join(" | ") || body.slice(0, 80));
        }
      } finally { await browser.close(); }
    }
  } catch (err) {
    out.push(`FAIL 运行出错 ${err.stack}`);
  }
  console.log(out.join("\n"));
  process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
})();
