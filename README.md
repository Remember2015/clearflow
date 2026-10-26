# ClearFlow

[中文说明](README.zh-CN.md) · [Website](https://clearflow.ohmyai.app)

ClearFlow (Chinese name 清流, “a clear stream”) is a Chrome extension that makes comment sections readable again on **X, Reddit, YouTube, Xiaohongshu (RedNote) and Hacker News**:

- **Cleans up junk replies** — spam and lead-generation bots, abuse, sexual content — and shows *why* each one was hidden. Click to see it anyway, and tell it when it got one wrong.
- **Hides content-free replies** like "nice", "+1", "mark", "following" (X, Reddit, YouTube, Xiaohongshu). One line at the top of the comments shows how many and brings them back.
- **Merges runs of hidden replies** into a single line, and when a thread is full of junk (more than 5 bars), hides it all behind one line at the top that says how many and brings them back.
- **Learns from what you mark.** Hide a spam reply yourself (the funnel on a comment, or *Hide this reply* in X's menu) and replies of the same kind — reworded, from other accounts, pushing the same scheme — are hidden too. Exact repeats, the same link and the same template are caught locally; your most recent marks also go to TypeSafe as examples in the requests it already makes. Marking can be undone.
- **Better translations.** On Reddit, YouTube, Xiaohongshu and Hacker News, foreign-language posts and comments are translated into your language in place, with a switch back to the original. On X it enhances X's own translations: poor ones are replaced and author replies X skipped are filled in; posts X doesn't translate are left alone.

The interface is available in 19 languages.

> ClearFlow is not affiliated with, endorsed by or sponsored by X, Reddit, YouTube/Google, Xiaohongshu or Y Combinator.

## How it works

Cheap local rules run first (referral links, hidden contact info, the same line posted by several accounts, invisible characters…). Everything they can't decide is sent, with the post it belongs to, through [OpenRouter](https://openrouter.ai) to [TypeSafe](https://typesafe.ai)'s "Jev" classifier, which answers a few yes/no questions per reply. Translation also goes through OpenRouter, to a model of your choice. Thresholds were tuned on each site's own data; the design rule is that local rules only look at *structure*, never at keyword lists, so the extension works the same across topics and languages.

## ClearFlow Membership, or your own key

The AI features (cleaning beyond the local rules, and translation) need one of these:

- **ClearFlow Membership:** sign in with your email (on the website, in a tab the extension opens) and it works, no API keys. A 7-day free trial without a card, then $2.90 a month or $24 a year, or a one-time 30-day ($3.90) or 1-year ($39) pass. Requests go through ClearFlow's server, which isn't part of this repository. Prices and terms: [clearflow.ohmyai.app/en/pricing](https://clearflow.ohmyai.app/en/pricing/).
- **Your own key**, as below.

| Service | Used for | Get a key |
|---|---|---|
| OpenRouter | cleaning (it passes replies to TypeSafe's Jev) and translation | https://openrouter.ai/keys |
| TypeSafe (optional) | judging replies directly: a little faster, and needed for checking images in replies (OpenRouter doesn't pass images on) | https://typesafe.ai |

It bills by usage, to you directly. Settings shows what you've spent this month and a monthly estimate. With neither membership nor a key, only the local rules run and nothing is translated. A first-run setup page walks you through choosing sites and signing in or entering keys.

## Privacy

With your own key, comments and posts you're looking at are sent to OpenRouter (which passes judging requests on to TypeSafe), or straight to TypeSafe if you added the optional TypeSafe key, and nothing is sent to the developers. With ClearFlow Membership they go through ClearFlow's server, which passes them on the same way and keeps only a cache of results; your account holds your email and usage counts. There's no analytics or tracking either way. Keys and history stay in your browser. Details: [PRIVACY.md](PRIVACY.md).

## Install

- **Chrome Web Store:** [ClearFlow](https://chromewebstore.google.com/detail/clearflow/dfojglbldlneaogknbphkiifmaagjjle). The same listing installs in Edge, Arc, Brave and other Chromium browsers.
- **From source:** download or clone this repository, open `chrome://extensions`, turn on *Developer mode*, click *Load unpacked* and choose the `extension` folder. The built files are committed, so no build step is needed just to try it. Works in Chrome 120+ and other Chromium browsers (Edge, Arc, Brave…).

## Develop

Requirements: Node 20+, Python 3, Google Chrome (for the browser tests).

```bash
npm run setup     # installs ui/ dependencies (npm ci)
npm run build     # builds the popup/settings UI into extension/ui and the 19-language strings into extension/
npm test          # all tests: unit, headless-Chrome and in-page tests (starts its own local servers)
npm run test:unit # unit tests only, no Chrome needed
npm run pack      # dist/clearflow-<version>.zip for the Chrome Web Store
```

Set `CHROME_PATH` if Chrome isn't at the default macOS location (on Linux usually `/usr/bin/google-chrome`).

Layout:

- `extension/` — the extension itself (Manifest V3). Content scripts per site (`content.js` for X; `reddit.js`, `yt.js`, `xhs.js`, `hn.js` on a shared `fold_engine.js`; translation in `translate.js` / `tx_engine.js`), the background service worker (`background.js`, talking to Jev in `jev.js` and OpenRouter in `translator.js`), and tests in `extension/test/` (synthetic pages only — no real user data).
- `ui/` — the popup and settings pages (React, shadcn/ui on Base UI, Tailwind), built into `extension/ui/`.
- `i18n/` — UI strings. `en.json` and `zh-CN.json` are written by hand; the other 17 languages are machine-translated with `i18n/translate.py` and fixed by hand in `overrides.json`.
- `docs/` — [architecture](docs/architecture.md) and the Chrome Web Store listing material.
- `site/` — the website, https://clearflow.ohmyai.app (`node site/build.mjs`; images from `node scripts/site-assets.mjs`; deployed to Cloudflare with `site/deploy.sh`).

Code comments are mostly in Chinese; they explain *why* a rule or threshold is what it is, often with the numbers behind it. The evaluation datasets and scripts used to tune thresholds are not part of this repository (they contain collected third-party content).

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## Feedback

Settings → *Feedback*, or write to developer@ohmyai.app. Bug reports and ideas are welcome as GitHub issues too.

## License

[MIT](LICENSE) © 2026 OhMyAI. Third-party components: [extension/THIRD_PARTY_NOTICES.txt](extension/THIRD_PARTY_NOTICES.txt).
