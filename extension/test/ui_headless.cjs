// 弹窗和设置页，真插件（不调任何接口，key 是假的）：无头 Chrome 装上插件，往插件存储里放一份像真用了三天的数据（全是合成的），
// 打开弹窗看：当前网站的 logo 和两个开关（清理、翻译，0.20 起只管这个网站；不支持的网站上没有开关、只说在哪能用；没刷新过的页面说刷新后生效）、
// 今天清理了多少（三类）和翻译了多少、打开过多少帖子和主页、最近 7 天的柱子、本月花费、"当前页"清理和翻译一句话说完、要你处理的事；
// 0.20.1 起没有"判对了吗"，首页、列表上不说"不收起，只……"（有翻译只说翻了几条），深色下开关是蓝底白钮、数字和标签之间留够空。
// 设置页看网站列表（0.20：每个网站开着什么、几项单独设置）、网站页（两个开关、单独改规则、恢复默认、只有这个网站有的设置：X 的补翻和 M1、
// Reddit 的评测记录；Hacker News 没有垃圾那一档）、三档、key 的状态、问号里的说明（悬停就出来）、"高级"收着、换 key、
// 看回复里的图片（0.18：默认关，打开先要权限，不给就不开）（界面是 feed-filter/ui 里的 React，0.19 起用 shadcn/ui 的 maia 组件，底层 Base UI）。设了 SHOT_DIR 就把弹窗和设置页截图存进去。
// 用法：node test/ui_headless.cjs <装了 puppeteer-core 的目录>
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const EXT = path.resolve(__dirname, "..");
const SHOT = process.env.SHOT_DIR;
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const day = (i) => new Date(Date.now() - i * 864e5).toLocaleDateString("sv-SE");
const now = Date.now();
const fold = (i, kind, text, extra = {}) => ({ id: String(1910000000000000000n + BigInt(i)), postId: "1909000000000000001", page: "status",
  handle: `@bot_${i}`, name: `Bot ${i}`, text, kind, reason: kind === "abuse" ? "辱骂或人身攻击 0.88" : "为第三方导流 0.91", scores: { benefit: 0.9 }, at: now - (10 - i) * 6e4, ...extra });
