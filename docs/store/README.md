# Store listings: Chrome Web Store and Edge Add-ons

Everything needed to fill in the Chrome Web Store dashboard and Microsoft Partner Center (Edge Add-ons) for ClearFlow. Both take the same package: `dist/clearflow-<version>.zip` from `npm run pack`. The name and short description come from `extension/_locales/*/messages.json` (19 languages in 21 folders: `es_419` and `pt_PT` repeat `es` and `pt_BR`).

- **Name:** ClearFlow (shown as 清流 in Simplified and Traditional Chinese, from `_locales/zh_CN` and `zh_TW`)
- **Category:** Chrome: Lifestyle → Social Networking. Edge: Social.
- **Homepage URL:** https://clearflow.ohmyai.app (the website, `site/`). **Support URL:** https://github.com/remember2015/clearflow/issues
- **Privacy policy URL:** https://clearflow.ohmyai.app/en/privacy/ (the same text as `PRIVACY.md`, in seven languages)
- **Contact:** developer@ohmyai.app
- **Detailed descriptions:** one plain-text file per language in `descriptions/` (paste as is; the dashboards keep line breaks and the "•" bullets). `en`, `zh-CN`, `zh-TW`, `ja` and `ko` are written by hand; the other 14 are translated from `en.txt` by `python3 scripts/store-desc.py` (checked for length, bullets, names and the URL). After changing `en.txt`, update the four hand-written ones by hand and re-run the script with `--force`.
- **Assets** (`assets/`): the 128×128 icon is `extension/icons/icon-128.png`; `logo-300.png` is the 300×300 store logo Edge asks for. The small promo tile is `promo-440x280.jpg`, one for every language. Screenshots: five 1280×800 per listing language in `assets/<locale>/` (JPEG, no alpha) — `en` is the default, `zh-CN`, `zh-TW`, `ja`, `ko` are localized; other languages use the English ones.
  - Why these languages: English and Japanese are X's two largest audiences, and Chinese, Japanese and Korean readers get the most out of translation. Spanish, Portuguese, Indonesian, German and Turkish (the biggest YouTube and X audiences after those) are the next candidates.
  - Each set: ① X — cleaning in that language: reasons, three accounts posting the same line merged into one, "nice"/"+1" replies tucked away, an @-mention of an outside account, abuse; ② Reddit — a Hokkaido trip post (Japanese, or English in the ja/ko sets) with German, Spanish, French, Portuguese and Chinese/Korean/Japanese comments translated; ③ YouTube — a Korean cooking video: a scam thread cleaned, Portuguese, Hindi, Spanish (Arabic in en) and Japanese (English in ja) comments translated; ④ marking one spam reply on Reddit (in the listing language): two reworded replies from other accounts pushing the same "trading mentor" are cleaned as "same kind as spam you marked", with the undo notice and the funnel on another comment; ⑤ the popup and Reddit's settings page.
  - Rendered by `node scripts/store-assets.mjs [outdir] [--locales ja,ko]`: the real extension running on simplified stand-ins of each site (`scripts/showcase.mjs`; every post, name and comment is invented) with stand-in scores and translations, so no keys are needed. Re-run it when the UI changes. Site logos appear only where the UI itself shows them; never in captions or the promo tile.

## Chrome Web Store, step by step

