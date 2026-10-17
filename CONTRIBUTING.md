# Contributing to ClearFlow

Thanks for helping. Issues and pull requests are welcome; for anything larger than a fix, please open an issue first so we can agree on the approach.

## Setup

```bash
npm run setup   # npm ci in ui/
npm run build   # rebuild extension/ui/* and the i18n files
npm test        # everything (needs Google Chrome; set CHROME_PATH if it isn't at the macOS default)
```

Load `extension/` in `chrome://extensions` (Developer mode → Load unpacked). After changing code, click the extension's reload button and reload the site's tab.

## Ground rules

- **Commit the built files.** `extension/ui/*`, `extension/i18n_all.js`, `extension/i18n_page.js`, `extension/_locales/*` and `extension/THIRD_PARTY_NOTICES.txt` are generated but committed, so the repository can be loaded as-is. Run `npm run build` before committing; CI fails if they're out of date.
- **No real user content in the repository.** Tests use synthetic pages (`extension/test/build_fakex.py`). Don't paste real comments, usernames or screenshots of other people into code, tests, issues or pull requests.
- **Rules look at structure, not phrasing.** Local rules may check things like length, links, mentions, repetition across accounts or hidden characters, but not keyword lists or regexes for spam phrasing — those break as soon as the topic or language changes. Meaning is Jev's job.
- **Thresholds come from data.** If you change a threshold or add a rule, say which data it was measured on (per site), what it catches and what it gets wrong. Each site is tuned on its own data.
- **Keep the comment style.** Comments explain *why* (and are mostly in Chinese); English comments are fine too.
- **Every change keeps `npm test` green.** Add or update a test in `extension/test/` for behaviour you change.

## Site layouts change

X, Reddit, YouTube and Xiaohongshu change their markup often. All page reading for a site lives in one file (`xdom.js`, `rdom.js`, `ytdom.js`, `xhsdom.js`, `hndom.js`). For X there's a probe you can paste into the browser console on a post page: `extension/test/x_probe.js` — it reports which parts the extension can still find, without collecting content.

## UI text and translations

- `i18n/en.json` is the reference, `i18n/zh-CN.json` the original wording; keep both in sync when adding a key.
- Other languages: `python3 i18n/translate.py --keys a.key,b.key` (uses OpenRouter; set `OPENROUTER_API_KEY`), then `npm run build`.
- Native speakers: fix a translation by adding it to `i18n/overrides.json` (it survives re-translation).

## Releases

Bump `version` in `extension/manifest.json` and `package.json`, add a `CHANGELOG.md` entry, `npm run build && npm test && npm run pack`, re-render the store images if the UI changed (`node scripts/store-assets.mjs`), and upload `dist/clearflow-<version>.zip`.