const SEED = {
  ff_key: "fake-jev-key", ff_or_key: "fake-or-key",
  ff_stats: {
    [day(2)]: { posts: 88, seen: 2485, fold_jev: 148, fold_m1: 95, fold_abuse: 9, fold_sexual: 28, tokens: 914978 },
    [day(1)]: { posts: 63, seen: 1881, fold_jev: 44, fold_m1: 80, fold_dup: 12, fold_slogan: 12, fold_abuse: 99, fold_sexual: 35, tokens: 885298, tx_replaced: 18, tx_usd: 0.0019 },
    [day(0)]: { posts: 28, profiles: 3, seen: 656, fold_jev: 7, fold_m1: 7, fold_dup: 5, fold_selfquote: 5, fold_slogan: 2, fold_abuse: 34, fold_sexual: 2, fold_filler: 6,
      fold_imp: 1, fold_shill: 3, fold_thread: 4, fold_bait: 2, fold_user: 6, // YouTube 的几类也算垃圾；你自己标的（user）不算
      tokens: 291743, tx_jev_tokens: 126996, tx_replaced: 56, tx_fill: 10, tx_usd: 0.006 },
  },
  ff_recent_folds: [fold(1, "jev", "合成的拉人回复一：加我领资料"), fold(2, "abuse", "合成的骂人回复二"), fold(3, "jev", "合成的推广回复三：点我主页看"),
    fold(4, "sexual", "合成的色情回复四"), fold(5, "jev", "合成的拉人回复五：私信我带你上车")],
  ff_log: [...Array(16)].map((_, i) => ({ ts: new Date(now - 864e5).toISOString(), label: "confirm", kind: "jev", id: String(1900000000000000000n + BigInt(i)) }))
    .concat([0, 1].map((i) => ({ ts: new Date(now - 864e5).toISOString(), label: "fp", kind: "jev", id: String(1900000000000000100n + BigInt(i)) }))),
  ff_confirmed_slogans: [
    { text: "合成的第一条垃圾标记", raw: "合成的第一条垃圾标记", site: "x", at: now - 1000 },
    { text: "合成的第二条垃圾标记", raw: "合成的第二条垃圾标记", site: "reddit", at: now - 2000 },
  ],
};
// 第 3 条（最新的倒数第三）你已经核对过：不该再列出来
SEED["ff_reply_override:" + SEED.ff_recent_folds[2].id] = { label: "missed", updatedAt: now };

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", pipe: true,
    args: ["--enable-unsafe-extension-debugging", "--no-first-run", "--lang=zh-CN", "-AppleLanguages", "(zh-CN)"], ignoreDefaultArgs: ["--disable-extensions"] });
  try {
    const { id } = await (await browser.target().createCDPSession()).send("Extensions.loadUnpacked", { path: EXT });
    await wait(800);
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.goto(`chrome-extension://${id}/options.html`, { waitUntil: "load" });
    await page.evaluate((seed) => chrome.storage.local.set(seed), SEED);
    // 0.28.12：key 放在 storage.local 的旧版本数据（SEED 就是这样）——后台挪进自己的 IndexedDB，storage.local 只剩 ff_keys（填没填），内容脚本读不到 key
    await wait(400);
    const moved = await page.evaluate(async () => { const all = await chrome.storage.local.get(null); return { keys: Object.keys(all).filter((k) => /key/.test(k)), flags: all.ff_keys, leak: JSON.stringify(all).includes("fake-jev-key") || JSON.stringify(all).includes("fake-or-key") }; });
    ok("升级：storage.local 里的 key 挪进插件自己的库，只留填没填", JSON.stringify(moved.keys) === '["ff_keys"]' && moved.flags?.jev === true && moved.flags?.or === true && !moved.leak, JSON.stringify(moved));
    // 弹窗当成普通标签页打开时，"当前标签页"是它自己：把 tabs 换成假的，假装当前是一个 X 帖子页（网址、页面里的插件脚本回什么）
    await page.evaluateOnNewDocument(() => {
      try {
        chrome.tabs.query = async () => [{ id: 4242, url: "https://x.com/someone/status/1909000000000000001" }];
        chrome.tabs.sendMessage = (tid, msg, cb) => setTimeout(() => cb({ site: "x", kind: "status", enabled: true, folds: { spam: 3, abuse: 2, sexual: 0 }, filler: 4, pending: 1, seen: 40, tx: { improved: 2, filled: 1 } }), 10);
      } catch (e) { window.__noTabsStub = String(e); }
    });
    await page.setViewport({ width: 340, height: 900, deviceScaleFactor: 2 });
    await page.goto(`chrome-extension://${id}/popup.html`, { waitUntil: "load" });
    await wait(700);
    const txt = (sel) => page.$eval(sel, (e) => e.textContent.trim());
    ok("今天折了多少：三类加起来、「赞」「mark」这类也算（YouTube 的冒充频道主、成群吹、一唱一和、骗局开头算进垃圾；你自己标的不算）", (await txt("#todayN")) === "78", await txt("#todayN"));
    const chips = await page.$$eval("#cats .chip", (cs) => cs.map((c) => c.textContent.replace(/\s+/g, " ").trim()));
    ok("三类分开：垃圾和推广 36、辱骂 34、色情 2，再加「赞」「mark」这类 6（0.22，不算进垃圾）", JSON.stringify(chips) === JSON.stringify(["垃圾和推广 36", "辱骂 34", "色情 2", "赞/mark 6"]), JSON.stringify(chips));
    ok("今天翻译了几条（换掉的加补翻）、看过多少帖子和主页（搜索没有就不列）", (await txt("#todayWhere")) === "今天还翻译了 66 条 · 看过：帖子 28 · 主页 3", await txt("#todayWhere"));
    ok("最近 7 天的柱子", (await page.$$eval("#bars .bar", (b) => b.length)) === 7 && /最近 7 天/.test(await page.$eval("#bars", (b) => b.getAttribute("aria-label"))));
    ok("当前页：清理几条（「赞」「mark」这类也算进去）、翻译几条一句话说完，还在判的另一句", (await txt("#hereText")) === "当前页：清理 9 条（垃圾和推广 3 · 辱骂 2 · 赞/mark 4），翻译 3 条。还有 1 条在判。",
      (await txt("#hereText")) + (await page.evaluate(() => window.__noTabsStub || "")));
    const head = await page.evaluate(() => ({ site: document.querySelector("header.pop-head .site-logo")?.getAttribute("aria-label"), title: document.querySelector("header.pop-head h1")?.textContent,
      logo: !!document.querySelector("header.pop-head .site-logo svg path"), on: document.querySelector('header.pop-head [data-switch="on"]')?.getAttribute("aria-label"),
      rows: [...document.querySelectorAll("#feats .label")].map((e) => e.textContent), sizes: [...document.querySelectorAll("#feats .label")].map((e) => getComputedStyle(e).fontSize),
      next: document.querySelector("header.pop-head").parentElement.querySelector("#feats") ? "feats" : null, enabled: document.querySelector('[data-switch="enabled"]') }));
    ok("第一行是当前网站（logo、名字）和它的总开关（0.21，用户：首行应该是当前平台的开启与关闭）；下面一组两项：清理垃圾评论、翻译增强（X 上叫翻译增强，0.29.12），一样大",
      head.site === "X" && head.title === "X" && head.logo && head.on === "在 X 上启用" && JSON.stringify(head.rows) === JSON.stringify(["清理垃圾评论", "翻译增强"]) &&
      head.sizes[0] === head.sizes[1] && head.next === "feats" && !head.enabled, JSON.stringify(head));
    // 开关照苹果的比例、像素定死（0.21，用户：样式出错了——以前圆钮按 rem 算，弹窗 15px 根字号下缩小、四周留白不一样）
    const knob = await page.evaluate(() => { const sw = document.querySelector('[data-switch="on"]'), th = sw.querySelector('[data-slot="switch-thumb"]'); const a = sw.getBoundingClientRect(), b = th.getBoundingClientRect();
      return [a.width, a.height, b.width, Math.round((b.top - a.top) * 10) / 10, Math.round((a.right - b.right) * 10) / 10]; });
    ok("开关：轨道 34×20、圆钮 16，开着时圆钮离上边、右边都是 2px", JSON.stringify(knob) === "[34,20,16,2,2]", JSON.stringify(knob));
    ok("没有\"判对了吗\"（0.20.1，用户：可以去掉）", !(await page.$("#check")) && !(await page.$(".check-item")));
    const gap = await page.evaluate(() => { const n = document.getElementById("todayN").getBoundingClientRect(), c = document.getElementById("cats").querySelector(".chip").getBoundingClientRect(); return Math.round(c.top - n.bottom); });
    ok("大数字和下面的类别标签之间留够空（0.20.1，用户：太近）", gap >= 8, `间隔 ${gap}px`);
    const height = await page.evaluate(() => Math.ceil(document.body.getBoundingClientRect().bottom)); // 内容的高度（页面本身被视口撑到 900）
    ok("弹窗不超过 Chrome 弹窗的最大高度 600（不出滚动条）", height <= 600, `高 ${height}`);
    ok("中文的几句话之间不加空格", !/。 /.test(await txt("#hereText")), await txt("#hereText"));
    ok("两个 key 都填了：翻译开关旁边不加说明（今天翻了几条挪到\"今天\"那里）", (await page.$("#translateNote")) === null);
    ok("本月花费（两位有效数字）", /^本月约 \$0\.\d\d+$/.test(await txt("#cost")), await txt("#cost"));
    ok("key 都填了、没出问题：没有要你处理的", (await page.$$eval("#alerts .alert", (a) => a.length)) === 0);
    if (SHOT) {
      await page.screenshot({ path: path.join(SHOT, "popup.png"), fullPage: true });
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
      await wait(400); // 组件的颜色有过渡（0.19 起 shadcn 的 maia 组件），等它变完再截
      await page.screenshot({ path: path.join(SHOT, "popup-dark.png"), fullPage: true });
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
      await wait(400);
    }

    // 深色（0.20.1，用户：看着不舒服）：开关是中等亮度的蓝底、白圆钮（以前浅蓝底配深蓝钮）；类别标签是淡底，不是很深的实底
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
    await wait(500);
    const dark = await page.evaluate(() => { const sw = document.querySelector('[data-switch="fold"]'), th = sw.querySelector('[data-slot="switch-thumb"]'), chip = document.querySelector("#cats .chip");
      return { track: getComputedStyle(sw).backgroundColor, thumb: getComputedStyle(th).backgroundColor, chip: getComputedStyle(chip).backgroundColor }; });
    ok("深色：开关蓝底白钮，类别标签是半透明的淡底", dark.track === "rgb(61, 127, 245)" && dark.thumb === "rgb(255, 255, 255)" && /^rgba\(.*0\.1[68]\)$|^oklab|^color/.test(dark.chip), JSON.stringify(dark));
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
    await wait(500);

    // 出问题的时候：OpenRouter 余额不足、暂停
    await page.evaluate(() => chrome.storage.local.set({ ff_health: { or: { code: "or_credit", at: Date.now() } } }));
    await page.reload({ waitUntil: "load" });
    await wait(600);
    ok("OpenRouter 余额不足：提示、带去设置的链接", /OpenRouter 余额不足/.test(await txt("#alerts")) && (await page.$$eval("#alerts a", (a) => a.length)) === 1, await txt("#alerts"));
    // 0.28.8：TypeSafe 余额不足（402）也提示；高级设置里关了 Jev 的不提 Jev key 的事
    await page.evaluate(() => chrome.storage.local.set({ ff_health: { jev: { code: "credit", at: Date.now() } } }));
    await page.reload({ waitUntil: "load" });
    await wait(600);
    ok("TypeSafe 余额不足：提示", /TypeSafe 余额不足/.test(await txt("#alerts")), await txt("#alerts"));
    const keepSt = await page.evaluate(async () => (await chrome.storage.local.get("ff_settings")).ff_settings || {});
    // 0.29.11：判断默认走 OpenRouter——没填 TypeSafe、有 OpenRouter 的密钥也能判，不提醒；两个都没有才提醒"还没填 OpenRouter 密钥"
    await page.evaluate((st) => chrome.storage.local.set({ ff_key: "", ff_or_key: "", ff_health: {}, ff_settings: { ...st, useJev: false } }), keepSt);
    await page.reload({ waitUntil: "load" });
    await wait(600);
    const noJev = await txt("#alerts");
    await page.evaluate((st) => chrome.storage.local.set({ ff_settings: { ...st, useJev: true } }), keepSt);
    await page.reload({ waitUntil: "load" });
    await wait(600);
    const none = await txt("#alerts");
    await page.evaluate(() => chrome.storage.local.set({ ff_or_key: "fake-or-key" }));
    await page.reload({ waitUntil: "load" });
    await wait(600);
    const orOnly = await txt("#alerts");
    ok("关了判断：不提密钥；两个都没填：提还没填 OpenRouter 密钥；只有 OpenRouter 的（0.29.11）：不提", !/密钥/.test(noJev) && /还没填 OpenRouter 密钥/.test(none) && !/还没填/.test(orOnly),
      JSON.stringify([noJev, none, orOnly]));
    await page.evaluate((st) => chrome.storage.local.set({ ff_key: "fake-jev-key", ff_or_key: "fake-or-key", ff_settings: st, ff_health: { or: { code: "or_credit", at: Date.now() } } }), keepSt);
    await page.reload({ waitUntil: "load" });
    await wait(600);
    const stored = () => page.evaluate(async () => (await chrome.storage.local.get("ff_settings")).ff_settings);
    await page.click('[data-switch="fold"]');
    await wait(500);
    let sv = await stored();
    ok("点清理开关：只关 X（存在 sites.x 里，别的网站、默认的那一份不动）", sv.sites?.x?.fold === false && sv.enabled !== false && Object.keys(sv.sites).length === 1, JSON.stringify(sv.sites));
    await page.click('[data-switch="fold"]');
    await wait(500);
    sv = await stored();
    ok("再打开：X 那一份删掉（和默认一样就不存）", !sv.sites?.x, JSON.stringify(sv.sites));
    await page.click('[data-switch="on"]');
    await wait(500);
    sv = await stored();
    const offUi = await page.evaluate(() => ["fold", "translate"].map((k) => document.querySelector(`[data-switch="${k}"]`).hasAttribute("data-disabled")));
    ok("关掉 X 的总开关：存进 sites.x.on，下面两项灰掉、不能点", sv.sites?.x?.on === false && offUi.every(Boolean), JSON.stringify([sv.sites, offUi]));
    await page.click('[data-switch="on"]');
    await wait(500);
    ok("再打开：X 那一份删掉", !(await stored()).sites?.x);

    // 别的网站的页面：插件翻的外文单独说一句；插件不管的 Reddit 页面说清 Reddit 上哪里管（不说 X 的）。url：当前标签页的网址（读不到是 undefined）
    const at = async (url, reply) => {
      await page.evaluateOnNewDocument((u, r) => { chrome.tabs.query = async () => [{ id: 4242, url: u || undefined }]; chrome.tabs.sendMessage = (tid, msg, cb) => setTimeout(() => cb(r || undefined), 10); }, url, reply);
      await page.reload({ waitUntil: "load" });
      await wait(600);
    };
    const redditHere = async (reply, url = "https://www.reddit.com/r/test/comments/abc123/x/") => { await at(url, reply); return txt("#hereText"); };
    let here = await redditHere({ kind: "status", site: "reddit", enabled: true, folds: { spam: 1, abuse: 0, sexual: 1 }, pending: 0, seen: 9, tx: { improved: 0, filled: 3, on: true } });
    const logo = () => page.$eval("header.pop-head .site-logo", (e) => e.getAttribute("aria-label")).catch(() => null);
    ok("Reddit 帖子页：清理几条、翻译几条（插件自己翻的）一句话；标题旁边是 Reddit 的 logo", here === "当前页：清理 2 条（垃圾和推广 1 · 色情 1），翻译 3 条。" && (await logo()) === "Reddit", here);
    here = await redditHere({ kind: "other", site: "reddit", enabled: true, tx: { improved: 0, filled: 0, on: true } });
    ok("插件不管的 Reddit 页面：说 Reddit 上哪里管", /^当前页面暂不支持。Reddit/.test(here) && !/首页|主页/.test(here), here);
    here = await redditHere({ kind: "list", site: "hn", enabled: true, tx: { improved: 0, filled: 29, on: true } }, "https://news.ycombinator.com/news");
    ok("只翻标题的列表页：只说翻了几条（0.20.1 起不说\"不收起，只翻标题\"）；Hacker News 的清理开关叫\"清理辱骂和色情评论\"", here === "当前页翻译了 29 条。" &&
      (await txt("#row-fold .label")) === "清理辱骂和色情评论", here);
    here = await redditHere({ site: "x", kind: "home", enabled: true, tx: { improved: 12, filled: 0 } }, "https://x.com/home");
    ok("X 首页：只说翻了几条（用户：\"首页上不收起，只改进翻译\"看不懂）", here === "当前页翻译了 12 条。", here);
    await at("https://x.com/home", { site: "x", kind: "home", enabled: true, tx: { improved: 0, filled: 0 } });
    ok("X 首页、没翻译：当前页那一块不显示", !(await page.$("#hereText")));
    here = await redditHere({ kind: "status", site: "yt", enabled: false, tx: { improved: 0, filled: 5, on: true } }, "https://www.youtube.com/watch?v=x");
    ok("这个网站关着清理：只说翻了几条", here === "当前页翻译了 5 条。", here);
    here = await redditHere({ kind: "status", site: "reddit", enabled: true, folds: { spam: 0, abuse: 0, sexual: 0 }, pending: 0, seen: 3, tx: { improved: 0, filled: 0, on: true } }, undefined);
    ok("网址读不到、页面里的插件脚本说是 Reddit：照 Reddit", here === "当前页：没有要清理的。" && (await logo()) === "Reddit", here);
    await at("https://www.reddit.com/r/test/", null);
    ok("插件管的网站、页面里没有插件脚本（装上后没刷新过）：开关照常，说刷新后生效", (await txt("#hereText")) === "刷新这个页面后才生效。" && !!(await page.$('[data-switch="fold"]')), await txt("#hereText"));
    // 插件不管的网站（0.20，用户：弹窗不该能用）：没有开关和统计，只说在哪几个网站能用，留设置入口
    for (const url of ["https://www.google.com/search?q=x", undefined]) {
      await at(url, null);
      const u = await page.evaluate(() => ({ box: !!document.getElementById("unsupported"), switches: document.querySelectorAll("[data-switch]").length, today: !!document.getElementById("today"),
        text: document.getElementById("unsupported")?.innerText.replace(/\s+/g, " ") || "", sites: [...document.querySelectorAll("#siteList .chip")].map((e) => e.textContent),
        logos: [...document.querySelectorAll("#siteList .chip .site-logo")].map((e) => e.dataset.site), opts: !!document.getElementById("openOpts") }));
      ok(`不支持的网站（${url || "网址读不到、没有插件脚本"}）：没有开关和统计，说这个网站用不了、列出能用的网站、能去设置；中文界面插件叫清流（0.24 起；英文名 ClearFlow）`, u.box && u.switches === 0 && !u.today && /^清流 暂不支持此网站 /.test(u.text) &&
        /^清流/.test(u.text) &&
        JSON.stringify(u.sites) === JSON.stringify(["X", "Reddit", "YouTube", "小红书", "Hacker News"]) && JSON.stringify(u.logos) === JSON.stringify(["x", "reddit", "yt", "xhs", "hn"]) && u.opts, JSON.stringify(u));
    }

    // 设置页（颜色的检查按浅色算：无头 Chrome 跟着系统的深浅色走）
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
    await page.setViewport({ width: 720, height: 1400, deviceScaleFactor: 2 });
    await page.goto(`chrome-extension://${id}/options.html`, { waitUntil: "load" });
    await wait(700);
    const o = await page.evaluate(() => ({
      segs: [...document.querySelectorAll(".seg:not(#mode)")].map((s) => [...s.querySelectorAll(".seg-item")].map((b) => (b.getAttribute("aria-checked") === "true" ? `[${b.textContent}]` : b.textContent)).join(" ")),
      jev: document.getElementById("jevState")?.textContent ?? null, or: document.getElementById("orState").textContent, cost: document.getElementById("costLine").textContent,
      conn: [...document.querySelectorAll("#conn .row-name")].map((e) => e.textContent),
      adv: document.getElementById("advTrigger").getAttribute("aria-expanded") === "true" || !!document.getElementById("threshold"), h2: [...document.querySelectorAll("h2")].map((h) => h.textContent),
      bodyText: document.getElementById("fold").innerText,
    }));
    ok("三类都是三档、默认那档亮着", o.segs.length === 3 && o.segs.every((x) => x === "宽松 [标准] 严格"), JSON.stringify(o.segs));
    ok("分组：网站列表（不带标题）、清理规则、连接和费用、数据和隐私、最下面建议与反馈（0.23）；没有翻译那张（0.20）；高级默认收着", JSON.stringify(o.h2) === JSON.stringify(["清理规则", "连接和费用", "数据和隐私", "建议与反馈"]) && !o.adv &&
      !!(await page.$("#sites")), JSON.stringify(o));
    ok("说明都收进问号里：页面上只留名字和控件（清理规则一张卡片：三类、「赞」「mark」这类、看图片、刷同一句话、记住的句子，8 个问号；M1 挪到 X 那一页）", !/机器人、拉人/.test(o.bodyText) &&
      (await page.$$eval("#fold .help", (h) => h.length)) === 8 && !(await page.$("#fold #row-m1")) && !!(await page.$("#fold #row-slogans")) && /所有网站的默认/.test(o.bodyText), o.bodyText.slice(0, 200));
    const list = () => page.$$eval("#sites .site-row", (rs) => rs.map((r) => r.innerText.replace(/\s+/g, " ").trim()));
    let L = await list();
    ok("网站列表：五个网站，前面是各自的 logo，右边写开着什么（默认都是清理、翻译）", JSON.stringify(L) === JSON.stringify(["X 清理、翻译", "Reddit 清理、翻译", "YouTube 清理、翻译", "小红书 清理、翻译", "Hacker News 清理、翻译"]) &&
      JSON.stringify(await page.$$eval("#sites .site-row .site-logo", (e) => e.map((x) => x.dataset.site))) === JSON.stringify(["x", "reddit", "yt", "xhs", "hn"]), JSON.stringify(L));
    // 0.19.2：宽松 / 标准 / 严格照苹果的分段控件（灰槽、选中的是白块），卡片是连续圆角（corner-shape: squircle）
    const look = await page.evaluate(() => {
      const seg = document.querySelector("#row-threshold .seg"), on = seg.querySelector('.seg-item[aria-checked="true"]'), card = document.getElementById("fold");
      return { track: getComputedStyle(seg).backgroundColor, thumb: getComputedStyle(on).backgroundColor, shadow: getComputedStyle(on).boxShadow !== "none",
        corner: getComputedStyle(card).getPropertyValue("corner-top-left-shape"), radius: getComputedStyle(card).borderTopLeftRadius };
    });
    ok("分段控件：灰槽、选中的白块带阴影", look.track !== "rgba(0, 0, 0, 0)" && look.thumb === "rgb(255, 255, 255)" && look.shadow, JSON.stringify(look));
    ok("卡片是连续圆角", /squircle|superellipse/.test(look.corner) && look.radius === "26px", JSON.stringify(look));
    // 0.19.3：边框、分隔线都是 0.5px（Chrome 把小于 1px 的 border 画成 1px，所以是阴影画的线）；卡片里第一行上面没有线；页面上不剩看得见的 1px 边框
    const lines = await page.evaluate(() => {
      const cs = (id) => getComputedStyle(document.getElementById(id));
      const visible = [...document.querySelectorAll("body *")].filter((e) => { const c = getComputedStyle(e);
        return ["Top", "Right", "Bottom", "Left"].some((k) => parseFloat(c["border" + k + "Width"]) >= 1 && c["border" + k + "Color"] !== "rgba(0, 0, 0, 0)" && c["border" + k + "Style"] !== "none"); })
        .map((e) => e.id || e.className.slice(0, 40));
      // 0.29.11 起"连接和费用"里是 OpenRouter 一行加花费一行（TypeSafe 挪进高级）；0.30.0 起最上面一行是"清流会员 / 自己的密钥"
      const costRow = getComputedStyle(document.getElementById("costLine").parentElement);
      return { first: getComputedStyle(document.getElementById("mode").parentElement).boxShadow, second: costRow.boxShadow, secondColor: costRow.borderTopColor,
        orLine: cs("row-or").boxShadow, ring: cs("fold").boxShadow, changeBtn: cs("orChange").boxShadow, visible };
    });
    ok("分隔线 0.5px、每张卡片第一行上面没有线、卡片和描边按钮都是 0.5px、没有看得见的 1px 边框",
      lines.first === "none" && /inset 0px 0\.5px 0px 0px|0px 0\.5px 0px 0px .*inset/.test(lines.second) && /0\.5px/.test(lines.orLine) && lines.secondColor === "rgba(0, 0, 0, 0)" &&
      /0px 0px 0px 0\.5px/.test(lines.ring) && /0\.5px/.test(lines.changeBtn) && lines.visible.length === 0, JSON.stringify(lines));
    // 强制颜色模式（Windows 高对比度）：阴影画的线没了，卡片补一圈系统色的实线
    const media = await page.target().createCDPSession();
    await media.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }, { name: "forced-colors", value: "active" }] });
    const forced = await page.evaluate(() => { const c = getComputedStyle(document.getElementById("fold")); return { width: c.borderTopWidth, style: c.borderTopStyle, color: c.borderTopColor, shadow: c.boxShadow }; });
    ok("forced-colors：卡片有一圈系统色的实线", forced.width === "1px" && forced.style === "solid" && forced.color !== "rgba(0, 0, 0, 0)" && forced.shadow === "none", JSON.stringify(forced));
    await media.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }, { name: "forced-colors", value: "none" }] });
    await media.detach();
    const motion = await page.evaluate(() => { const sw = document.querySelector('#fold [data-switch="filler"]'), th = sw.querySelector('[data-slot="switch-thumb"]');
      return { thumbProperty: getComputedStyle(th).transitionProperty, thumbDuration: getComputedStyle(th).transitionDuration, trackProperty: getComputedStyle(sw).transitionProperty }; });
    // 开关：正常是圆钮 150ms 滑过去、槽只过渡颜色；要求减少动态效果时直接到位
    ok("开关：圆钮 150ms 位移，槽只过渡列出来的属性", motion.thumbProperty.includes("transform") && motion.thumbDuration.includes("0.15s") && motion.trackProperty.includes("background-color") && motion.trackProperty !== "all", JSON.stringify(motion));
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "reduce" }]);
    const reduced = await page.evaluate(() => { const th = document.querySelector('#fold [data-switch="filler"] [data-slot="switch-thumb"]'); const c = getComputedStyle(th); return { property: c.transitionProperty, duration: c.transitionDuration }; });
    ok("减少动态效果：圆钮直接到位", reduced.duration === "0s" || !reduced.duration.includes("0.15s"), JSON.stringify(reduced));
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "no-preference" }]);
    const readContrast = () => page.evaluate(() => {
      const raster = (colors) => {
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        for (const color of colors) {
          ctx.fillStyle = "#010203"; ctx.fillStyle = color;
          if (ctx.fillStyle === "#010203" && color !== "#010203") throw new Error(`无法读取颜色 ${color}`);
          ctx.fillRect(0, 0, 1, 1);
        }
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const luminance = (rgb) => rgb.map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (fg, bg) => { const a = luminance(fg), b = luminance(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
      const measure = (el) => {
        const layers = [];
        for (let node = el; node; node = node.parentElement) { const bg = getComputedStyle(node).backgroundColor; if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") layers.unshift(bg); }
        return ratio(raster([getComputedStyle(el).color]), raster(layers));
      };
      return { muted: measure(document.querySelector(".site-state")), destructive: measure(document.getElementById("orState")) };
    });
    const lightContrast = await readContrast();
    ok("浅色：灰字、红字和底色的对比度都够 4.5", lightContrast.muted >= 4.5 && lightContrast.destructive >= 4.5, JSON.stringify(lightContrast));
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]); await wait(400);
    const darkContrast = await readContrast();
    ok("深色：灰字、红字和底色的对比度都够 4.5", darkContrast.muted >= 4.5 && darkContrast.destructive >= 4.5, JSON.stringify(darkContrast));
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]); await wait(400);
    // 悬停在问号上：说明弹出来（Popover，openOnHover）；弹层和问号用同一个名字（读屏念得出是哪一项的说明）；移开就收起
    let helpName = null;
    const helpText = async (sel) => {
      await page.hover(sel);
      await page.waitForSelector(".help-pop", { timeout: 2000 }).catch(() => {});
      const txt = await page.$$eval(".help-pop p", (ps) => ps.map((p) => p.textContent));
      helpName = await page.evaluate(() => ({ trigger: document.querySelector("#row-threshold .help")?.getAttribute("aria-label"), content: document.querySelector(".help-pop")?.getAttribute("aria-label") }));
      await page.mouse.move(2, 2);
      await wait(400);
      return txt;
    };
    let tip = await helpText("#row-threshold .help");
    ok("悬停\"垃圾回复和推广\"的问号：说明弹出来", /机器人刷屏/.test(tip[0] || "") && /误伤正常回复/.test(tip[0] || ""), JSON.stringify(tip));
    ok("说明弹层和问号同名", !!helpName.trigger && helpName.content === helpName.trigger && /垃圾回复和推广/.test(helpName.trigger), JSON.stringify(helpName));
    ok("移开就收起", (await page.$$(".help-pop")).length === 0);
    // 看回复里的图片（0.18）：默认关；打开先要图片网站的权限（chrome.permissions.request 换成假的），给了才存；不给就提示、不打开；关掉把权限还回去
    const imgOn = () => page.evaluate(async () => !!(await chrome.storage.local.get("ff_settings")).ff_settings?.images);
    ok("看回复里的图片：默认关", (await page.$eval('[data-switch="images"]', (e) => e.getAttribute("aria-checked"))) === "false" && !(await imgOn()));
    await page.evaluate(() => { window.__permAsk = []; window.__permDrop = []; chrome.permissions.request = async (p) => { window.__permAsk.push(p); return false; };
      chrome.permissions.remove = async (p) => { window.__permDrop.push(p); return true; }; });
    await page.click('[data-switch="images"]');
    await wait(500);
    const denied = await page.evaluate(() => ({ ask: window.__permAsk, toast: document.querySelector(".toast:not([data-limited]) .toast-title")?.textContent || "", close: !!document.querySelector(".toast-close") }));
    ok("不给权限：不打开，提示里说怎么重新打开、选允许", !(await imgOn()) && denied.ask.length === 1 && JSON.stringify(denied.ask[0].origins) === JSON.stringify(["https://pbs.twimg.com/*", "https://i.redd.it/*", "https://preview.redd.it/*", "*://*.xhscdn.com/*"]) &&
      /再次打开/.test(denied.toast) && /允许/.test(denied.toast) && denied.close, JSON.stringify(denied));
    await wait(3000);
    ok("出错的提示不自己消失，带关闭按钮", (await page.$eval(".toast:not([data-limited]) .toast-title", (e) => e.textContent)) === denied.toast && !!(await page.$(".toast-close")));
    await page.click(".toast-close"); await wait(300);
    ok("点 × 关掉出错的提示", !(await page.$(".toast:not([data-limited])")));
    await page.evaluate(() => { chrome.permissions.request = async (p) => { window.__permAsk.push(p); return true; }; });
    await page.click('[data-switch="images"]');
    await wait(500);
    ok("给了权限：打开、存下", (await imgOn()) && (await page.$eval('[data-switch="images"]', (e) => e.getAttribute("aria-checked"))) === "true");
    await wait(3200);
    ok("普通提示自己消失，没有关闭按钮", !(await page.$(".toast:not([data-limited])")) && !(await page.$(".toast-close")));
    await page.click('[data-switch="images"]');
    await wait(500);
    ok("关掉：存下、权限还回去", !(await imgOn()) && (await page.evaluate(() => window.__permDrop.length)) === 1);
    tip = await helpText("#row-images .help");
    ok("看图片的问号里说清：发给 Jev、多花多少、准头、要权限", /二维码/.test(tip[0] || "") && /768/.test(tip[0] || "") && /试验/.test(tip[0] || "") && /授权/.test(tip[0] || ""), JSON.stringify(tip));
    ok("连接和费用里只有 OpenRouter（0.29.11 起一个密钥就够）、余额不足；TypeSafe 收在高级里", JSON.stringify(o.conn) === '["OpenRouter"]' && o.jev === null && o.or === "余额不足", JSON.stringify([o.conn, o.jev, o.or]));
    // TypeSafe（可选）那一行在高级里：点开再查
    await page.click("#advTrigger");
    await wait(400);
    ok("高级里第一行是 TypeSafe（可选），填过了打勾", (await txt("#row-jev .row-name")) === "TypeSafe（可选）" && !!(await page.$("#jevState svg")), await txt("#row-jev .row-name"));
    // 0.19.2：能用的 key 只打一个勾（读屏念"已填"）、不放测试连接；用不了的照旧写字、有测试连接
    const keyUi = await page.evaluate(() => ({ jevIcon: !!document.querySelector("#jevState svg"), jevBadge: !!document.querySelector('#jevState[data-slot="badge"]'),
      jevTest: !!document.getElementById("jevTest"), orTest: !!document.getElementById("orTest"), orBadge: !!document.querySelector('#orState[data-slot="badge"]') }));
    ok("能用的 key：一个勾、没有测试连接；余额不足的：写字、有测试连接", keyUi.jevIcon && !keyUi.jevBadge && !keyUi.jevTest && keyUi.orTest && keyUi.orBadge, JSON.stringify(keyUi));
    ok("本月花费和每月估计（0.29.11 起按用途分：清理、翻译）", /^本月：清理 \$[\d.]+，翻译 \$[\d.]+。按近 7 天用量估算，每月约 \$[\d.]+。$/.test(o.cost), o.cost);
    // key 填过了：平时只显示状态和"更换""测试连接"，点"更换"才出输入框
    ok("填过的 key 不显示输入框", !(await page.$("#key")) && !!(await page.$("#jevChange")));
    await page.click("#jevChange");
    await wait(300);
    ok("点\"更换\"出输入框和保存，换的时候能测试连接", !!(await page.$("#key")) && !!(await page.$("#saveKey")) && !!(await page.$("#jevTest")));
    // 0.28.8：输入框空着点保存：不存（以前会把存着的 key 清掉、还说已保存）
    await page.click("#saveKey");
    await wait(300);
    ok("空着点保存：说没填密钥，存着的密钥不动", (await txt("#keyMsg")) === "没有填密钥" && (await page.evaluate(async () => (await chrome.storage.local.get("ff_keys")).ff_keys?.jev)) === true,
      await txt("#keyMsg"));
    await page.setViewport({ width: 320, height: 1100, deviceScaleFactor: 2 }); await wait(250);
    const narrowKey = await page.evaluate(() => {
      const main = document.querySelector("#row-jev .row-main"), link = document.getElementById("jevGet"), r = link.getBoundingClientRect(), c = getComputedStyle(link);
      return { wrap: getComputedStyle(main).flexWrap, whiteSpace: c.whiteSpace, height: r.height, line: parseFloat(c.lineHeight), over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    ok("320px 宽：密钥那行能折行，「获取密钥」不竖着一个字一行、页面不横向滚动", narrowKey.wrap === "wrap" && narrowKey.whiteSpace === "nowrap" && narrowKey.height <= narrowKey.line + 2 && narrowKey.over === 0, JSON.stringify(narrowKey));
    await page.setViewport({ width: 720, height: 1400, deviceScaleFactor: 2 }); await wait(250);
    // 0.28.8：每月估计按 7 天平均（7 天里只用了一天的，以前把那一天乘 30）
    const keepStats = await page.evaluate(async () => (await chrome.storage.local.get("ff_stats")).ff_stats);
    await page.evaluate((d0, d20) => chrome.storage.local.set({ ff_stats: { [d20]: { tx_usd: 0.1 }, [d0]: { tx_usd: 0.7 } } }), day(0), day(20));
    await wait(400);
    const cost1 = await txt("#costLine");
    await page.evaluate((s) => chrome.storage.local.set({ ff_stats: s }), keepStats);
    await wait(300);
    ok("每月估计：最近 7 天只用了一天（$0.70），按 7 天平均乘 30 = $3.00", /每月约 \$3\.00/.test(cost1), cost1);
    // 高级：点开才有精确数字（上面查 TypeSafe 那一行时已经点开了）；评测记录的开关默认关，打开存下
    if ((await page.$eval("#advTrigger", (b) => b.getAttribute("aria-expanded"))) !== "true") { await page.click("#advTrigger"); await wait(400); }
    ok("点开\"高级\"：阈值等数字出来，跟三档一致；没有评测记录（0.24 去掉了）", (await page.$eval("#threshold", (i) => i.value)) === "0.6" &&
      (await page.$eval("#advTrigger", (b) => b.getAttribute("aria-expanded"))) === "true" && !(await page.$('[data-switch="evalRecord"]')));
    if (SHOT) await page.screenshot({ path: path.join(SHOT, "options.png"), fullPage: true });

    // 0.29.11：看图片要直连 TypeSafe（OpenRouter 收下图片却不转给 Jev）——没填 TypeSafe 密钥时这一行灰掉、说去高级里填
    await page.evaluate(() => chrome.storage.local.set({ ff_key: "" }));
    await wait(600);
    const imgRow = await page.evaluate(() => ({ off: document.querySelector("#row-images [data-switch]")?.hasAttribute("data-disabled"), note: document.querySelector("#row-images .row-note")?.textContent || "" }));
    ok("没填 TypeSafe 密钥：检查图片那一行灰掉，说要先在高级里填 TypeSafe 密钥", imgRow.off === true && /高级/.test(imgRow.note) && /TypeSafe/.test(imgRow.note), JSON.stringify(imgRow));
    await page.evaluate(() => chrome.storage.local.set({ ff_key: "fake-jev-key" }));
    await wait(600);

    // 你标记的垃圾：单条「删掉」一点就删；「全部删掉」先弹确认，说删几条，取消不删、确认才删
    const sloganCount = () => page.evaluate(async () => ((await chrome.storage.local.get("ff_confirmed_slogans")).ff_confirmed_slogans || []).length);
    ok("标记的测试数据在", (await sloganCount()) === 2, String(await sloganCount()));
    await page.click("#sloganToggle"); await wait(300);
    await page.click("#slogans li:first-child button"); await wait(600);
    ok("单条删掉：不问，直接删", (await sloganCount()) === 1 && !(await page.$('[data-slot="alert-dialog-content"]')), String(await sloganCount()));
    await page.click("#clearSlogans"); await wait(250);
    const confirmTitle = await page.$eval('[data-slot="alert-dialog-title"]', (e) => e.textContent);
    ok("全部删掉：先确认，标题里有条数，还没删", /全部 1 条/.test(confirmTitle) && (await sloganCount()) === 1, confirmTitle);
    await page.click('[data-slot="alert-dialog-cancel"]'); await wait(250);
    ok("取消：不删", (await sloganCount()) === 1);
    await page.click("#clearSlogans"); await wait(250);
    await page.click("#sloganConfirm"); await wait(600);
    ok("确认：全删了", (await sloganCount()) === 0, String(await sloganCount()));

    // ---------- 网站页（0.20） ----------
    const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await wait(500); };
    const segOf = (row) => page.$eval(`${row} .seg`, (s) => [...s.querySelectorAll(".seg-item")].map((b) => (b.getAttribute("aria-checked") === "true" ? `[${b.textContent}]` : b.textContent)).join(" "));
    await page.click("#site-reddit");
    await wait(500);
    let pg = await page.evaluate(() => ({ title: document.getElementById("siteTitle")?.textContent, back: document.getElementById("back")?.getAttribute("aria-label"), backIcon: !!document.querySelector("#back svg"), h2: [...document.querySelectorAll("main h2")].map((h) => h.textContent),
      rows: [...document.querySelectorAll("#siteFold .row-name")].map((e) => e.textContent), doc: document.title, focus: document.activeElement?.id }));
    ok("点 Reddit 进去：左上角圆形的返回箭头（0.21）、logo 和标题 Reddit；总开关、清理、翻译三个开关；清理什么：三类、看图片、刷同一句话；评测记录收在高级里", pg.title === "Reddit" &&
      pg.back === "返回设置" && pg.backIcon && JSON.stringify(pg.h2) === JSON.stringify(["清理什么"]) && !!(await page.$('#siteMain [data-switch="on"]')) && JSON.stringify(pg.rows) === JSON.stringify(["垃圾回复和推广", "辱骂、人身攻击", "色情", "「赞」「mark」这类回复", "检查回复中的图片", "几个账号刷同一句话"]) &&
      !!(await page.$('#siteMain [data-switch="fold"]')) && !!(await page.$('#siteMain [data-switch="translate"]')) && /^Reddit · /.test(pg.doc), JSON.stringify(pg));
    ok("进到网站页：焦点在新页的标题上", pg.focus === "siteTitle", pg.focus || "(无焦点)");
    // 单独改：垃圾选"严格" → 存进 sites.reddit，标出来；默认的那一份不动
    await page.click('#row-threshold .seg-item:nth-of-type(3)');
    await wait(500);
    sv = await stored();
    ok("网站页上改了一档：只存进这个网站（sites.reddit.threshold 0.5），默认还是 0.6，旁边写单独设置（默认：标准）", sv.sites?.reddit?.threshold === 0.5 && sv.threshold === 0.6 &&
      (await segOf("#row-threshold")) === "宽松 标准 [严格]" && (await txt("#row-threshold .override")) === "单独设置（默认：标准） · 恢复默认", JSON.stringify([sv.sites, await txt("#row-threshold .row-note").catch(() => "")]));
    await page.click('[data-switch="dup"]');
    await wait(500);
    ok("开关也能单独改：刷同一句话关掉，写着默认是开", (await stored()).sites.reddit.dup === false && /单独设置（默认：开）/.test(await txt("#row-dup .override")));
    await go("");
    L = await list();
    ok("回到首页：Reddit 那行写着 2 项单独设置", L[1] === "Reddit 清理、翻译 · 2 项单独设置", JSON.stringify(L));
    // 默认改了：没单独改过的网站跟着变，单独改过的不变
    await page.click('#fold #row-threshold .seg-item:nth-of-type(1)');
    await wait(500);
    await go("#site=reddit");
    const keep = await segOf("#row-threshold");
    await go("#site=x");
    ok("默认改成宽松：X（没单独改）跟着变宽松，Reddit（单独改过）还是严格", (await segOf("#row-threshold")) === "[宽松] 标准 严格" && keep === "宽松 标准 [严格]", keep);
    await go("#site=reddit");
    await page.click("#row-threshold .reset");
    await wait(500);
    sv = await stored();
    ok("恢复默认：这一项从 Reddit 那一份删掉，跟着默认（宽松）", !("threshold" in (sv.sites.reddit || {})) && (await segOf("#row-threshold")) === "[宽松] 标准 严格" && !(await page.$("#row-threshold .override")), JSON.stringify(sv.sites));
    await page.click("#row-dup .reset");
    await wait(500);
    ok("两项都恢复：Reddit 那一份整个删掉", !(await stored()).sites?.reddit, JSON.stringify((await stored()).sites));
    // 0.24 去掉了 Reddit 的评测记录：Reddit 页没有"高级"了（只有 X 页有补翻那一项）
    ok("Reddit 页没有高级、没有评测记录", !(await page.$("#siteAdvTrigger")) && !(await page.$('[data-switch="evalRecord"]')));
    // 关掉这个网站的收起：规则都灰掉；首页写只翻译
    await page.click('#siteMain [data-switch="fold"]');
    await wait(500);
    const greyed = await page.evaluate(() => [...document.querySelectorAll('#siteFold [data-switch]')].every((e) => e.hasAttribute("data-disabled")));
    ok("关掉 Reddit 的清理：存进 sites.reddit.fold，下面的规则都灰掉", (await stored()).sites.reddit.fold === false && greyed);
    await go("");
    ok("首页 Reddit 那行写只翻译", (await list())[1] === "Reddit 只翻译", JSON.stringify(await list()));
    await go("#site=reddit");
    await page.click('#siteMain [data-switch="on"]');
    await wait(500);
    await go("");
    ok("Reddit 总开关关了：首页那行写关", (await list())[1] === "Reddit 关", JSON.stringify(await list()));
    await go("#site=reddit");
    await page.click('#siteMain [data-switch="on"]');
    await wait(500);
    await go("");
    // X：翻译开关的说明讲 Grok；补翻在翻译下面，翻译关了就灰掉；M1 在收起什么里
    await go("#site=x");
    tip = await helpText("#row-translate .help");
    ok("X 的翻译：说明讲增强 X 自带的翻译、X 没翻的不翻、翻成哪种语言", /增强 X 自带的翻译/.test(tip[0] || "") && /X 没翻译的帖子不翻/.test(tip[0] || "") && /界面语言/.test(tip[1] || ""), JSON.stringify(tip));
    tip = await helpText("#row-m1 .help");
    ok("X 页上有 M1，说明里写着现在的长度上限（汉字和大约多少个字母）", /10 个汉字/.test(tip[0] || "") && /40 个字母/.test(tip[0] || ""), JSON.stringify(tip));
    const fillOff = () => page.$eval('[data-switch="translateFill"]', (e) => e.hasAttribute("data-disabled"));
    ok("补翻作者自己的回复收在 X 页的高级里（0.21，用户：这是高级设置，不该在上面）", !(await page.$('#siteMain [data-switch="translateFill"]')) && !(await page.$('[data-switch="translateFill"]')));
    await page.click("#siteAdvTrigger");
    await wait(400);
    ok("翻译开着：补翻能点", !(await fillOff()));
    await page.click('#siteMain [data-switch="translate"]');
    await wait(500);
    ok("关掉 X 的翻译：存进 sites.x.translate，补翻灰掉", (await stored()).sites.x.translate === false && (await fillOff()));
    await page.click('#siteMain [data-switch="translate"]');
    await wait(500);
    // Hacker News：只有辱骂和色情（没有垃圾那一档、没有图片和刷同一句话）；YouTube 没有看图片
    await go("#site=hn");
    pg = await page.evaluate(() => ({ rows: [...document.querySelectorAll("#siteFold .row-name")].map((e) => e.textContent), fold: document.querySelector("#row-fold .row-name").textContent }));
    ok("Hacker News 页：清理开关叫清理辱骂和色情评论，清理什么只有辱骂、色情", pg.fold === "清理辱骂和色情评论" && JSON.stringify(pg.rows) === JSON.stringify(["辱骂、人身攻击", "色情"]), JSON.stringify(pg));
    await go("#site=yt");
    pg = await page.evaluate(() => [...document.querySelectorAll("#siteFold .row-name")].map((e) => e.textContent));
    ok("YouTube 页：没有看回复里的图片", JSON.stringify(pg) === JSON.stringify(["垃圾回复和推广", "辱骂、人身攻击", "色情", "「赞」「mark」这类回复", "几个账号刷同一句话"]), JSON.stringify(pg));
    // 网站页上开看图片：要权限、存进这个网站；关掉时别的地方还在看图就不还权限
    await go("#site=xhs");
    await page.click('[data-switch="images"]');
    await wait(500);
    ok("小红书页上开看图片：要了权限、存进 sites.xhs.images", (await stored()).sites?.xhs?.images === true && (await page.evaluate(() => window.__permAsk.length)) >= 3);
    const drops = await page.evaluate(() => window.__permDrop.length);
    await page.click('[data-switch="images"]');
    await wait(500);
    ok("关掉（哪个网站都不看图了）：存下、权限还回去", !(await stored()).sites?.xhs && (await page.evaluate(() => window.__permDrop.length)) === drops + 1, JSON.stringify((await stored()).sites));
    await page.click("#back");
    await wait(500);
    ok("点\"‹ 设置\"回首页，焦点在设置的标题上", !!(await page.$("#sites")) && !(await page.$("#siteTitle")) && (await page.evaluate(() => document.activeElement === document.querySelector("main h1"))));
    for (const hash of ["#feedback", "#conn", "#plans", "#renew"]) {
      const before = await page.evaluate(() => document.activeElement?.id || "");
      await go(hash);
      const anchored = await page.evaluate((h) => {
        const expected = h === "#feedback" ? "feedback" : "conn", el = document.getElementById(expected) || document.getElementById("conn"), r = el?.getBoundingClientRect();
        return { inView: !!r && r.top >= 0 && r.top < innerHeight, focus: document.activeElement?.id || "" };
      }, hash);
      ok(`${hash}：停在那张卡片，不抢焦点`, anchored.inView && anchored.focus === before, JSON.stringify({ before, ...anchored }));
    }
    await go("");
  } catch (e) {
    out.push(`FAIL 运行出错 ${e.stack}`);
  } finally {
    await browser.close();
  }
  console.log(out.join("\n"));
  process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
})();
