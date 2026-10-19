// 帖子作者自己的回复"在接着讲自己这个帖子"（0.28.11，jev.js 的 op_topic；用户 10-19：Rach 发"新的 Zig UI 框架快出了"，
// 自己回"上线了：github 链接"被当成拉人清理）。替身 Jev 按 ?jev 给分：
// ① X 帖子页（thread.html）：楼主的 3002 拉人分 0.9、op_topic 0.9 → 不清理；别人的 3005 同样拉人 0.9 → 清理（op_topic 只问楼主的）；
//    楼主骂人的 3007 op_topic 再高也照样清理（只放过垃圾三问）；请求里只有楼主的回复多问 op_topic。
// ② 同一页 op_topic 0.3（借自己的帖子打无关的广告）→ 楼主的 3002 照样清理。
// ③ Reddit 帖子页（post.html）：楼主的 r05 拉人 0.9、op_topic 0.9 → 不清理；op_topic 0.2 → 清理。
// 用法：node test/op_topic_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]（run_all.mjs 会起服务）
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (o) => encodeURIComponent(JSON.stringify(o));
const summary = (pg) => pg.evaluate(() => new Promise((res) => { let s = null; for (const f of window.__ffOnMessage || []) f({ type: "pageSummary" }, {}, (r) => { s = r; }); setTimeout(() => res(s), 50); }));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-first-run"] });
  const open = async (url) => {
    const pg = await browser.newPage();
    pg.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await pg.setViewport({ width: 900, height: 2000 });
    await pg.goto(url, { waitUntil: "load" });
    await wait(3500);
    return pg;
  };
  try {
    // ①
    let pg = await open(`${BASE}/fakex/thread.html?jev=${q({ "old plan": { benefit: 0.9, op_topic: 0.9 }, "Congrats on the launch": { benefit: 0.9, op_topic: 0.9 }, "Synthetic line for the fold test": { op_topic: 0.95 } })}`);
    let s = await summary(pg);
    const folded = (s.folded || []).map(([id, kind]) => `${id}:${kind}`);
    const reqs = await pg.evaluate(() => (window.__ffJevAll || []).flatMap((m) => m.replies).map((r) => [r.id, (r.ask || []).join("+")]));
    ok("① X：楼主接着讲自己帖子的（op_topic 0.9）不清理；别人的同样拉人照样清理", !folded.some((x) => x.startsWith("3002:")) && folded.includes("3005:jev"), JSON.stringify(folded));
    ok("① X：楼主骂人的 op_topic 再高也照样清理（只放过垃圾三问）", folded.includes("3007:abuse"), JSON.stringify(folded));
    const askOf = (id) => (reqs.find(([x]) => x === id) || [null, null])[1];
    ok("① X：只有楼主的回复多问 op_topic", /op_topic/.test(askOf("3002") || "") && /op_topic/.test(askOf("3007") || "") && !/op_topic/.test(askOf("3005") || ""), JSON.stringify(reqs));
    await pg.close();
    // ②
    pg = await open(`${BASE}/fakex/thread.html?jev=${q({ "old plan": { benefit: 0.9, op_topic: 0.3 } })}`);
    s = await summary(pg);
    ok("② X：楼主借自己帖子打无关广告的（op_topic 0.3）照样清理", (s.folded || []).some(([id, kind]) => id === "3002" && kind === "jev"), JSON.stringify(s.folded));
    await pg.close();
    // ③
    const rd = async (opTopic) => {
      const p = await open(`${BASE}/fakex/reddit/post.html?jev=${q({ "另一件事": { benefit: 0.9, op_topic: opTopic } })}`);
      const r = await p.evaluate(() => { const c = [...document.querySelectorAll("shreddit-comment")].find((x) => x.getAttribute("thingid") === "t1_r05");
        const body = [...c.querySelectorAll('[slot="comment"]')].find((e) => e.closest("shreddit-comment") === c); return !!body.previousElementSibling?.classList.contains("ff-bar"); });
      await p.close();
      return r;
    };
    const hi = await rd(0.9), lo = await rd(0.2);
    ok("③ Reddit：楼主接着讲的不清理、打无关广告的清理", !hi && lo, JSON.stringify({ hi, lo }));
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
