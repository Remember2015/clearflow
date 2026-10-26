// 清流会员（0.30.0）的界面：设置页"连接"里切到清流会员 → 登录（0.32.0 起在官网上登录：右上角"登录"、等官网确认、取消、超时；登录后右上角头像菜单）→ 账号（套餐、用量、设备）→ 开通清流会员
// （四个套餐和价格、去付款、等付款、付好了）→ 切回自己的密钥；弹窗（试用剩几天、试用结束、底部那句不说美元、不提密钥）；网页里的提示（notice.js）。
// 真插件、无头 Chrome；发给后台的账号操作（{type: "account"}）在页面里换成假的（不连清流的服务器、不发邮件），状态照后台的写法写进 ff_account。
// 用法：node test/account_headless.cjs <装了 puppeteer-core 的目录>
const path = require("path");
const fs = require("fs");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const EXT = path.resolve(__dirname, "..");
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 864e5;

// 页面里：账号操作换成假的（window.__acct 记下发了什么，window.__acctReply 决定回什么）
const STUB = () => {
  if (!globalThis.chrome?.runtime?.sendMessage) return; // about:blank 这类页面上没有插件接口
  const real = chrome.runtime.sendMessage.bind(chrome.runtime);
  window.__acct = [];
  chrome.runtime.sendMessage = (msg, ...rest) => {
    if (msg && msg.type === "account") { window.__acct.push(msg); return Promise.resolve(window.__acctReply ? window.__acctReply(msg) : { ok: true }); }
    return real(msg, ...rest);
  };
  chrome.tabs.create = async (o) => { (window.__opened ||= []).push(o.url); return { id: 1 }; };
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", pipe: true,
    args: ["--enable-unsafe-extension-debugging", "--no-first-run", "--lang=zh-CN", "-AppleLanguages", "(zh-CN)"], ignoreDefaultArgs: ["--disable-extensions"] });
  try {
    const { id } = await (await browser.target().createCDPSession()).send("Extensions.loadUnpacked", { path: EXT });
    await wait(800);
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.evaluateOnNewDocument(STUB);
    await page.setViewport({ width: 760, height: 1400, deviceScaleFactor: 1 });
    await page.goto(`chrome-extension://${id}/options.html`, { waitUntil: "load" });
    await page.evaluate(() => chrome.storage.local.set({ ff_settings: { rev: 6, account: true }, ff_onboarded: 1 }));
    await page.goto(`chrome-extension://${id}/options.html#conn`, { waitUntil: "load" });
    await wait(600);
    const conn = () => page.evaluate(() => ({
      mode: document.querySelector('#mode [aria-checked="true"]')?.dataset.mode || null, orRow: !!document.getElementById("row-or"),
      form: !!document.querySelector("#conn input[type=email], #loginCode"), head: document.getElementById("pageHead")?.innerText || "", menu: !!document.getElementById("acctMenu"),
      account: document.getElementById("account")?.innerText || "", plans: !!document.getElementById("plans"), plansCard: !!document.querySelector("section#plans, [data-slot=card]#plans"), acct: window.__acct,
    }));
    let c = await conn();
    const setAcct = (a) => page.evaluate((a) => chrome.storage.local.set({ ff_account: a }), a);
    // 0.32.0（用户 10-25）：登录不在设置页里填验证码，在官网上登录；登录态放在页面最上面
    const out0 = await page.evaluate(() => ({ text: document.getElementById("signedOut")?.innerText || "", pay: document.getElementById("plansPay")?.textContent, trial: document.getElementById("plansTrial")?.textContent }));
    ok("没登录：右上角一个登录（不是头像菜单）；连接里看得到套餐和价格（年付默认）、去付款和先免费试用 7 天，没有填邮箱、验证码的框，没有 OpenRouter 那一行",
      /登录$/.test(c.head) && !c.menu && c.mode === "account" && !c.form && !c.orRow && c.plans && ["清流会员", "不用申请密钥", "免费试用 7 天", "$2.90", "$24", "推荐 · 省 31%", "$3.90", "$39"].every((w) => out0.text.includes(w)) &&
      out0.pay === "去付款 · $24 / 年" && /先免费试用 7 天/.test(out0.trial || ""), JSON.stringify({ c, out0 }));
    // 认不出的错误（token_revoked 这类）不把代码露给用户
    await page.evaluate(() => { window.__acctReply = () => ({ ok: false, error: "token_revoked" }); });
    await page.click("#headLogin");
    await wait(300);
    const errBody = await page.evaluate(() => document.body.innerText);
    ok("登录出错：认不出的错误统一说出错了，稍后再试（不露 token_revoked）", /出错了，稍后再试/.test(errBody) && !/token_revoked/.test(errBody), "");
    // 点登录：后台开官网确认页（这里只看发了 loginStart），等确认时右上角和连接里都是"在打开的网页上完成登录"和取消
    await page.evaluate((now) => {
      window.__acct.length = 0;
      window.__acctReply = (m) => {
        if (m.op === "loginStart") chrome.storage.local.set({ ff_account: { login: { code: "ABCD-EFGH", at: now, until: now + 600e3, intent: m.intent || null } } });
        if (m.op === "loginCancel") chrome.storage.local.set({ ff_account: {} });
        return { ok: true };
      };
    }, Date.now());
    await page.click("#headLogin");
    await wait(400);
    c = await conn();
    const waiting = await page.evaluate(() => ({ head: document.getElementById("headLoginWaiting")?.innerText || "", panel: document.getElementById("panelLoginWaiting")?.innerText || "" }));
    ok("点登录：后台收到 loginStart（没带付款）；右上角和连接里都是在打开的网页上完成登录 + 取消，套餐先收起",
      c.acct.at(-1)?.op === "loginStart" && !c.acct.at(-1)?.intent && /在打开的网页上完成登录/.test(waiting.head) && /取消/.test(waiting.head) && /在打开的网页上完成登录/.test(waiting.panel) && !c.plans, JSON.stringify({ c, waiting }));
    await page.click("#headLoginCancel");
    await wait(400);
    c = await conn();
    ok("取消：后台收到 loginCancel，右上角回到登录、套餐回来", c.acct.at(-1)?.op === "loginCancel" && /登录$/.test(c.head) && c.plans, JSON.stringify(c));
    await setAcct({ login: { code: "ABCD-EFGH", error: "expired_token" } });
    await wait(300);
    const expired = await page.evaluate(() => ({ head: document.getElementById("headLoginErr")?.textContent, panel: document.getElementById("panelLoginErr")?.textContent }));
    ok("没登录成（超时）：说登录超时了，再点一次登录，旁边照旧有登录", expired.head === "登录超时了，再点一次登录" && expired.panel === "登录超时了，再点一次登录" && !!(await page.$("#headLogin")), JSON.stringify(expired));
    await page.click("#plansPay");
    await wait(300);
    c = await conn();
    ok("点去付款：先去官网登录，带上选的套餐（年付），登录上了后台接着开付款页", c.acct.at(-1)?.op === "loginStart" && c.acct.at(-1)?.intent?.pay === "yearly", JSON.stringify(c.acct.at(-1)));
    // 登录上了（后台写进 ff_account）：右上角是头像 + 邮箱的菜单，试用不带星；连接里不再有邮箱那一行
    await page.evaluate(() => { window.__acctReply = null; window.__acct.length = 0; });
    await setAcct({ email: "me@example.com", plan: "trial", status: "trialing", kind: null, renews: false, periodEnd: Date.now() + 3 * DAY - 3600e3,
      usage: { today: 0.4, month: null }, devices: [{ id: "d_new", name: "Chrome · macOS", current: true }], at: Date.now() });
    await wait(400);
    c = await conn();
    const head1 = await page.evaluate(() => ({ email: document.getElementById("acctEmail")?.textContent, star: !!document.querySelector("#acctMenu [data-member]"), logoutInPanel: !!document.getElementById("acctLogout") }));
    ok("登录上了：右上角头像 + 邮箱（试用不带星）；账号和开通是一张：试用还剩 3 天、今天用了 40%、设备 1 / 3（这台），邮箱和退出登录不在这张里",
      c.menu && head1.email === "me@example.com" && !head1.star && !head1.logoutInPanel && !/me@example\.com/.test(c.account) &&
      /试用还剩 3 天/.test(c.account) && /今天已用 40%/.test(c.account) && /设备 1 \/ 3/.test(c.account) && /这台/.test(c.account) && !c.plansCard, JSON.stringify({ c, head1 }));
    const menu = async () => { await page.click("#acctMenu"); await wait(300); return page.evaluate(() => [...document.querySelectorAll('[data-slot="dropdown-menu-content"] [data-slot="dropdown-menu-item"], [data-slot="dropdown-menu-content"] [data-slot="dropdown-menu-label"]')].map((e) => e.textContent.trim())); };
    let items = await menu();
    ok("头像菜单：会员和设备、在网站上管理账号、退出登录；不写套餐和续费类型", JSON.stringify(items) === JSON.stringify(["会员和设备", "在网站上管理账号", "退出登录"]), JSON.stringify(items));
    await page.click("#menuSite");
    await wait(200);
    await menu();
    await page.click("#menuLogout");
    await wait(200);
    c = await conn();
    ok("菜单：在网站上管理账号（后台开官网账号页）、退出登录", JSON.stringify(c.acct.map((m) => m.op)) === JSON.stringify(["site", "logout"]), JSON.stringify(c.acct));
    await page.evaluate(() => { window.__acct.length = 0; });

    // 开通清流会员：四个套餐和价格
    const plans = () => page.evaluate(() => ({
      text: document.getElementById("account")?.innerText || "", picked: document.querySelector('#plansPick [aria-checked="true"]')?.dataset.plan || null,
      waiting: !!document.getElementById("plansWaiting"), paid: document.getElementById("plansPaid")?.innerText || "",
    }));
    let p = await plans();
    const rows = await page.$$eval("#plansPick [data-plan]", (els) => els.map((e) => ({ plan: e.dataset.plan, text: e.innerText.replace(/\s+/g, " "), wechat: !!e.querySelector("[data-wechat] svg") })));
    ok("开通清流会员（在账号那张里，四行列表）：年付 $24（推荐 · 省 31%）、月付 $2.90、1 年 $39、30 天 $3.90，只有一次性两行带微信支付标记（图标 + 微信支付），默认年付，按钮是去付款 · $24 / 年，写着 7 天内全额退款",
      ["开通清流会员", "去付款 · $24 / 年", "7 天内可全额退款"].every((w) => p.text.includes(w)) && p.picked === "yearly" &&
      rows.map((r) => r.plan).join() === "yearly,monthly,pass365,pass30" &&
      /推荐 · 省 31%/.test(rows[0].text) && /\$24/.test(rows[0].text) && /\$2\.90/.test(rows[1].text) && /\$39/.test(rows[2].text) && /\$3\.90/.test(rows[3].text) &&
      rows.map((r) => r.wechat).join() === "false,false,true,true" && rows.slice(2).every((r) => /微信支付/.test(r.text) && /一次性，不续费/.test(r.text)), JSON.stringify({ p, rows }));
    // 微信支付标记只在简体、繁体中文界面出现（用户 10-25）：同样的账号换成繁体、英文、日语界面看
    const marks = {};
    for (const l of ["zh-TW", "en", "ja"]) {
      const o = await browser.newPage();
      await o.evaluateOnNewDocument(STUB);
      await o.goto(`chrome-extension://${id}/options.html?uilang=${l}#conn`, { waitUntil: "load" });
      await wait(600);
      marks[l] = await o.$$eval("#plansPick [data-plan]", (els) => els.map((e) => !!e.querySelector("[data-wechat]")).join());
      await o.close();
    }
    ok("微信支付标记只在中文界面：繁体有（一次性两行），英文、日语没有，四行照常在", marks["zh-TW"] === "false,false,true,true" && marks.en === "false,false,false,false" && marks.ja === "false,false,false,false", JSON.stringify(marks));
    await page.evaluate(() => { window.__acctReply = (m) => {
      if (m.op === "checkout") chrome.storage.local.get("ff_account").then(({ ff_account }) => chrome.storage.local.set({ ff_account: { ...ff_account, checkout: { id: "co_1", product: m.product, at: Date.now(), status: "pending" } } }));
      return { ok: true };
    }; });
    await page.click('[data-plan="monthly"]');
    const payMonthly = await page.$eval("#plansPay", (b) => b.textContent);
    await page.click('[data-plan="yearly"]');
    // 等待状态：后台慢一点回，按钮转圈、换成"正在打开…"、不能再点
    await page.evaluate(() => { const r = window.__acctReply; window.__acctReply = (m) => (m.op === "checkout" ? new Promise((res) => setTimeout(() => res(r(m)), 600)) : r(m)); });
    await page.click("#plansPay");
    await wait(150);
    const busy = await page.$eval("#plansPay", (b) => ({ text: b.textContent, disabled: b.disabled, spin: !!b.querySelector("svg.animate-spin") }));
    ok("选月付按钮跟着变；点了去付款：转圈、正在打开…、不能再点", /去付款 · \$2\.90 \/ 月/.test(payMonthly) && busy.text === "正在打开…" && busy.disabled && busy.spin, JSON.stringify({ payMonthly, busy }));
    await wait(700);
    await wait(400);
    p = await plans();
    c = await conn();
    ok("去付款：后台收到 checkout yearly，显示等待付款完成", c.acct.at(-1)?.op === "checkout" && c.acct.at(-1)?.product === "yearly" && p.waiting && /等待付款完成/.test(p.text), JSON.stringify({ p, last: c.acct.at(-1) }));
    await page.evaluate((now) => chrome.storage.local.get("ff_account").then(({ ff_account }) => chrome.storage.local.set({ ff_account: { ...ff_account,
      plan: "yearly", kind: "pass", status: "active", periodEnd: now + 365 * 864e5, usage: { today: 0, month: 0.01 }, checkout: { ...ff_account.checkout, status: "paid" } } })), Date.now());
    await wait(400);
    p = await plans();
    c = await conn();
    const mem = await page.evaluate(() => ({ hero: document.getElementById("acctHero")?.textContent, when: document.getElementById("acctWhen")?.textContent, renew: !!document.getElementById("acctRenew") }));
    ok("付好了：不用点确认——标题就是 1 年（不写清流会员），旁边已开通，下面一行哪天结束，本月已用；套餐收起，有续费",
      p.paid === "已开通" && mem.hero === "1 年" && /结束$/.test(mem.when || "") && /本月已用/.test(c.account) && !/清流会员/.test(c.account) && !/好$/m.test(c.account) && mem.renew && !c.plans, JSON.stringify({ p, mem, account: c.account }));
    await page.click("#acctRenew");
    await wait(300);
    c = await conn();
    const renewPick = await page.evaluate(() => document.querySelector('#plansPick [aria-checked="true"]')?.dataset.plan);
    ok("一次性的点续费：套餐展开，默认选他原来那一档（1 年）", c.plans && renewPick === "pass365", JSON.stringify({ renewPick, plans: c.plans }));
    const star = await page.evaluate(() => !!document.querySelector("#acctMenu [data-member]"));
    ok("付了费的会员：右上角头像带金色的星", star, "");
    // 一次性的快到期：菜单最上面一行还剩几天和续费，点续费打开下面的套餐
    await page.evaluate((now) => chrome.storage.local.get("ff_account").then(({ ff_account }) => chrome.storage.local.set({ ff_account: { ...ff_account, plan: "monthly", periodEnd: now + 2 * 864e5 - 3600e3, checkout: null } })), Date.now());
    await page.goto("about:blank");
    await page.goto(`chrome-extension://${id}/options.html`, { waitUntil: "load" });
    await wait(600);
    items = await menu();
    await page.click("#menuRenew");
    await wait(500);
    c = await conn();
    ok("一次性快到期：菜单最上面是 30 天 · 还剩 2 天和续费，点续费套餐展开", items[0] === "30 天 · 还剩 2 天" && items[1] === "续费" && c.plans, JSON.stringify({ items, plans: c.plans }));

    // 0.33.0（用户 10-25：取消订阅以后什么都操作不了、也没法换年付；退款看着像取消）
    const reload = async (acct) => { await setAcct(acct); await page.goto("about:blank"); await page.goto(`chrome-extension://${id}/options.html#conn`, { waitUntil: "load" }); await wait(600);
      await page.evaluate(() => { window.__acct.length = 0; }); };
    const btns = () => page.evaluate(() => ({ resume: document.getElementById("acctResume")?.textContent || null, yearly: document.getElementById("acctYearly")?.textContent || null,
      manage: !!document.getElementById("acctManage"), refundLine: document.getElementById("acctRefundLine")?.textContent || null, plans: !!document.getElementById("plans") }));
    const subBase = { email: "me@example.com", kind: "subscription", usage: { today: 0.1, month: 0.2 }, devices: [{ id: "d_new", name: "Chrome · macOS", current: true }], at: Date.now() };
    await reload({ ...subBase, plan: "monthly", status: "canceled", renews: false, periodEnd: Date.now() + 12 * DAY, subscription: { status: "canceled", plan: "monthly", period_end: Date.now() + 12 * DAY } });
    let b = await btns();
    await page.click("#acctResume");
    await wait(300);
    c = await conn();
    ok("月付取消了、还没到期：有恢复自动续费（点了后台收到 resume）和管理订阅，没有改成年付", b.resume === "恢复自动续费" && b.manage && !b.yearly && c.acct.at(-1)?.op === "resume", JSON.stringify({ b, last: c.acct.at(-1) }));
    await reload({ ...subBase, plan: "monthly", status: "active", renews: true, periodEnd: Date.now() + 12 * DAY, subscription: { status: "active", plan: "monthly", period_end: Date.now() + 12 * DAY } });
    b = await btns();
    await page.click("#acctYearly");
    await wait(300);
    c = await conn();
    ok("月付在续费：有改成年付（后台收到 checkout yearly，走换套餐）和管理订阅，没有恢复", b.yearly === "改成年付" && b.manage && !b.resume && c.acct.at(-1)?.op === "checkout" && c.acct.at(-1)?.product === "yearly", JSON.stringify({ b, last: c.acct.at(-1) }));
    await reload({ ...subBase, plan: "yearly", status: "active", renews: true, periodEnd: Date.now() + 200 * DAY, subscription: { status: "active", plan: "yearly", period_end: Date.now() + 200 * DAY } });
    b = await btns();
    ok("年付在续费：只有管理订阅", b.manage && !b.yearly && !b.resume, JSON.stringify(b));
    await reload({ email: "me@example.com", plan: null, status: "none", kind: null, renews: false, usage: null, devices: [], refund: { status: "requested" }, at: Date.now() });
    b = await btns();
    ok("退了款：会员马上停，写着已退款、3–10 个工作日原路退回，下面照常能开通", b.refundLine === "已退款，3–10 个工作日原路退回" && b.plans && !b.manage, JSON.stringify(b));

    await page.click('#mode [data-mode="own"]');
    await wait(400);
    c = await conn();
    const st = await page.evaluate(() => chrome.storage.local.get("ff_settings").then((r) => r.ff_settings.account));
    ok("切回自己的密钥：存下来、出现 OpenRouter 那一行、没有开通卡片", st === false && c.orRow && !c.plans, JSON.stringify({ st, c }));

    // ---------- 弹窗 ----------
    const popup = await browser.newPage();
    popup.on("pageerror", (e) => out.push(`PAGEERROR popup ${e.message}`));
    await popup.evaluateOnNewDocument(STUB);
    await popup.evaluateOnNewDocument(() => {
      chrome.tabs.query = async () => [{ id: 4242, url: "https://x.com/someone/status/1909000000000000001" }];
      chrome.tabs.sendMessage = (tid, msg, cb) => setTimeout(() => cb && cb({ site: "x", kind: "status", enabled: true, folds: { spam: 0, abuse: 0, sexual: 0 }, filler: 0, pending: 0, seen: 3, tx: { improved: 0, filled: 0 } }), 10);
    });
    await popup.setViewport({ width: 340, height: 800, deviceScaleFactor: 1 });
    const seedPopup = (acct) => page.evaluate((a) => chrome.storage.local.set({ ff_settings: { rev: 6, account: true }, ff_account: a, ff_keys: { jev: false, or: false, cf: true } }), acct);
    const look = () => popup.evaluate(() => ({ alert: document.getElementById("acctAlert")?.innerText || "", cost: document.getElementById("cost")?.textContent || "",
      body: document.body.innerText, acct: window.__acct }));
    await seedPopup({ email: "me@example.com", plan: "trial", status: "trialing", periodEnd: Date.now() + 3 * DAY - 3600e3, usage: { today: 0.4, month: null }, devices: [], at: Date.now() });
    await popup.goto(`chrome-extension://${id}/popup.html`, { waitUntil: "load" });
    await wait(700);
    let v = await look();
    ok("弹窗·试用中：提示卡试用还剩 3 天和开通会员，底部是试用到哪天和今天用了多少，不提密钥、不说美元；打开时刷新会员状态",
      /^试用还剩 3 天$/m.test(v.alert) && /开通会员/.test(v.alert) && /试用到/.test(v.cost) && /今天已用 40%/.test(v.cost) && !/\$/.test(v.cost) &&
      !/OpenRouter/.test(v.body) && v.acct.some((m) => m.op === "refresh"), JSON.stringify(v));
    // 没登录（用户 10-25）：只说"请先登录"（不带句号）和登录按钮，开关、当前页、统计都置灰不能点
    await seedPopup(null);
    await wait(400);
    const locked = await popup.evaluate(() => ({ alert: document.getElementById("acctAlert")?.innerText || "",
      inert: document.getElementById("popMain")?.inert, disabled: document.getElementById("popMain")?.getAttribute("aria-disabled"), opacity: getComputedStyle(document.getElementById("popMain")).opacity }));
    await popup.evaluate(() => { window.__opened = []; window.__acct.length = 0; window.close = () => {}; document.querySelector("#acctAlert button").click(); });
    await wait(300);
    const popLogin = await popup.evaluate(() => ({ acct: window.__acct, opened: window.__opened }));
    ok("弹窗·没登录：点登录直接去官网登录（后台收到 loginStart，不开设置页）", popLogin.acct.at(-1)?.op === "loginStart" && popLogin.opened.length === 0, JSON.stringify(popLogin));
    ok("弹窗·没登录：请先登录（没有句号）、一个登录按钮；其余置灰、不能点", locked.alert.trim().split(/\n+/).join("|") === "请先登录|登录" && locked.inert === true && locked.disabled === "true" && Number(locked.opacity) < 0.6, JSON.stringify(locked));
    await seedPopup({ login: { code: "ABCD-EFGH", at: Date.now(), until: Date.now() + 600e3 } });
    await wait(400);
    v = await look();
    ok("弹窗·等官网确认：在打开的网页上完成登录 + 取消", v.alert.trim().split(/\n+/).join("|") === "在打开的网页上完成登录|取消", JSON.stringify(v.alert));
    await seedPopup({ email: "me@example.com", plan: null, status: "none", lastPlan: "trial", usage: null, devices: [], at: Date.now() });
    await wait(400);
    v = await look();
    ok("弹窗·试用结束：试用已结束、本地规则照常，两个按钮（开通会员、改用自己的密钥），底部未开通",
      /试用已结束/.test(v.alert) && /本地规则照常$/m.test(v.alert) && /开通会员/.test(v.alert) && /改用自己的密钥/.test(v.alert) && /未开通/.test(v.cost), JSON.stringify(v));
    await seedPopup({ email: "me@example.com", plan: "monthly", kind: "subscription", status: "active", renews: true, usage: { today: 0.1, month: 0.35 }, devices: [], at: Date.now() });
    await wait(400);
    v = await look();
    ok("弹窗·月付会员：没有提示卡，底部月付 · 自动续费 · 本月已用 35%", !v.alert && /月付/.test(v.cost) && /自动续费/.test(v.cost) && /本月已用 35%/.test(v.cost), JSON.stringify(v));
    await page.evaluate(() => chrome.storage.local.set({ ff_settings: { rev: 6 }, ff_account: null }));
    await popup.close();

    // ---------- 网页里的提示（notice.js） ----------
    const site = await browser.newPage();
    await site.setContent('<html lang="zh-CN"><body style="background:#fff"><p>page</p></body></html>');
    await site.evaluate(() => { window.chrome = { runtime: { sendMessage: (m, cb) => { (window.__sent ||= []).push(m); cb && cb({ ok: true }); }, onMessage: { addListener: (f) => { window.__onMsg = f; } }, lastError: null } }; });
    for (const f of ["i18n_page.js", "i18n.js", "notice.js"]) await site.addScriptTag({ content: fs.readFileSync(path.join(EXT, f), "utf8") });
    const bar = () => site.evaluate(() => { const h = document.querySelector("[data-ff-notice]"); if (!h) return null;
      return { kind: h.dataset.ffNotice, text: h.shadowRoot.querySelector(".tx").textContent, buttons: [...h.shadowRoot.querySelectorAll("button")].map((b) => b.textContent || b.getAttribute("aria-label")) }; });
    await site.evaluate(() => window.__onMsg({ type: "ffNotice", kind: "ended", plan: "trial" }));
    let n = await bar();
    ok("网页提示·试用结束：一句话、开通会员、改用自己的密钥、关闭", n && /^清流：试用已结束/.test(n.text) && JSON.stringify(n.buttons) === JSON.stringify(["开通会员", "改用自己的密钥", "关闭"]), JSON.stringify(n));
    await site.evaluate(() => document.querySelector("[data-ff-notice]").shadowRoot.querySelector("button").click());
    const sent = await site.evaluate(() => window.__sent);
    ok("点开通会员：请后台开设置页的开通那块，提示收起", JSON.stringify(sent) === JSON.stringify([{ type: "openPage", page: "plans" }]) && !(await bar()), JSON.stringify(sent));
    await site.evaluate(() => window.__onMsg({ type: "ffNotice", kind: "paid" }));
    n = await bar();
    ok("网页提示·开通了：会员已开通，只有关闭", n && /会员已开通/.test(n.text) && n.buttons.length === 1, JSON.stringify(n));
    await site.evaluate(() => window.__onMsg({ type: "ffNotice", kind: "quota_daily" }));
    n = await bar();
    ok("网页提示·今天额度用完：换掉上一条，只留一条", n && n.kind === "quota_daily" && /明天恢复/.test(n.text) && (await site.$$("[data-ff-notice]")).length === 1, JSON.stringify(n));
  } catch (e) {
    out.push(`FAIL 运行出错 ${e && e.stack || e}`);
  } finally {
    await browser.close();
    console.log(out.join("\n"));
    process.exitCode = out.some((l) => /^(FAIL|PAGEERROR)/.test(l)) ? 1 : 0;
  }
})();
