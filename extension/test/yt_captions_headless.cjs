// YouTube 字幕（0.29.0；用户 10-19）。仿页面 yt/captions.html（build_fakex.py）：仿播放器，时间真的在走，中文（简体）界面（i18n 跟着 zh-CN）。
// ① 选了繁体中文字幕（zh-TW）：显示成简体、台湾用词换成大陆用词；后面一个 ✦，点它看原文、再点换回来。
// ② 选了"自动翻译 → 中文（简体）"、视频有人工的繁体中文字幕：换成它（转成简体，按它自己的时间），不判、不重翻。
// ③ 没有人工中文字幕（?nohuman）、Jev 判 YouTube 的机翻差（替身给 0.4）：原文整段交给模型重翻，按原文的时间显示我们的译文；眼前这段走标准通道。
// ④ 判下来不差（?capjudge=0.9）：照旧用 YouTube 的，不重翻。
// ⑤ 拖进度（用户 10-19："播放器可以调进度"）：400 行的长视频（?long），翻好开头那段以后拖到 100 秒——那一段（80–119 行）走标准通道去翻，翻好后显示我们的。
// ⑥ 一路拖过去（250、290、330 秒每 80 毫秒一下，停在 370 秒）：路过的那几段（240、280、320 行开头的）不翻，只翻停下来的那一段（360–399 行）。
// 用法：node test/yt_captions_headless.cjs <装了 puppeteer-core 的目录> [http://localhost:8767]（run_all.mjs 会起服务）
const path = require("path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
require("../zhconv.js");
const conv = (s) => globalThis.FFZhConv.convert(s, "tw2sp");
const BASE = process.argv[3] || "http://localhost:8767";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name} ${cond ? "" : extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const EN = ["The researchers set out to measure", "how long people can stay focused", "on a single computer program", "before switching to another one.", "The answer they found was", "about forty seconds on average."];
const MT = ["研究人员开始测量", "人们能够保持专注多久", "在单个计算机程序上", "在切换到另一个之前。", "他们找到的答案是", "平均约四十秒。"];
const TW = ["這些研究人員想測量大家", "在一個軟體上能專心多久", "才會切換到別的程式和影片。", "答案是平均大約四十秒。"];
// 现在该显示哪一行：离换行 0.35 秒以内的不算（两边都可能）
const at = (list, step, t) => { const i = Math.floor(t / step), r = t - i * step; return i < list.length && r > 0.35 && r < step - 0.35 ? list[i] : undefined; };

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new",
    args: ["--no-first-run", "--autoplay-policy=no-user-gesture-required"] });
  const open = async (q) => {
    const pg = await browser.newPage();
    pg.on("pageerror", (e) => out.push(`PAGEERROR ${e.message}`));
    await pg.setViewport({ width: 900, height: 700 });
    await pg.goto(`${BASE}/fakex/yt/captions.html${q}`, { waitUntil: "load" });
    return pg;
  };
  const now = (pg) => pg.evaluate(() => { const v = document.querySelector("#movie_player video"), w = document.querySelector(".caption-window");
    return { t: v.currentTime, text: w ? [...w.querySelectorAll(".ytp-caption-segment")].map((s) => s.textContent).join("") : null, mark: w?.querySelector(".ff-cap-mark")?.title || null }; });
  // 等到能判的时刻（不在换行边上），返回 {t, text, mark, want}
  const sample = async (pg, want) => { for (let k = 0; k < 60; k++) { const s = await now(pg); const w = want(s.t); if (w !== undefined && s.text != null) return { ...s, want: w }; await wait(120); } return { want: "（等不到）" }; };
  try {
    // ①
    let pg = await open("");
    await wait(600);
    await pg.evaluate(() => window.__setTrack("zh-TW"));
    await wait(2000);
    let s = await sample(pg, (t) => { const x = at(TW, 2.25, t); return x && conv(x); });
    ok("① 繁体字幕显示成简体、台湾用词换成大陆用词；后面一个 ✦ 说插件转成了简体", s.text === s.want && s.want !== at(TW, 2.25, s.t) && /转成了简体/.test(s.mark || ""), JSON.stringify(s));
    await pg.click(".ff-cap-mark");
    await wait(150);
    s = await sample(pg, (t) => at(TW, 2.25, t));
    ok("① 点 ✦ 看原文：繁体原文", s.text === s.want && /原来的字幕/.test(s.mark || ""), JSON.stringify(s));
    await pg.click(".ff-cap-mark");
    await wait(150);
    s = await sample(pg, (t) => { const x = at(TW, 2.25, t); return x && conv(x); });
    ok("① 再点换回简体", s.text === s.want, JSON.stringify(s));
    await pg.close();
    // ②
    pg = await open("");
    await wait(600);
    await pg.evaluate(() => window.__setTrack("en", "zh-Hans"));
    await wait(2200);
    s = await sample(pg, (t) => { const x = at(TW, 2.25, t), y = at(MT, 1.5, t); return x && y && conv(x); });
    const capMsgs2 = await pg.evaluate(() => (window.__ffCapMsgs || []).length);
    ok("② 自动翻译成简体、有人工繁体字幕：换成它（转成简体），不判不重翻", s.text === s.want && /人工中文字幕/.test(s.mark || "") && capMsgs2 === 0, JSON.stringify({ s, capMsgs2 }));
    await pg.close();
    // ③
    pg = await open("?nohuman");
    await wait(600);
    await pg.evaluate(() => window.__setTrack("en", "zh-Hans"));
    await wait(2500);
    s = await sample(pg, (t) => { const x = at(EN, 1.5, t); return x && "【替身字幕】" + x; });
    const m3 = await pg.evaluate(() => window.__ffCapMsgs || []);
    const judge = m3.find((m) => m.type === "captionJudge"), tr = m3.filter((m) => m.type === "captionTranslate");
    ok("③ 没有人工中文字幕、YouTube 的机翻判下来差：把原文和 YouTube 的译文交给 Jev 判", !!judge && judge.source.includes("The researchers set out") && judge.translation.includes("研究人员开始测量") && judge.target === "zh-Hans", JSON.stringify(judge));
    ok("③ 原文整段重翻（眼前这段走标准通道），按原文的时间显示我们的译文", tr.length >= 1 && tr[0].flex === false && tr[0].lines.length === 6 && s.text === s.want && /重新翻译/.test(s.mark || ""), JSON.stringify({ s, tr: tr.map((m) => [m.lines.length, m.flex]) }));
    await pg.close();
    // ④
    pg = await open("?nohuman&capjudge=0.9");
    await wait(600);
    await pg.evaluate(() => window.__setTrack("en", "zh-Hans"));
    await wait(2500);
    s = await sample(pg, (t) => at(MT, 1.5, t));
    const m4 = await pg.evaluate(() => window.__ffCapMsgs || []);
    ok("④ 判下来不差：照旧用 YouTube 的、不重翻、没有 ✦", s.text === s.want && !s.mark && m4.some((m) => m.type === "captionJudge") && !m4.some((m) => m.type === "captionTranslate"), JSON.stringify({ s, m4: m4.map((m) => m.type) }));
    await pg.close();
    // ⑤ ⑥
    const LONG = (k) => `Line ${k} of the long synthetic talk.`;
    const longAt = (t) => { const k = Math.floor(t), r = t - k; return r > 0.3 && r < 0.7 && k < 400 ? "【替身字幕】" + LONG(k) : undefined; };
    const chunks = (ms) => ms.filter((m) => m.type === "captionTranslate").map((m) => [Number(m.lines[0].match(/Line (\d+)/)[1]), m.flex]);
    pg = await open("?long");
    await wait(600);
    await pg.evaluate(() => window.__setTrack("en", "zh-Hans"));
    await wait(2500);
    s = await sample(pg, longAt);
    ok("⑤ 长视频：开头那段翻好了、显示我们的", s.text === s.want, JSON.stringify({ s, chunks: chunks(await pg.evaluate(() => window.__ffCapMsgs || [])) }));
    await pg.evaluate(() => window.__seek(100.4));
    await wait(1500);
    s = await sample(pg, longAt);
    let c5 = chunks(await pg.evaluate(() => window.__ffCapMsgs || []));
    ok("⑤ 拖到 100 秒：那一段（80–119 行）走标准通道翻，显示跟上", s.text === s.want && s.t > 100 && c5.some(([k, flex]) => k === 80 && flex === false), JSON.stringify({ s, c5 }));
    const before = c5.length;
    for (const x of [250.2, 290.2, 330.2, 370.2]) { await pg.evaluate((x) => window.__seek(x), x); await wait(80); }
    await wait(1500);
    s = await sample(pg, longAt);
    const c6 = chunks(await pg.evaluate(() => window.__ffCapMsgs || [])).slice(before);
    ok("⑥ 一路拖过去：路过的那几段不翻，只翻停下来的那段（360–399 行，标准通道），显示跟上", s.text === s.want && s.t > 370 && c6.some(([k, flex]) => k === 360 && flex === false) && !c6.some(([k]) => [240, 280, 320].includes(k)),
      JSON.stringify({ s, c6 }));
    await pg.close();
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
