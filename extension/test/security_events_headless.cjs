// Real MV3 extension, synthetic Reddit fixture, no API keys or external network.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require(path.resolve(process.argv[2] || path.join(__dirname, "../../ui"), "node_modules/puppeteer-core"));
const EXT = path.resolve(__dirname, "..");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: "new", pipe: true,
    args: ["--enable-unsafe-extension-debugging", "--no-first-run", "--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND"],
    ignoreDefaultArgs: ["--disable-extensions"],
  });
  try {
    const { id } = await (await browser.target().createCDPSession()).send("Extensions.loadUnpacked", { path: EXT });
    const settings = await browser.newPage();
    await settings.goto(`chrome-extension://${id}/options.html`, { waitUntil: "load" });
    await settings.evaluate(async () => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({ ff_onboarded: 1, ff_settings: { rev: 6, enabled: true, useJev: false, translate: false, translateFill: false, account: false } });
    });
    const fixture = fs.readFileSync(path.join(__dirname, "fakex/reddit/post_en.html"), "utf8").replace(/<script id="ff-inject">[\s\S]*?<\/script>/, "");
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (r) => r.isNavigationRequest() && r.url().startsWith("https://www.reddit.com/")
      ? r.respond({ status: 200, contentType: "text/html", body: fixture }) : r.abort());
    await page.goto("https://www.reddit.com/r/fakesub/comments/def456/slug/", { waitUntil: "load" });
    const mark = 'shreddit-comment[thingid="t1_e1"] .ff-mark';
    const bar = '.ff-bar[data-ff-id="t1_e1"]';
    await page.waitForSelector(mark);
    const stored = () => settings.evaluate(async () => {
      const d = await chrome.storage.local.get(["ff_reply_override:t1_e1", "ff_confirmed_slogans"]);
      return { label: d["ff_reply_override:t1_e1"]?.label || null, marked: (d.ff_confirmed_slogans || []).some((x) => x.source?.id === "t1_e1") };
    });
    const waitStored = (label) => settings.waitForFunction(async (label) => ((await chrome.storage.local.get("ff_reply_override:t1_e1"))["ff_reply_override:t1_e1"]?.label || null) === label, {}, label);
    await page.evaluate((mark) => {
      const b = document.querySelector(mark);
      b.click();
      b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      b.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }, mark);
    await new Promise((r) => setTimeout(r, 150));
    assert.deepEqual(await stored(), { label: null, marked: false });
    console.log("PASS page-generated click and keyboard events cannot persist a mark");

    await page.click(mark);
    await waitStored("missed");
    assert.deepEqual(await stored(), { label: "missed", marked: true });
    console.log("PASS a real user click still persists a mark");

    await page.evaluate(() => document.querySelector(".ff-toast-act").click());
    assert.deepEqual(await stored(), { label: "missed", marked: true });
    await page.click(".ff-toast-act");
    await waitStored(null);
    assert.deepEqual(await stored(), { label: null, marked: false });
    console.log("PASS synthetic undo is ignored and real user undo still works");

    await page.waitForSelector(mark);
    await page.focus(mark);
    await page.keyboard.press("Enter");
    await waitStored("missed");
    await page.waitForSelector(bar);
    await page.evaluate((bar) => document.querySelector(bar).click(), bar);
    const decisions = `${bar} button`;
    await page.waitForFunction((bar) => document.querySelectorAll(`${bar} button`).length === 4, {}, bar);
    await page.evaluate((decisions) => [...document.querySelectorAll(decisions)].slice(0, 3).forEach((b) => b.click()), decisions);
    assert.deepEqual(await stored(), { label: "missed", marked: true });
    console.log("PASS keyboard marking and internal expansion work; synthetic correction and forgetting do not");

    await page.click(`${bar} button:nth-of-type(2)`);
    await waitStored("fp");
    assert.deepEqual(await stored(), { label: "fp", marked: false });
    await page.reload({ waitUntil: "load" });
    assert.deepEqual(await stored(), { label: "fp", marked: false });
    console.log("PASS real user correction persists across page reloads");
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
