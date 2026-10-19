// 标记垃圾、以后类似的也清理（0.26）：手动清理一条，记进"你标记的垃圾"，这一页上没清理的马上问一遍"是不是同一类"（markedCheck，只发一次），
// 同一类的折起来写明原因；提示里能撤销；提示条上的漏斗也能标、再点取消。替身 Jev：?jev= 里给了 marked 分的，标记过以后才有这一问。
// ① Reddit 帖子页 post_en.html：没清理的评论作者那一行有漏斗，平时看不见、鼠标移上去才看得见；折了的（辱骂）没有。
//    点 t1_e1 的漏斗：它折成"你标记的垃圾回复"，存进 ff_confirmed_slogans（带原文），底部提示"已清理……撤销"；markedCheck 发一次、
//    问的是没清理的那几条（不含 t1_e1、折了的 t1_e4）；t1_e3（marked 0.9）折成"和你标记过的垃圾是同一类"。
//    点撤销：t1_e1、t1_e3 都放出来，存的那条和纠错都删掉。
//    再标一次 t1_e1，t1_e3 又折了；展开 t1_e3 点提示条上的漏斗：记进去（漏斗变实心），提示没有撤销；再点：取消，t1_e3 放出来。
// ② X 帖子页：没清理的回复"…"菜单里点"清理掉这条"：折起来、提示带撤销、存进去；status/123 上别的判过的都已经清理了，不发 markedCheck；
//    status/789 上标 921：和它去掉表情后一字不差的 922 本地当场清理，markedCheck 只问剩下两条。
// ③ X 7004（0.27，用户截图的样子）：菜单项有悬停底色；标"是这一部吧 + 短链"，一模一样的本地清理（一字不差）、换了链接少个字的按模板清理，
//    都不问 Jev，只问正常那条；标了以后才加载出来、分里没有这一问的，在标过的这一页上补问一次。
// 用法：node test/mark_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]（run_all.mjs 会起服务）
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const JEV = encodeURIComponent(JSON.stringify({ "Does anyone know if this works": { marked: 0.9 }, "best explanation": { marked: 0.95 } }));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    // ---------- ① Reddit ----------
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.setViewport({ width: 900, height: 1600 });
    await page.goto(`${BASE}/fakex/reddit/post_en.html?jev=${JEV}`, { waitUntil: "load" });
    await wait(3000);
    const st = () => page.evaluate(() => {
      const r = {};
      for (const c of document.querySelectorAll("shreddit-comment")) {
        const id = c.getAttribute("thingid"), meta = [...c.querySelectorAll('[slot="commentMeta"]')].find((e) => e.closest("shreddit-comment") === c);
        const body = [...c.querySelectorAll('[slot="comment"]')].find((e) => e.closest("shreddit-comment") === c);
        const bar = body.previousElementSibling?.classList.contains("ff-bar") ? body.previousElementSibling : null;
        const mark = meta?.querySelector(".ff-mark");
        r[id] = { mark: !!mark, markOpacity: mark ? getComputedStyle(mark).opacity : null, reason: bar?.querySelector(".ff-reason")?.textContent || null, tag: bar?.querySelector(".ff-tag")?.textContent || null };
      }
      const toast = document.querySelector(".ff-toast");
      return { c: r, noHover: matchMedia("(hover: none)").matches, toast: toast && toast.classList.contains("ff-toast-on") ? toast.textContent : null, undo: !!toast?.querySelector(".ff-toast-act"),
        saved: (chrome.storage.local._d.ff_confirmed_slogans || []).map((x) => [x.source?.id, x.raw]), checks: (window.__ffMarkedCheck || []).map((m) => m.replies.map((x) => x.id).sort()),
        override: chrome.storage.local._d["ff_reply_override:t1_e1"]?.label || null };
    });
    let s = await st();
    ok("没清理的评论作者那一行有漏斗，折了的（辱骂）没有", s.c.t1_e1.mark && s.c.t1_e3.mark && s.c.t1_e6.mark && !s.c.t1_e4.mark && !!s.c.t1_e4.reason, JSON.stringify(s.c));
    // 鼠标能悬停的设备上平时看不见、悬停才出来；没法悬停的（触屏，CI 上 Linux 的无头 Chrome 也报这个）一直半透明地露着（content.css 的 hover: none）
    ok("漏斗平时看不见（没法悬停的设备上半透明露着）", s.c.t1_e1.markOpacity === (s.noHover ? "0.6" : "0"), JSON.stringify({ opacity: s.c.t1_e1.markOpacity, noHover: s.noHover }));
    await page.hover('shreddit-comment[thingid="t1_e1"] [slot="comment"]');
    await wait(250);
    const hovered = await page.evaluate(() => getComputedStyle(document.querySelector('shreddit-comment[thingid="t1_e1"] .ff-mark')).opacity);
    ok("鼠标移到这条评论上看得见", Number(hovered) > 0.3, hovered);
    ok("还没标过：没问\"是不是同一类\"，t1_e3 没折", s.checks.length === 0 && !s.c.t1_e3.reason, JSON.stringify(s));

    await page.click('shreddit-comment[thingid="t1_e1"] .ff-mark');
    await wait(1200);
    s = await st();
    ok("点了漏斗：t1_e1 折成\"你标记的垃圾回复\"、纠错记成 missed", s.c.t1_e1.reason === "你标记的垃圾回复" && s.override === "missed", JSON.stringify([s.c.t1_e1, s.override]));
    ok("存进你标记的垃圾（带原文）", s.saved.length === 1 && s.saved[0][0] === "t1_e1" && /best explanation/.test(s.saved[0][1] || ""), JSON.stringify(s.saved));
    ok("底部提示：已清理、以后类似的也清理，带撤销", /已清理/.test(s.toast || "") && /类似/.test(s.toast || "") && s.undo, JSON.stringify([s.toast, s.undo]));
    ok("markedCheck 只发一次，问的是没清理的几条（不含标的这条、折了的 t1_e4）", s.checks.length === 1 && JSON.stringify(s.checks[0]) === JSON.stringify(["t1_e2", "t1_e3", "t1_e5", "t1_e6"]), JSON.stringify(s.checks));
    ok("t1_e3（同一类 0.9）折成\"和你标记过的垃圾是同一类\"，标签是垃圾回复", s.c.t1_e3.reason === "和你标记过的垃圾是同一类" && /垃圾/.test(s.c.t1_e3.tag || ""), JSON.stringify(s.c.t1_e3));
    ok("t1_e6（没给 marked 分）没折", !s.c.t1_e6.reason, JSON.stringify(s.c.t1_e6));

    await page.click(".ff-toast .ff-toast-act");
    await wait(800);
    s = await st();
    ok("撤销：t1_e1、t1_e3 都放出来，存的和纠错都删了", !s.c.t1_e1.reason && !s.c.t1_e3.reason && s.saved.length === 0 && !s.override, JSON.stringify(s));
    ok("撤销后没再发请求", s.checks.length === 1, JSON.stringify(s.checks));

    // 再标一次，再在 t1_e3 的提示条上点漏斗
    await page.hover('shreddit-comment[thingid="t1_e1"] [slot="comment"]');
    await page.click('shreddit-comment[thingid="t1_e1"] .ff-mark');
    await wait(1200);
    s = await st();
    ok("再标一次：t1_e3 又折了", s.c.t1_e3.reason === "和你标记过的垃圾是同一类" && s.checks.length === 2, JSON.stringify([s.c.t1_e3, s.checks.length]));
    await page.evaluate(() => { const b = document.querySelector('shreddit-comment[thingid="t1_e3"] .ff-bar'); b.click(); });
    await wait(300);
    const barBtn = () => page.evaluate(() => { const b = [...document.querySelectorAll('shreddit-comment[thingid="t1_e3"] .ff-bar .ff-icon')].find((x) => /类似/.test(x.getAttribute("aria-label") || "")); return b ? { label: b.getAttribute("aria-label"), on: b.classList.contains("ff-on") } : null; });
    let fb = await barBtn();
    ok("展开的提示条上有漏斗\"以后类似的也清理\"，还没选", !!fb && fb.label === "以后类似的也清理" && !fb.on, JSON.stringify(fb));
    await page.evaluate(() => [...document.querySelectorAll('shreddit-comment[thingid="t1_e3"] .ff-bar .ff-icon')].find((x) => /类似/.test(x.getAttribute("aria-label") || "")).click());
    await wait(1000);
    s = await st(); fb = await barBtn();
    ok("点了：t1_e3 也存进去、漏斗变实心、提示没有撤销", s.saved.some((x) => x[0] === "t1_e3") && fb && fb.on && fb.label === "不再清理类似的" && /已清理/.test(s.toast || "") && !s.undo, JSON.stringify([s.saved, fb, s.toast, s.undo]));
    await page.evaluate(() => [...document.querySelectorAll('shreddit-comment[thingid="t1_e3"] .ff-bar .ff-icon')].find((x) => /类似/.test(x.getAttribute("aria-label") || "")).click());
    await wait(800);
    s = await st();
    ok("再点：t1_e3 从你标记的里去掉，按\"同一类\"折的放出来", !s.saved.some((x) => x[0] === "t1_e3") && !s.c.t1_e3.reason, JSON.stringify([s.saved, s.c.t1_e3]));
    await page.close();

    // ---------- ② X ----------
    // markOnX(页面, 第几条)：点那条回复"…"菜单里的"清理掉这条"，回报那条的 id、提示、存的、发了几次 markedCheck、每条的折叠原因
    async function markOnX(url, pick) {
      const x = await browser.newPage();
      x.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
      await x.setViewport({ width: 900, height: 1600 });
      await x.goto(`${BASE}${url}`, { waitUntil: "load" });
      await wait(2500);
      const target = await x.evaluate((pick) => {
        const a = [...document.querySelectorAll('article[data-testid="tweet"]')].find((el) => el.querySelector(`a[href*="/status/${pick}"]`));
        a.querySelector('[data-testid="caret"]').click();
        return pick;
      }, pick);
      await wait(400);
      await x.evaluate(() => { const m = [...document.querySelectorAll(".ff-menuitem")].find((e) => /清理掉这条/.test(e.textContent)); m && m.click(); });
      await wait(1200);
      await x.evaluate(() => document.querySelectorAll(".ff-bar.ff-group").forEach((g) => g.click())); // 连着两条以上会合成一条：点开看每条
      await wait(500);
      const r = await x.evaluate((id) => {
        const toast = document.querySelector(".ff-toast");
        const reasons = Object.fromEntries([...document.querySelectorAll('article[data-testid="tweet"]')].map((a) => {
          const sid = a.querySelector('a[href*="/status/"]').getAttribute("href").match(/status\/(\d+)/)[1];
          return [sid, document.querySelector(`.ff-bar[data-ff-id="${sid}"] .ff-reason`)?.textContent || null];
        }));
        return { toast: toast && toast.classList.contains("ff-toast-on") ? toast.textContent : null, undo: !!toast?.querySelector(".ff-toast-act"),
          saved: (chrome.storage.local._d.ff_confirmed_slogans || []).map((e) => e.source?.id), checks: (window.__ffMarkedCheck || []).map((m) => m.replies.map((y) => y.id).sort()),
          override: chrome.storage.local._d["ff_reply_override:" + id]?.label || null, reasons };
      }, target);
      await x.close();
      return { target, ...r };
    }
    let xs = await markOnX("/fakex/status/123/", "901");
    ok("X：菜单里清理掉这条——纠错记成 missed、存进你标记的垃圾、提示带撤销",
      xs.override === "missed" && xs.saved.includes("901") && /已清理/.test(xs.toast || "") && xs.undo, JSON.stringify(xs));
    ok("X：这一页别的判过的回复都已经清理了，没东西可问就不发 markedCheck", xs.checks.length === 0, JSON.stringify(xs.checks));
    const XJEV = encodeURIComponent(JSON.stringify({ "测试同帖复读规则🏺": { marked: 0.9 } }));
    xs = await markOnX(`/fakex/status/789/?jev=${XJEV}`, "921");
    // 922 和标的 921 去掉表情后一字不差：本地当场认出来（不问 Jev），markedCheck 只问剩下两条
    ok("X：一字不差的那条本地就清理（\"和你标记过的一字不差\"），不用问", xs.reasons["922"] === "和你标记过的一字不差", JSON.stringify(xs.reasons));
    ok("X：没清理的另外两条问一次", JSON.stringify(xs.checks) === JSON.stringify([["923", "924"]]) && !xs.reasons["923"] && !xs.reasons["924"], JSON.stringify([xs.checks, xs.reasons]));

    // ---------- ③ X 7004（用户 10-17 截图的样子）----------
    {
      const x = await browser.newPage();
      x.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
      await x.setViewport({ width: 900, height: 1600 });
      await x.goto(`${BASE}/fakex/status/7004/?jev=${encodeURIComponent(JSON.stringify({ "想看完整版": { marked: 0.9 } }))}`, { waitUntil: "load" });
      await wait(2500);
      // 每条自己的折叠条（连着三条以上会合成一条，单条的折叠条还在、藏在合起来的那条下面）
      const reasons = () => x.evaluate(() => Object.fromEntries([...document.querySelectorAll('article[data-testid="tweet"]')].map((a) => {
        const id = a.querySelector('a[href*="/status/"]').getAttribute("href").match(/status\/(\d+)/)[1];
        return [id, document.querySelector(`.ff-bar[data-ff-id="${id}"] .ff-reason`)?.textContent || null];
      })));
      await x.evaluate(() => { [...document.querySelectorAll('article[data-testid="tweet"]')].find((el) => el.querySelector('a[href*="/status/7401"]')).querySelector('[data-testid="caret"]').click(); });
      await wait(400);
      await x.hover(".ff-menuitem");
      await wait(250);
      const bg = await x.evaluate(() => getComputedStyle(document.querySelector(".ff-menuitem")).backgroundColor);
      ok("X 菜单里\"清理掉这条\"：鼠标移上去有底色（X 自己的悬停是脚本加的，克隆过来没有）", bg === "rgba(15, 20, 25, 0.04)", bg);
      await x.evaluate(() => { window.__ffNoMarkedInJev = true; [...document.querySelectorAll(".ff-menuitem")].find((e) => /清理掉这条/.test(e.textContent)).click(); });
      await wait(1500);
      const group = await x.evaluate(() => { const g = document.querySelector(".ff-bar.ff-group"); const t = g?.textContent || null; g?.click(); return t; }); // 连着三条合成了一条：点开看每条
      await wait(600);
      let r = await reasons();
      ok("标的、一模一样的、换了链接的连着三条，合成一条", /3/.test(group || ""), String(group));
      const checks1 = await x.evaluate(() => (window.__ffMarkedCheck || []).map((m) => m.replies.map((y) => y.id).sort()));
      ok("一模一样的（连链接）本地清理：\"和你标记过的一字不差\"", r["7402"] === "和你标记过的一字不差", JSON.stringify(r));
      ok("换了链接、少一个字的：\"和你标记过的是同一个模板\"", r["7403"] === "和你标记过的是同一个模板", JSON.stringify(r));
      ok("本地认出来的不问 Jev，只问正常的那条", JSON.stringify(checks1) === JSON.stringify([["7404"]]) && !r["7404"], JSON.stringify([checks1, r]));
      // 标了以后才加载出来的一条（分当作从缓存拿的、没有 marked）：标过的这一页上补问一次
      await x.evaluate(() => {
        const src = [...document.querySelectorAll('[data-testid="cellInnerDiv"]')].find((c) => c.querySelector('a[href*="/status/7404"]'));
        const cell = src.cloneNode(true);
        cell.querySelectorAll(".ff-bar, .ff-own").forEach((e) => e.remove());
        cell.querySelector('[data-testid="User-Name"]').textContent = "后来的\n@late_bot_7405";
        cell.querySelector('a[href*="/status/"]').setAttribute("href", "/late_bot_7405/status/7405");
        cell.querySelector('[data-testid="tweetText"]').textContent = "想看完整版的私信我，我发你";
        src.parentElement.appendChild(cell);
      });
      await wait(2500);
      r = await reasons();
      const checks2 = await x.evaluate(() => (window.__ffMarkedCheck || []).map((m) => m.replies.map((y) => y.id).sort()));
      ok("标过的页上后来加载的、分里没有这一问的：补问一次，同一类的清理", JSON.stringify(checks2) === JSON.stringify([["7404"], ["7405"]]) && r["7405"] === "和你标记过的垃圾是同一类",
        JSON.stringify([checks2, r]));
      await x.close();
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
