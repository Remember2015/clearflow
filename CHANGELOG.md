# Changelog

## 0.35.0 — 2026-10-27

- On X post pages, a reply whose display name is itself an ad (a rebate or referral offer, a promo channel, a way to contact them) is hidden even when the text of the reply looks normal; the bar says “The display name is an ad”.
- New: **ClearFlow Membership**, an alternative to using your own key. Sign in with your email and the AI features work without an API key. New accounts get a 7-day free trial without a card; then $2.90 a month or $24 a year, or a one-time 30-day ($3.90) or 1-year ($39) pass. WeChat Pay works for the one-time passes (mainland China and Hong Kong). Payments are handled by Waffo. Choose it in first-time setup or in Settings → Connections and cost; your own key keeps working as before.
- Signing in happens on clearflow.ohmyai.app, in a tab the extension opens. If you're already signed in there it takes one step, and the extension and the website keep each other signed in.
- Settings shows your account at the top right (members get a small gold star). Usage, devices (up to 3), renewing, switching from monthly to yearly, cancelling and refunds (full refund within 7 days of your first purchase) are in Connections and cost and on the website's account page.
- With membership, the content to judge or translate goes through ClearFlow's server instead of straight to OpenRouter. The [privacy policy](PRIVACY.md) (effective October 26, 2026) and [terms of service](TERMS.md) describe what the server keeps; with your own key nothing changes.
- When membership can't be used right now (today's or this month's allowance is used up, the membership or trial has ended, or you're signed out), the line above the comments says so in plain words, instead of an error code with a retry link that couldn't help.
- Popup: the Feedback link no longer breaks onto two lines in Thai.
- Settings: error messages stay until you close them; “Remove all” for the spam you marked asks first; if image access is refused, the message says how to turn it on again; the key rows fit narrow windows; red text is easier to read; with Windows high contrast, cards keep their outlines; sliding and zooming animations follow the system's reduce-motion setting.

## 0.29.11 — 2026-10-23

- One API key is enough: filtering and translation both go through OpenRouter now. ClearFlow sends the replies it can't decide on its own to TypeSafe's Jev model through OpenRouter, using your OpenRouter key; it's the same model at the same price, about 0.4 seconds slower. Getting a key from TypeSafe directly can involve a waitlist, so it's no longer needed.
- A TypeSafe key is optional (Settings → Advanced). With one, replies are checked by TypeSafe directly, a little faster, and "Check images in replies" works — OpenRouter doesn't pass images on, so that setting needs a TypeSafe key. If you already entered a TypeSafe key, nothing changes for you.
- First-time setup asks for the OpenRouter key only, and Settings → Connections and cost shows just OpenRouter.
- Privacy policy updated (effective October 23, 2026) to say that judging requests go through OpenRouter unless you add a TypeSafe key.

## 0.29.10 — 2026-10-23

- First-time setup, API keys step: shorter text and fewer buttons. Each key has one line saying what it's for and where to get it, a field and Save. Saving checks the key right away and says whether it works, so there's no separate "Test connection"; a key that doesn't work leaves the field open to fix it. "Later" and "Next" are now one button.

## 0.29.9 — 2026-10-23

- X: when ClearFlow improves Grok's translation of a post that's on screen, it now uses OpenAI's standard lane instead of trying the half-price flex lane first. The flex lane is often busy, and the post you were looking at could wait about 10 seconds before the translation even started. Posts above or below the screen that are translated ahead of time still use the flex lane, as the other translations already did.

## 0.29.8 — 2026-10-21

- X: when TypeSafe judges X's own (Grok) translation of a post to be poor, ClearFlow's retranslation now replaces it directly. It used to be scored by TypeSafe again and swapped in only if it scored clearly higher, but that second score missed correct translations of slang, and on real posts it didn't make the shown translations any better. Quick checks on your computer still catch broken output — the text sent back untranslated, written in the wrong language, or far too short or long; then the fallback model tries once, and if that fails too, Grok's version stays.
- ClearFlow's retranslations are no longer sent to TypeSafe. The privacy policy is updated (effective October 21, 2026).
- Settings → Advanced no longer has "Replace only if the new score is higher by at least", and the note under an improved translation no longer shows scores.

## 0.29.7 — 2026-10-21

- Translation: swearing and sexual expressions that aren't meant literally — crude ways of praising, thanking or exclaiming — are now translated by what they mean, with an equally crude expression, instead of word for word (a French post praising people with a vulgar idiom used to come out as a sexual description). Swearing and sexual content that is meant literally is still translated literally. Translations made before this change are redone the next time they're needed.

