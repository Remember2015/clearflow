# Architecture

```
 site page (X / Reddit / YouTube / Xiaohongshu / Hacker News)
 ├─ page-world helpers (X: pagedata.js, YouTube: ytdata.js)
 │    read the site's own API responses → original text, authors, translation state
 ├─ content scripts (isolated world)
 │    xdom.js · rdom.js · ytdom.js · xhsdom.js · hndom.js   ← all page reading for a site
 │    content.js (X) / fold_engine.js + reddit.js · yt.js · xhs.js · hn.js   ← what to judge, how to hide
 │    rules.js (local structural rules) · foldbar.js (the bars and lines drawn on the page)
 │    translate.js (X) / tx_engine.js + rtranslate.js · yttx.js · xhstx.js · hntx.js   ← translation
 │        │ chrome.runtime messages
 └────────▼
   background.js (service worker)
     settings, per-site switches, stats, corrections, caches (cache.js, IndexedDB)
     jev.js        → api.typesafe.ai   (Jev: yes/no questions per reply, batched by post)
     translator.js → openrouter.ai     (translation, quality check, fallback model)
     images.js     → image hosts       (only with "look at images" on)
   popup.html / options.html → ui/ (React) built into extension/ui/
```

- **Judging a reply.** Your own corrections win; then local rules (`rules.js`: referral parameters, base64-hidden contacts, invisible characters, near-identical lines from several accounts, mentions of outside accounts…); then Jev. Jev is asked, per reply and with the post as context: is it steering people elsewhere, an ad disguised as a comment, promoting someone by mention, abusive, sexual; some sites also ask whether it looks like part of a scam script, and very short replies are also asked whether they add anything beyond a generic reaction. If you have marked spam on that site, your 10 most recent marked replies ride along in the same request as examples and Jev is also asked whether each reply is the same kind (`marked`, cached separately because its fingerprint includes the examples); right after a mark, the page's uncleaned replies are asked once more, 25 per request (`markedCheck`). Each site sets its own thresholds (see the comments in `yt.js`, `xhs.js`, `reddit.js`, `content.js`).
- **Hiding.** Spam / abuse / sexual replies become a one-line bar with the reason; runs of 3+ merge into one line; content-free replies are removed entirely and counted in one line at the top.
- **Caching.** Jev results are cached for 7 days by a fingerprint of the question set, model version, post, author and reply text; translations for 30 days. Both caches are size-capped.
- **Strings.** `i18n/*.json` → `i18n/build.py` → `extension/i18n_all.js` (pages), `extension/i18n_page.js` (content scripts, only the keys they use), `extension/_locales/` (store name and description).