1. **Account** (once): register at the [developer dashboard](https://chrome.google.com/webstore/devconsole) with the Google account that will own the listing — the email can't be changed later. Pay the one-time registration fee, set the publisher name, verify the contact email, and turn on [2-Step Verification](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification) (required before publishing). Declare [trader or non-trader](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq) status (EU Digital Services Act; a free personal project with no payments is usually non-trader, but the choice is yours).
2. **New item** → upload the zip.
3. **Store listing:** description from `descriptions/en.txt`, category, icon, promo tile, screenshots from `assets/en/`; then add the other languages (descriptions and the four localized screenshot sets).
4. **Privacy:** single purpose, permission justifications, remote code "No", data usage and the three certifications, privacy policy URL — all below.
5. **Distribution:** public, all regions.
6. **Test instructions:** the text below, with two reviewer keys (see *Keys for reviewers*).
7. Submit for review.

## Edge Add-ons, step by step

1. **Account** (once, no fee): sign in to [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/public/login) with a Microsoft account (or a GitHub account, which creates one) and fill in the Edge developer registration: country/region (can't be changed later), account type **Individual** (shorter verification; Company needs business documents and can take weeks), publisher display name (50 characters at most, must be a name you have the right to use), contact info, accept the developer agreement. Wait for the verification email.
2. **Create new extension** → upload the zip.
3. **Availability:** Public, all markets.
4. **Properties:** category Social, website and support contact as above, mature content unchecked.
5. **Privacy:** same answers as Chrome (below).
6. **Store listings:** the package's 21 locales each get a row, and every row needs a **description** (250–10,000 characters) and a **logo**. Upload `logo-300.png` once and use *Duplicate this logo for all languages*. Paste `descriptions/<lang>.txt` into each row (`es-419` → `es.txt`, `pt-PT` → `pt.txt`). Optional per row: the promo tile (duplicate it too), up to 6 screenshots (upload the localized set for zh-CN, zh-TW, ja, ko and duplicate `en` to the rest), search terms (below).
7. **Publish** → *Notes for certification*: the test instructions below, with the reviewer keys. Certification takes up to seven business days.

**Edge search terms** (at most 7 terms, 30 characters each, 21 words in total; not shown to users):

- English: `comment filter`, `spam filter`, `hide spam replies`, `translate comments`, `twitter replies`, `reddit comments`, `youtube comments`
- 简体中文: `评论过滤`, `垃圾评论`, `屏蔽广告回复`, `评论翻译`, `推特评论`, `小红书评论`, `油管评论`

## Single purpose

Make comment sections on supported social sites readable: hide junk and content-free replies (with the reason shown) and translate foreign-language posts and comments in place. Both features act on the same page content, are switched per site, and serve the same goal of reading a site's discussion.

## Permission justifications

| Permission | Why |
|---|---|
| `storage` | Settings, whether each of the user's API keys is set (the keys themselves are kept in the extension's own IndexedDB, out of reach of content scripts), daily counters, the user's corrections and the spam they marked. With ClearFlow Membership also the account's state shown in the settings (email, plan, end date, usage as a share of the allowance); the sign-in token is kept in the same IndexedDB as the keys. Everything stays in the browser. |
| `unlimitedStorage` | Local caches of judging results and translations (50 MB each by default, adjustable), so the same content isn't sent or paid for twice. |
| Host permission `https://api.typesafe.ai/*` | Only if the user adds the optional TypeSafe key: the background worker sends comments to TypeSafe's classifier with that key (otherwise judging goes through OpenRouter). |
| Host permission `https://openrouter.ai/*` | The background worker sends comments to be judged (OpenRouter passes them to TypeSafe's classifier) and text to be translated to OpenRouter with the user's own key. |
| Content scripts on `x.com`, `twitter.com`, `www.reddit.com`, `www.youtube.com`, `www.xiaohongshu.com`, `www.rednote.com`, `news.ycombinator.com` | Read comments and posts on these sites, hide junk replies, insert translations. Two small scripts run in the page context on X and YouTube to read the site's own API responses (original text, authors); they don't send anything. |
| Optional host permissions `pbs.twimg.com`, `i.redd.it`, `preview.redd.it`, `*.xhscdn.com` | Requested only when the user turns on "Look at images in replies": the extension downloads and downscales images attached to replies to send them with the text to TypeSafe. Released again when the option is turned off. `xhscdn.com` serves some comment images over http, hence `*://`. |
| `externally_connectable` (not a permission) | Lets only https://clearflow.ohmyai.app send messages to the extension, so someone signed in to the extension isn't asked to sign in again on the website, and the website's sign-in confirmation page can check that the code it shows was started by this extension. No other site can reach it. |
| ClearFlow's API (`api.clearflow.ohmyai.app`) | No host permission: the background worker calls it with CORS, only when the user chose ClearFlow Membership. |
| Remote code | None. All code is in the package. |

## Privacy practices (Chrome: data usage tab; Edge: Privacy → Data usage)

Declare:

- **Website content** — text and (optionally) images of comments and posts on the supported sites, including commenters' public display names and handles. With the user's own key: sent to OpenRouter (and through it to TypeSafe), or straight to TypeSafe if the user added a TypeSafe key. With ClearFlow Membership: sent to ClearFlow's server, which passes it on the same way and keeps only a cache of results (scores, and translated text). Only to provide the extension's single purpose.
- **Authentication information** — the API keys the user enters, sent only to the service each key belongs to; with ClearFlow Membership, the extension's own sign-in tokens, sent only to ClearFlow's server.
- **Personally identifiable information** — with ClearFlow Membership only: the email address used to sign in (on the website), to send sign-in codes and identify the account. Payments are handled on Waffo's checkout page; the extension never sees card details.

Certify: data is not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used to determine creditworthiness or for lending.

## Notes for the review team (Chrome: "Test instructions"; Edge: "Notes for certification")

The quickest way to review everything: on the setup page that opens after installation (or Settings → Run first-time setup again), choose **ClearFlow Membership** and click Sign in. A page on clearflow.ohmyai.app opens; sign in with any email address you can receive mail at (a 6-digit code is sent), confirm, and the extension is signed in with a free 7-day trial. No payment or API key is needed. Then open a post on x.com, reddit.com or youtube.com with many replies; foreign-language posts and comments are translated in place. Without signing in or a key, the extension still runs its local rules. Alternatively, choose "Your own key" and enter the OpenRouter key provided in this field.

### Keys for reviewers

Don't give reviewers your everyday keys. Create a separate OpenRouter key with a small credit limit (OpenRouter lets you cap each key), paste it into the notes field yourself, and revoke it once the review is through. Each new version goes through review again, so keep one ready for updates.