## 0.29.6 — 2026-10-20

- Clearer, shorter wording across Settings, the popup and the welcome page, in all languages. The English interface now consistently says "hide" and "filtering"; the Chinese interface says 密钥 instead of "key".
- English: the line above replies like "nice" or "+1" reads "Hid N replies like…", and its help text now says what happens: they're hidden, and that line shows them again.
- Privacy policy updated (effective October 20, 2026): results are cached for up to 7 days and a comment can be sent again after the cache is cleared or when a new judgment is needed; usage and cost statistics stay on your device; your keys are used only to authenticate requests to TypeSafe and OpenRouter, and spam you marked is sent to TypeSafe as examples (as before). The website now has a Japanese translation of the policy.
- New store description.

## 0.29.5 — 2026-10-20

- YouTube captions: when ClearFlow retranslates poor auto-translated captions, each line now appears as soon as it's translated (the first within a second or two) instead of after the whole block of 40 lines, and after you jump to another point in the video it starts from the line on screen rather than from the start of that block.

## 0.29.4 — 2026-10-19

- Japanese: the YouTube caption settings and the notes behind the ✦ after captions were shown in Chinese; they're in Japanese now.

## 0.29.3 — 2026-10-19

- X: in ClearFlow's translations of posts and replies, hashtags now show the translated words but still link to the original hashtag, so clicking one finds the post (it used to search for the translated words). If the translation's hashtags can't be matched to the original's, they're shown as plain text instead of links.

## 0.29.2 — 2026-10-19

