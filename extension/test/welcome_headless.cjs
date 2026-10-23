// 首次设置和建议与反馈（0.23），真插件（不调任何接口）：无头 Chrome 装上插件（存储是空的，等于第一次安装）
// ① 装上以后自动打开 options.html#welcome；第 1 步五个网站都开着、各有"清理""翻译"两个勾（HN 的叫"清理辱骂和色情评论"），改了就存进 sites；
//    关掉的网站下面的勾不显示；② 第 2 步 Jev 和 OpenRouter 两个 key，各带"获取密钥"（typesafe.ai、openrouter.ai/keys；0.29.10 起没有"没填""测试连接"，保存时顺手测），一个网站都没开翻译时不问 OpenRouter；
//    没填 key 时有"稍后再填"；③ 第 3 步开着的网站各一个"去看看"，没填 OpenRouter 的 key 有提醒（0.29.11 起只要它），填了就没有；"完成"记下 ff_onboarded、关掉这一页；
// ④ 设置页"高级"里能再走一遍；⑤ 设置页最下面"建议与反馈"：邮箱、复制、写邮件（mailto 带版本、浏览器、界面语言）；#feedback 打开时停在这张卡片；
// ⑥ 弹窗最下面一个"反馈"（支持的、不支持的网站上都有）。设了 SHOT_DIR 就把三步和反馈卡片截图存下来。
// 用法：node test/welcome_headless.cjs <装了 puppeteer-core 的目录>
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const EXT = path.resolve(__dirname, "..");
const SHOT = process.env.SHOT_DIR;
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", pipe: true, protocolTimeout: 20000,
    args: ["--enable-unsafe-extension-debugging", "--no-first-run", "--lang=zh-CN", "-AppleLanguages", "(zh-CN)"], ignoreDefaultArgs: ["--disable-extensions"] });
  try {
    const { id } = await (await browser.target().createCDPSession()).send("Extensions.loadUnpacked", { path: EXT });
    let page = null;
    for (let i = 0; i < 30 && !page; i++) { await wait(200); page = (await browser.pages()).find((p) => p.url().startsWith(`chrome-extension://${id}/options.html#welcome`)) || null; }
    ok("装上以后自动打开首次设置那一页", !!page, JSON.stringify((await browser.pages()).map((p) => p.url())));
    if (!page) throw new Error("没有打开首次设置");
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 760, height: 1100, deviceScaleFactor: 2 });
    await wait(800);
    const stored = () => page.evaluate(() => chrome.storage.local.get(null));
    const step = () => page.evaluate(() => ({
      step: document.getElementById("welcomeStep")?.textContent, title: document.getElementById("welcomeTitle")?.textContent,
      sites: [...document.querySelectorAll("#welcomeSites [id^='w-']")].filter((e) => /^w-\w+$/.test(e.id)).map((e) => ({ id: e.id.slice(2),
        on: e.querySelector('[data-switch$="-on"]')?.getAttribute("aria-checked") ?? e.querySelector('[data-switch$="-on"]')?.dataset.checked ?? null,
        checks: [...e.querySelectorAll("label")].map((l) => `${l.textContent}${l.querySelector("input").checked ? "✓" : ""}`) })),
      keys: [...document.querySelectorAll("#welcomeKeys .row-name")].map((e) => e.textContent),
      links: [...document.querySelectorAll("#welcomeKeys .key-get")].map((a) => a.getAttribute("href")),
      notes: [...document.querySelectorAll("#welcomeKeys [id$='Note']")].map((e) => e.textContent),
      next: document.getElementById("welcomeNext")?.textContent || null, extras: document.querySelectorAll("#welcomeKeys [id$='Test'], #welcomeKeys .state").length,
      msg: document.getElementById("orKeyMsg")?.textContent || null, visit: [...document.querySelectorAll("#welcomeVisit a")].map((a) => [a.textContent, a.getAttribute("href")]),
      noKey: !!document.getElementById("welcomeNoKey"), doc: document.title,
      local: document.getElementById("welcomeKeysLocal")?.textContent || null, lock: !!document.querySelector("#welcomeKeysLocal svg"),
    }));
    let s = await step();
    ok("第 1 步：标题、第几步，五个网站都开着，各有清理、翻译两个勾（HN 的叫清理辱骂和色情评论）", s.step === "第 1 步，共 3 步" && s.title === "在哪些网站上用" && s.doc === "开始使用清流" &&
      JSON.stringify(s.sites.map((x) => x.id)) === JSON.stringify(["x", "reddit", "yt", "xhs", "hn"]) &&
      s.sites.every((x) => x.checks.length === 2 && x.checks.every((c) => c.endsWith("✓"))) && s.sites[4].checks[0] === "清理辱骂和色情评论✓", JSON.stringify(s));
    if (SHOT) await page.screenshot({ path: path.join(SHOT, "welcome-1.png"), fullPage: true });
    await page.click("#w-reddit-tx"); await wait(400);
    await page.click('[data-switch="w-hn-on"]'); await wait(500);
    let st = await stored();
    s = await step();
    ok("改了就存：Reddit 不翻译、HN 关掉；关掉的网站下面的勾不显示", st.ff_settings?.sites?.reddit?.translate === false && st.ff_settings?.sites?.hn?.on === false &&
      s.sites.find((x) => x.id === "hn").checks.length === 0, JSON.stringify(st.ff_settings));
    await page.click("#welcomeNext"); await wait(400);
    s = await step();
    // 0.29.10（用户 10-23：字多、按钮链接多）：一行"用途 · 服务名"+ 获取密钥，没有"没填"和"测试连接"；没填时下一步那个按钮写"稍后再填"。
    // 0.29.11 起只要一个 OpenRouter 密钥（判断也通过它调 Jev；TypeSafe 挪进设置的高级里、可选）
    ok("第 2 步：只有一个 key（清理和翻译 · OpenRouter），带获取密钥、一句说明；没有没填、测试连接；没填时按钮是稍后再填", s.title === "设置 API 密钥" &&
      JSON.stringify(s.keys) === JSON.stringify(["清理和翻译 · OpenRouter"]) && JSON.stringify(s.links) === JSON.stringify(["https://openrouter.ai/keys"]) &&
      s.notes.length === 1 && s.extras === 0 && s.next === "稍后再填", JSON.stringify(s));
    ok("第 2 步：填之前就告诉 key 只存在本地（带锁）、只发给 OpenRouter、不发给开发者", s.lock && /只保存在这个浏览器里/.test(s.local || "") && /只发给 OpenRouter/.test(s.local) && /不会发给开发者/.test(s.local), JSON.stringify(s.local));
    if (SHOT) await page.screenshot({ path: path.join(SHOT, "welcome-2.png"), fullPage: true });
    // 一个网站都不翻译时不问 OpenRouter
    await page.evaluate(() => chrome.storage.local.get("ff_settings").then(({ ff_settings }) => {
      const sites = { ...(ff_settings.sites || {}) };
      for (const id of ["x", "reddit", "yt", "xhs", "hn"]) sites[id] = { ...(sites[id] || {}), translate: false };
      return chrome.storage.local.set({ ff_settings: { ...ff_settings, sites } });
    }));
    await wait(500);
    s = await step();
    ok("一个网站都没开翻译：照样问 OpenRouter 的密钥（0.29.11 起清理也靠它）", JSON.stringify(s.keys) === JSON.stringify(["清理和翻译 · OpenRouter"]), JSON.stringify(s.keys));
    await page.click("#welcomeNext"); await wait(400); // 这时写的是"稍后再填"
    s = await step();
    ok("稍后再填 → 第 3 步：开着的四个网站各一个去看看；没填 OpenRouter 的 key 有提醒", s.title === "好了" && s.visit.length === 4 && s.visit[0][0] === "X" && s.visit[0][1] === "https://x.com" && s.noKey, JSON.stringify(s));
    if (SHOT) await page.screenshot({ path: path.join(SHOT, "welcome-3.png"), fullPage: true });
    await page.click("#welcomeBack"); await wait(400);
    // 保存时顺手测一次（0.29.10）：测 OpenRouter 的请求在这里拦下、回 401（不联网），该写出原因、不打勾
    const sw = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().startsWith(`chrome-extension://${id}/`));
    const swc = await sw.createCDPSession();
    const asked = [];
    swc.on("Fetch.requestPaused", (e) => { asked.push(e.request.url); swc.send("Fetch.fulfillRequest", { requestId: e.requestId, responseCode: 401,
      responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from('{"error":"invalid api key"}').toString("base64") }).catch(() => {}); });
    await swc.send("Fetch.enable", { patterns: [{ urlPattern: "https://openrouter.ai/*" }] });
    await page.type("#orKey", "fake-or-key-for-test"); await page.click("#saveOrKey"); await wait(1500);
    st = await stored();
    s = await step();
    ok("回第 2 步填了 key（0.28.12 起存进后台的 IndexedDB，storage.local 只有 ff_keys 填没填）：按钮换成下一步", st.ff_keys?.or === true && !("ff_or_key" in st) && !JSON.stringify(st).includes("fake-or-key-for-test") && s.next === "下一步",
      JSON.stringify({ next: s.next, flags: st.ff_keys }));
    ok("保存时顺手测了一次：OpenRouter 说密钥无效 → 直说用不了（不报分数、不说请重试），输入框留着好马上改，不另挂用不了的标签", asked.length >= 1 && /这个密钥用不了/.test(s.msg || "") &&
      !/\d\.\d|重试/.test(s.msg || "") && !!(await page.$("#orKey")) && s.extras === 0, JSON.stringify({ asked, msg: s.msg, extras: s.extras }));
    await swc.send("Fetch.disable").catch(() => {});
    await page.click("#welcomeNext"); await wait(400);
    s = await step();
    ok("填了 key，第 3 步不再提醒", s.title === "好了" && !s.noKey, JSON.stringify(s));
    const closed = new Promise((res) => { page.once("close", () => res(true)); setTimeout(() => res(false), 3000); });
    await page.bringToFront();
    await page.click("#welcomeDone");
    ok("完成：关掉这一页", await closed);

    // ---------- 设置页：再走一遍、建议与反馈 ----------
    page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 760, height: 900, deviceScaleFactor: 2 });
    await page.goto(`chrome-extension://${id}/options.html#feedback`, { waitUntil: "load" });
    await wait(900);
    st = await stored();
    ok("完成：记下 ff_onboarded", typeof st.ff_onboarded === "number", JSON.stringify(Object.keys(st)));
    const fb = await page.evaluate(() => {
      const card = document.getElementById("feedback"), r = card?.getBoundingClientRect();
      const a = document.getElementById("fbWrite");
      return { title: card?.querySelector("h2")?.textContent, inView: !!r && r.top >= 0 && r.top < innerHeight, mail: document.getElementById("fbMail")?.textContent,
        href: a?.getAttribute("href") || "", last: card && card.parentElement.lastElementChild === card,
        keyLinks: [...document.querySelectorAll("#conn .key-get")].map((x) => x.getAttribute("href")) };
    });
    const v = await page.evaluate(() => chrome.runtime.getManifest().version);
    const q = new URL(fb.href.replace(/^mailto:/, "http://x/"));
    ok("#feedback：设置页最下面的建议与反馈卡片，打开就停在这里", fb.title === "建议与反馈" && fb.inView && fb.last && fb.mail === "developer@ohmyai.app", JSON.stringify(fb));
    ok("写邮件：mailto 带主题（版本）和正文里的版本、浏览器、界面语言", fb.href.startsWith("mailto:developer@ohmyai.app?") && q.searchParams.get("subject") === `清流反馈（${v}）` &&
      new RegExp(`清流 ${v.replace(/\./g, "\\.")} · .+ · zh-CN`).test(q.searchParams.get("body") || ""), fb.href);
    ok("设置页：连接和费用里只有 OpenRouter，带获取密钥（TypeSafe 的在高级里，0.29.11）", JSON.stringify(fb.keyLinks) === JSON.stringify(["https://openrouter.ai/keys"]), JSON.stringify(fb.keyLinks));
    if (SHOT) await page.screenshot({ path: path.join(SHOT, "feedback.png"), clip: await page.$eval("#feedback", (e) => { const r = e.getBoundingClientRect(); return { x: r.x - 10, y: r.y + scrollY - 10, width: r.width + 20, height: r.height + 20 }; }) });
    await page.click("#advTrigger"); await wait(400);
    ok("高级里有再走一遍首次设置", (await page.evaluate(() => document.getElementById("rerunWelcome")?.getAttribute("href"))) === "#welcome");
    await page.click("#rerunWelcome"); await wait(500);
    ok("点再走一遍：回到第 1 步", (await page.evaluate(() => document.getElementById("welcomeTitle")?.textContent)) === "在哪些网站上用");

    // ---------- 弹窗最下面的"反馈" ----------
    const pop = await browser.newPage();
    await pop.evaluateOnNewDocument(() => {
      chrome.tabs.query = async () => [{ id: 4242, url: "https://x.com/someone/status/1909000000000000001" }];
      chrome.tabs.sendMessage = (tid, msg, cb) => setTimeout(() => cb({ site: "x", kind: "status", enabled: true, folds: { spam: 0, abuse: 0, sexual: 0 }, filler: 0, pending: 0, seen: 3, tx: {} }), 10);
      window.__created = []; chrome.tabs.create = async (o) => { window.__created.push(o.url); };
      window.close = () => { window.__closed = true; };
    });
    await pop.setViewport({ width: 340, height: 700 });
    await pop.goto(`chrome-extension://${id}/popup.html`, { waitUntil: "load" });
    await wait(700);
    const link = await pop.evaluate(() => document.getElementById("feedback")?.textContent || null);
    await pop.click("#feedback"); await wait(200);
    const went = await pop.evaluate(() => ({ created: window.__created, closed: !!window.__closed }));
    ok("弹窗最下面有反馈，点了打开设置页的建议与反馈", link === "反馈" && went.created.length === 1 && went.created[0].endsWith("/options.html#feedback") && went.closed, JSON.stringify({ link, went }));
    const pop2 = await browser.newPage();
    await pop2.evaluateOnNewDocument(() => { chrome.tabs.query = async () => [{ id: 4243, url: "https://example.com/" }]; chrome.tabs.sendMessage = (t, m, cb) => setTimeout(() => cb(null), 10); });
    await pop2.goto(`chrome-extension://${id}/popup.html`, { waitUntil: "load" });
    await wait(600);
    ok("不支持的网站上弹窗也有反馈", !!(await pop2.$("#unsupported")) && !!(await pop2.$("#feedback")));
  } catch (e) {
    out.push(`FAIL 跑到一半出错：${e.message.split("\n")[0]}`);
  } finally {
    await browser.close();
  }
  console.log(out.join("\n"));
  process.exit(out.some((l) => l.startsWith("FAIL") || l.startsWith("PAGEERROR")) ? 1 : 0);
})();
