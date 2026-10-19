// YouTube 评论的长度和换行（0.28.7，review B14）。仿页面 yt/long.html（build_fakex.py），中文界面，替身补翻"【替身补翻】"加原文：
// ① 字里带换行的评论（pre-wrap，换行是 \n）：发出去的原文留着换行，译文里也是三处换行（空一行的那处两个）。
// ② 9000 多字的长评论：切成几截翻（每截都远低于后台一条 5000 字的上限），译文接回成一整条，中间的链接还在、最后一句也在。
// ③ 这条长评论在屏幕上：每一截都走标准通道（review B15：头几截换上以后原文那一格藏起来了，以前量它量成"不在屏幕上"，后面几截走了 flex）。
//    替身每截 400 毫秒才回；第 6 截头一次回的标记是乱的（换后备模型马上重翻），重翻那次是在前面几截换上、原文藏起来以后才发的。
// 用法：node test/yt_long_tx_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]（run_all.mjs 会起服务）
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await page.evaluateOnNewDocument(() => {
      window.__ffTxDelay = () => 400;
      window.__ffTxFn = (m) => (m.id === "yt_Ugl02" && m.part === 5 && !m.alt ? { action: "fill", text: "<p1>标记弄乱了", model: "stub/model", cost: 0, cached: false } : null);
    });
    await page.setViewport({ width: 900, height: 2000 });
    await page.goto(`${BASE}/fakex/yt/long.html`, { waitUntil: "load" });
    await wait(7000);
    const s = await page.evaluate(() => {
      const c = (id) => [...document.querySelectorAll("ytd-comment-view-model")].find((x) => (x.querySelector("#published-time-text a")?.getAttribute("href") || "").includes("lc=" + id));
      const clone = (id) => c(id).querySelector("#content-text > .ff-rtx-whole");
      const msgs = (window.__ffTxMsgs || []).filter((m) => m.type === "translateFill");
      const c1 = clone("Ugl01"), c2 = clone("Ugl02");
      return {
        m1: msgs.filter((m) => m.id === "yt_Ugl01").map((m) => m.source),
        m2: msgs.filter((m) => m.id === "yt_Ugl02").map((m) => m.source.length),
        flex2: msgs.filter((m) => m.id === "yt_Ugl02").map((m) => m.flex),
        retried: msgs.filter((m) => m.id === "yt_Ugl02" && m.alt).map((m) => m.flex),
        hiddenAt: (window.__ffTxMsgs || []).length,
        c1: c1 ? { br: c1.querySelectorAll("br").length, text: c1.textContent, shown: getComputedStyle(c1).display !== "none" } : null,
        c2: c2 ? { marks: (c2.textContent.match(/【替身补翻】/g) || []).length, end: c2.textContent.includes("it really is the end now."),
          link: c2.querySelector('a[href*="example.com%2Fnotes"]')?.textContent || null, len: c2.textContent.length, shown: getComputedStyle(c2).display !== "none",
          pending: c2.querySelectorAll(".ff-rtx-pending").length + (c2.classList.contains("ff-rtx-pending") ? 1 : 0) } : null,
        origLen: c("Ugl02").querySelector("#content-text > span").textContent.length,
      };
    });
    ok("① 发出去的原文留着换行", s.m1.length === 1 && /my note\.\nSecond line goes here\.\n\nThird line/.test(s.m1[0]), JSON.stringify(s.m1));
    ok("① 译文换上了，也是三处换行（空一行的那处两个）", !!s.c1 && s.c1.shown && s.c1.br === 3 && s.c1.text.includes("【替身补翻】"), JSON.stringify(s.c1));
    ok("② 长评论切成几截发（每截都不到 1000 字）", s.m2.length >= 8 && s.m2.every((n) => n < 1000), JSON.stringify(s.m2));
    ok("② 译文接回成一整条：每截一份译文、链接还在、最后一句也在、没有还在等的", !!s.c2 && s.c2.shown && s.c2.marks === s.m2.length - 1 && s.c2.link === "example.com/notes" && s.c2.end && s.c2.pending === 0 &&
      s.c2.len >= s.origLen, JSON.stringify({ ...s.c2, origLen: s.origLen }));
    ok("③ 在屏幕上的长评论每一截都走标准通道（包括前面几截换上、原文藏起来以后重翻的那一截）", s.retried.length === 1 && s.flex2.length >= 8 && s.flex2.every((f) => f === false), JSON.stringify({ retried: s.retried, all: s.flex2 }));
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