- YouTube captions: if the video also has its own Simplified Chinese captions, Traditional Chinese captions you pick are shown as they are instead of being converted. (Auto-generated Simplified captions don't count.)

## 0.29.1 — 2026-10-19

- YouTube captions: when you drag through the video, ClearFlow waits until you stop before retranslating, and translates only the part where you stopped (it used to translate every part you dragged past). Captions keep up with where you are.

## 0.29.0 — 2026-10-19

- YouTube captions. If you pick Traditional Chinese captions and YouTube's interface is in Simplified Chinese, they're shown in Simplified characters, with Taiwan and Hong Kong wording changed to mainland wording (done locally, using OpenCC's dictionaries). If you pick YouTube's auto-translated captions: when you want Simplified Chinese and the video has human Chinese captions, those are used instead; otherwise TypeSafe checks YouTube's translation and, if it's poor, ClearFlow retranslates the captions as you watch, a sentence-aware chunk at a time. A small ✦ after the captions lets you switch back to YouTube's. Both can be turned off under YouTube → Advanced in Settings.
- The privacy policy describes what caption text is sent and when.

## 0.28.14 — 2026-10-19

- YouTube Shorts: the "Cleared N replies like “nice” or “+1”" line appears once at the top of the comment panel instead of twice, and lines up with the comments instead of touching the panel edge.

## 0.28.13 — 2026-10-19

- CI: the browser tests pass on Linux and are no longer allowed to fail. No changes to the extension itself.

## 0.28.12 — 2026-10-19

- Your API keys moved out of the extension's general storage into its own database, which the scripts ClearFlow runs on websites can't read. Existing keys are moved automatically; nothing to do.
- CI: browser tests now run with the Chinese UI they check on Linux too.

## 0.28.11 — 2026-10-19

- A post author's own reply that continues their post — an update, more details, an answer, or a link to the very thing the post is about — is no longer cleaned as promotion. ClearFlow asks TypeSafe one extra question for the author's replies only; an author using their own post to advertise something unrelated is still cleaned, and abuse, sexual content and spam you marked are handled as before.

## 0.28.10 — 2026-10-19

- Comments that are only a code block are no longer sent for translation.
- An edited comment is translated again with its new text.
- Text that happens to contain things like "<t1>" or "<x3/>" is translated correctly (those characters used to disappear and the comment was translated twice).
- Translations for comments that are no longer on the page aren't sent (and paid for) anymore.
- After a key or credit problem stops translation, turning translation off in Settings now removes the translations already on the page; translation resumes on its own 10 minutes after an OpenRouter credit problem.
- Long Chinese and Japanese paragraphs are split at sentence ends instead of mid-sentence.
- Interface languages written in Cyrillic, Arabic or other scripts are recognized, so text in your own language isn't translated as foreign.
- Cleaning: a brief connection problem with the extension's background (for example right after Chrome restarts it) no longer stops replies on the page from being checked; "Not spam" on a group of repeated replies sticks even when the group changes; Reddit and RedNote image replies keep their cache across window sizes.

## 0.28.9 — 2026-10-19

- X: a reply that only embeds a quoted post is no longer translated as if the quoted text were its own, and ClearFlow no longer clicks "Show more" inside the quote card (which opened the quoted post).
- X: before translating an author's reply itself, ClearFlow waits a moment in case X adds its own "Show translation" button, which is free.
- X: an account whose display name starts with "@" and copies the post author's handle is no longer treated as the post author.
- X: whether a post asks for recommendations is judged on the original text, not on X's translation.
- X: after you close a "…" menu, "Clean this" no longer shows up in the next menu you open for a different post.
- X: on profile pages, judging no longer depends on whether the profile header had loaded, so revisits reuse cached results.
- X translation: posts with emoji are no longer retranslated after you expand them; your choice of which version to show is kept. After you change a key, posts that failed are retried; after OpenRouter runs out of credit, ClearFlow tries again 10 minutes later instead of waiting for a page reload.
- X: posts containing "&", "<" or ">" are no longer cut short at the end when read from page data.

## 0.28.8 — 2026-10-19

- Settings: the monthly cost estimate averages the last 7 days (or the days since you installed), instead of multiplying a single busy day by 30. Money spent on a retranslation is counted even if judging it fails afterwards.
- When TypeSafe is out of credit, the popup and Settings say so, and ClearFlow stops retrying. Error messages that used to appear untranslated are now translated.
- X translation: TypeSafe's verdict on X's translation is cached on its own, so a retry after an error doesn't pay for it again.
- A post seen both in a thread and on a profile or in search keeps its cached verdict in each place instead of being judged again each time you switch.
- Changing a threshold or similar setting no longer cancels checks that are already running (they were sent again and paid for twice).
- Settings: clicking Save with an empty key field no longer deletes your saved key; "Test" with an empty field tests the saved key. Resetting "Look at images in replies" to the default gives the image permission back when no site uses it. The popup no longer asks for a Jev key if you turned Jev off.
- Right after you change a key, a translation queued with the old key is no longer sent with it (which made a working key show as "not working").
- ClearFlow no longer sends its name and website to OpenRouter with each request.

## 0.28.7 — 2026-10-19

- X: replies that are still being judged aren't translated or retranslated until the verdict is in (at most 6 seconds), so you don't pay to translate a reply that is about to be cleaned.
- Very long comments (a single paragraph over 3,000 characters, which happens on YouTube) are translated in pieces; before, they were never translated. Line breaks in YouTube comments are kept in the translation.
- YouTube: when YouTube redraws a comment that ClearFlow had translated with YouTube's own button (changing the sort order, reopening the Shorts comments), ClearFlow presses the button again. If you switched back to the original yourself, it still leaves it alone.
- A long comment you are reading keeps using the standard translation tier for its remaining pieces (it was mistaken for off-screen once its first pieces were shown, and sent to flex).
- Several replies translated in one request: if the model repeats or misnumbers one of them, that reply is translated again on its own instead of keeping (and caching) the wrong text.
- "Look at images in replies": replies whose images can't be used are cached like other replies (if the image is gone or broken, or was over the 6-images-per-batch limit), so they aren't paid for again on every visit; only temporary download errors are retried. If the browser's image permission was revoked, images are treated as off.

## 0.28.6 — 2026-10-19

- X: replies containing a line that just says "Ad" / "广告" / "Promoted", or from an account named "Ad", are no longer mistaken for ads (they were skipped and couldn't be cleaned by hand).
- Language detection ignores @handles, English #hashtags and bare domains, so a Chinese reply that starts with "@SomeEnglishChannel" isn't translated as if it were English.
- YouTube: the channel owner's own comments are no longer flagged as "impersonating the channel owner" when the page data hasn't arrived yet.
- Invite-code rule: only clear invite/affiliate parameters (`aff`, `invite`, `inviter`) count everywhere; `ref`/`code` count only on links outside big sites, and `?i=` no longer counts — ordinary GitHub, Apple Music or Product Hunt links aren't cleaned anymore.
- Spam you marked that is longer than 300 characters is now recognized when it's posted again word for word, and by any link it contains.
- A comment packed with thousands of invisible characters can no longer freeze the page.

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
