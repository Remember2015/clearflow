# Changelog

## 0.28.5 — 2026-10-19

- Privacy: expired cache entries are now actually deleted (TypeSafe scores 7 days after judging, translations once unused for 30 days); before, they were only ignored until the cache filled up. ClearFlow no longer keeps a list of the last 50 cleaned replies (nothing showed it), and deletes the one already stored. Export now includes your corrections and the spam you marked; "Clear statistics and records" also clears your corrections; corrections are capped at the latest 3,000. The privacy policy and the Settings page describe this, and now also say that ClearFlow's own retranslations of X posts are sent to TypeSafe to compare them with X's.
- Fixed: clicking "judged right" on a notice bar no longer adds the reply to "spam you marked" (only hiding a reply yourself or the funnel does). Marked examples sent to TypeSafe are only the ones marked on that site.
- Translation: flex requests are always streamed, so the "nothing within 10 seconds" switch to the standard tier works and an abandoned request stops being billed; truncated or empty output no longer switches tiers; "try the other model" picks a model that wasn't tried yet.

## 0.28.4 — 2026-10-19

- Translation requests that aren't urgent — posts and comments just outside the screen being translated ahead of time, and improving X's own translations — now go through OpenAI's flex tier on OpenRouter, the same model at half the price. Anything on screen still uses the standard tier. If flex is busy or slow (nothing within 10 seconds), the request switches to the standard tier right away.

## 0.28.3 — 2026-10-19

- X translation: ClearFlow's retranslation now replaces X's automatic translation when it scores at least 0.05 higher (was 0.1; existing default settings are migrated, custom values are kept). If the retranslation scores even lower than X's, the other model (the fallback, DeepSeek V4.1 Flash by default) translates it once more and the better of the two is used.

## 0.28.2 — 2026-10-18

- With a Japanese interface, short all-kanji text that the browser can't identify is now treated as Chinese and translated (any kana means Japanese). Before, it was labeled Chinese but never translated.

## 0.28.1 — 2026-10-18

- YouTube comments: when YouTube shows its own "Translate to …" button on a comment (signed-in users, on Shorts and regular videos), ClearFlow clicks it for you and uses YouTube's (Google) translation instead of calling OpenRouter — no API cost. Each comment is clicked at most once (switch back to the original and it stays that way); if YouTube's translation doesn't arrive within a few seconds, ClearFlow translates it itself. Cleaning still judges the original text.

## 0.28.0 — 2026-10-18

- Language detection now asks the browser first: every post and comment is checked with Chrome's built-in, on-device language detector (`chrome.i18n.detectLanguage`), and ClearFlow's own script-based rules are used only when the browser isn't sure. Languages that share a script are now told apart when the browser is sure — Chinese comments get translated for a Japanese interface, Ukrainian for a Russian one. Measured on 1,118 X replies labeled by X: the language shown in the translation note didn't change for any of them, nothing extra was translated for Chinese, Korean, English, Spanish or Indonesian interfaces, and Chinese replies missed with a Japanese interface went from 115 to 47.

## 0.27.5 — 2026-10-18

- Fixed: an English text with a few Japanese characters in it (such as a Japanese hashtag at the end of a YouTube video description) was labeled as Japanese, and with a Japanese interface it wasn't translated at all.

## 0.27.4 — 2026-10-18 · first public release

ClearFlow (清流) was developed privately from 0.1 to 0.27 — under the working names “feed-filter” and later “BetterFeed”, renamed before release because other extensions already use that name. This is the first release published as open source. What it does:

- **Cleaning** on X (post pages, other people's profiles, search results), Reddit (comments, feeds, search), YouTube (video and Shorts comments), Xiaohongshu / RedNote (note comments) and Hacker News (abuse and sexual content only). Local structural rules first, then TypeSafe's Jev classifier; every hidden reply says why, can be shown, and can be marked as a wrong call. Replies from the post's author are judged too.
- **"Nice" / "+1" replies** (very short replies with no image or link that only react) are hidden entirely on X, Reddit, YouTube and Xiaohongshu, with one line at the top of the comments to show them again.
- **Runs of 2 or more hidden replies** merge into one line that expands back into the individual ones; on a thread with more than 5 such bars, hidden replies are tucked away entirely behind one summary line at the top (repeated below the comments when the thread is long) ("Cleared 19 replies: spam 17, “nice” or “+1” 2 · Show").
- **Learning from what you mark**: hide a reply yourself (a funnel on comments on Reddit, YouTube, Xiaohongshu and Hacker News; *Hide this reply* in X's menu; or the funnel on a notice bar) and replies of the same kind are hidden too. Exact repeats, the same link and near-identical templates are caught locally; your 10 most recent marks on that site go to TypeSafe as examples inside the requests it already makes, plus a check of replies on the page where you marked (including ones that load later). Undo from the notice, or manage the list in Settings.
- **Translation** through OpenRouter: on X, X's automatic translations are replaced only when the new one is clearly better, and the author's own untranslated replies are filled in; on the other sites, posts, titles and comments in a language other than yours are translated in place (between two languages written in the Latin alphabet — say Spanish for an English reader — only when the browser’s on-device language detection can tell which language it is, so some short replies stay as they are). Always switchable back to the original.
- **Per-site settings**, a first-run setup page (which says up front that your keys stay in this browser and go only to TypeSafe and OpenRouter), a popup with what was cleaned on the current page, 19 interface languages, a feedback card.
- Privacy policy, third-party notices, a reproducible test suite on synthetic pages, and a Chrome Web Store package script.

Changes since the last private build: learning from what you mark (above); translation now also works between Latin-alphabet languages on Reddit, YouTube, Xiaohongshu and Hacker News (before, an English, Spanish or Indonesian interface never translated any Latin-alphabet text); interface text has singular and plural forms; removed a developer-only option that recorded Reddit comments locally for evaluation, and a developer probe that recorded Reddit page structure (both are deleted from storage on update); completed the privacy notes in Settings; added third-party notices, `homepage_url` and `minimum_chrome_version`.
