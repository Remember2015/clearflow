# ClearFlow (清流) Privacy Policy

Effective date: October 19, 2026 · [中文版本见下方](#中文)

ClearFlow is a browser extension that cleans up comment sections and translates posts on X, Reddit, YouTube, Xiaohongshu (RedNote) and Hacker News. It is published by OhMyAI. This policy explains what the extension reads, what it sends and to whom, and what it keeps on your device.

**The short version:** ClearFlow sends the comments and posts you are looking at to two services you choose and pay for — TypeSafe (to judge them) and OpenRouter (to translate them) — using API keys you enter yourself. It sends nothing to us, the developers. It has no analytics, no tracking and no remote code. Everything else stays in your browser.

## Where it runs

The extension's scripts run only on these sites: `x.com`, `twitter.com`, `www.reddit.com`, `www.youtube.com`, `www.xiaohongshu.com`, `www.rednote.com` and `news.ycombinator.com`. It does not read your browsing history or any other website. On those sites it reads only your own username, locally, so it doesn't judge your own posts; it never sends it anywhere.

## What is sent, and to whom

### TypeSafe (`api.typesafe.ai`) — judging comments

Used for cleaning (spam, abuse, sexual content, and replies like "nice" or "+1"), and on X to judge the quality of X's own translations. Only sent if you entered a TypeSafe (Jev) key.

- For each comment on the page that local rules can't decide: the comment text (up to 600 characters), the commenter's display name and handle, the text of the post it belongs to (up to 400 characters) and the post author's name and handle. Up to 10 comments per request.
- On profile and search pages on X and on list pages on Reddit, the posts in the list instead of comments, with a fixed one-line description in place of the post text.
- On X posts that X translated automatically: the original text and X's (Grok's) translation. When ClearFlow retranslates such a post (below), its own translation too, so the two can be compared.
- Only if you turn on "Look at images in replies" (off by default): images attached to those comments, downscaled, together with the text. To do this the extension asks for permission to read images from `pbs.twimg.com`, `i.redd.it`, `preview.redd.it` and `*.xhscdn.com`; it gives the permission back when you turn the option off.
- Only if you have marked spam yourself on that site ("Hide this reply", or the funnel on a notice bar): your 10 most recently marked replies on that site (text up to 240 characters and the account), sent with those comments as examples, so TypeSafe can tell whether a comment is the same kind of spam. Right after you mark one, the comments on that page that weren't cleaned are checked once more against the examples (up to 25 per request).
- The same comment in the same context is not sent again for 7 days (results are cached locally).

### OpenRouter (`openrouter.ai`) — translating

Only sent if you entered an OpenRouter key and translation is on for that site.

- The text of posts and comments that need translating (or a better translation than X's). Not the author, not the post ID, not anything else on the page.
- OpenRouter passes the text to the translation model you choose in Settings (by default an OpenAI model, with a DeepSeek model as fallback). Each of those providers has its own data policy.

### Nobody else

ClearFlow sends nothing to OhMyAI or anyone other than the two services above. There is no analytics, crash reporting, advertising or tracking code. All code is in the extension package; nothing is downloaded and run later.

When you click "Test connection" in Settings, a short fixed sample text is sent to the service being tested.

## What is stored on your device

All of the following is stored only in your browser's extension storage (`chrome.storage.local` and IndexedDB) and is never uploaded:

- Your settings and your two API keys. The keys are kept in the extension's own database in this browser, which the websites you visit (and the extension's scripts running on them) can't read; only the extension's background worker uses them. They aren't encrypted.
- Daily counters (how many items were cleaned or translated, estimated cost).
- Your corrections ("not spam", "hide this reply") and the spam you marked, with the comment text (up to 300 characters; the last 3,000 corrections, the last 500 marked replies).
- A cache of TypeSafe results (fingerprints and scores only, no text; deleted 7 days after the comment was judged) and a cache of translations (the translated text; deleted once it hasn't been used for 30 days). Each cache is capped at 50 MB by default; the oldest entries go first when it's full.

On X and YouTube, two small scripts (`pagedata.js`, `ytdata.js`) run inside the page and read the site's own API responses that the page already received — to get a post's original (untranslated) text and who wrote a comment. They only read; they never send requests or change what the site receives.

## Your choices

- Turn ClearFlow off for any site, or turn off cleaning or translation separately, in the popup or Settings.
- Settings → Data and privacy: export your data (settings, statistics, your corrections and the spam you marked), clear the caches, or clear statistics and records, including your corrections. The spam you marked is listed in Settings, where you can delete entries one by one or all at once.
- Uninstalling the extension deletes everything it stored.
- You can revoke or rotate your API keys with TypeSafe or OpenRouter at any time.

## Children

ClearFlow is not directed at children and does not knowingly collect information from anyone.

## Changes

If this policy changes, the new version will be published at https://github.com/remember2015/clearflow/blob/main/PRIVACY.md with a new effective date, and noted in the changelog.

## Contact

developer@ohmyai.app

---

<a id="中文"></a>

# 清流（ClearFlow）隐私政策

生效日期：2026 年 10 月 19 日

清流是一个浏览器插件，在 X、Reddit、YouTube、小红书和 Hacker News 上清理评论区、翻译帖子，由 OhMyAI 发布。这份政策说明插件读什么、发什么给谁、在你的设备上存什么。

**一句话：** 清流用你自己填的 key，把你正在看的评论和帖子发给你选的两个付费服务——TypeSafe（判断）和 OpenRouter（翻译）。它不发任何东西给我们（开发者），没有统计、没有追踪、没有远程代码。别的都留在你的浏览器里。

## 在哪里运行

插件的脚本只在这些网站上运行：`x.com`、`twitter.com`、`www.reddit.com`、`www.youtube.com`、`www.xiaohongshu.com`、`www.rednote.com`、`news.ycombinator.com`。不读你的浏览记录，也不读别的网站。在这些网站上只在本机认出你自己的账号名（不判你自己发的），不发给任何地方。

## 发什么、发给谁

### TypeSafe（`api.typesafe.ai`）——判断评论

用于清理（垃圾、辱骂、色情，以及「赞」「mark」这类回复），以及在 X 上判断 X 自己的译文好不好。只有填了 TypeSafe（Jev）的 key 才发。

- 页面上本地规则判不了的每条评论：评论正文（最多 600 字）、评论者的昵称和账号、所在帖子的正文（最多 400 字）和帖子作者的昵称和账号。每次最多 10 条。
- X 的用户主页、搜索结果和 Reddit 的列表页上，发的是列表里的帖子，帖子正文那一栏换成一句固定的说明。
- X 自动翻译过的帖子：原文和 X（Grok）的译文。清流重译了这条时（见下），它自己的译文也发过去，好和 Grok 的比。
- 只有打开「看回复里的图片」（默认关）时：评论里的图片（缩小后）连同文字一起发。为此插件会请求读取 `pbs.twimg.com`、`i.redd.it`、`preview.redd.it`、`*.xhscdn.com` 上图片的权限，关掉这一项时把权限还回去。
- 只有你在这个网站上自己标记过垃圾（「清理掉这条」，或提示条上的漏斗）时：你在这个网站上最近标记的 10 条（正文最多 240 字和账号），跟着这些评论一起发过去当样例，让 TypeSafe 判断一条评论是不是同一类垃圾。你刚标了一条时，这一页上没被清理的评论再按样例问一遍（每次最多 25 条）。
- 同一条评论在同样的上下文里 7 天内不再发（结果缓存在本机）。

### OpenRouter（`openrouter.ai`）——翻译

只有填了 OpenRouter 的 key、并且这个网站开着翻译才发。

- 要翻译（或者比 X 的译文翻得更好）的帖子和评论的正文。不发作者、帖子 id 和页面上别的东西。
- OpenRouter 把文字转给你在设置里选的翻译模型（默认 OpenAI 的模型，后备 DeepSeek 的模型），这些提供方各有自己的数据政策。

### 不发给别人

清流除了上面两个服务，不发任何东西给 OhMyAI 或其他任何人。没有统计、崩溃上报、广告或追踪代码。所有代码都在插件包里，不会事后下载代码来运行。

在设置里点「测试连接」时，会把一小段固定的示例文字发给被测试的那个服务。

## 在你的设备上存什么

下面这些只存在你浏览器的插件存储里（`chrome.storage.local` 和 IndexedDB），从不上传：

- 你的设置和两个 key。key 存在这个浏览器里插件自己的数据库里，你打开的网站（以及插件在网站上运行的脚本）读不到，只有插件的后台用它；没有加密。
- 每天的计数（清理、翻译了多少条，估算的花费）。
- 你的纠错（「不是垃圾」「清理掉这条」）和你标记的垃圾，带那条评论的正文（最多 300 字；最近 3000 条纠错、最近 500 条标记）。
- TypeSafe 结果的缓存（只有指纹和分数、没有正文，判完 7 天后删）和译文的缓存（译好的文字，30 天没用到就删）。每份缓存默认最多 50 MB，满了先删最旧的。

在 X 和 YouTube 上，有两个小脚本（`pagedata.js`、`ytdata.js`）在页面里读这个网站自己的接口返回（页面本来就收到了的），用来拿帖子的原文（没被翻译的）和评论是谁写的。它们只读，不发请求，也不改网站收到的东西。

## 你能做什么

- 在弹窗或设置里，对任何网站关掉清流，或者单独关掉清理、翻译。
- 设置 → 数据和隐私：导出你的数据（设置、统计、你的纠错和标记的垃圾）、清空缓存、清空统计和记录（连你的纠错一起）。你标记的垃圾在设置里有一份列表，可以一条条删，也可以全部删掉。
- 卸载插件会删掉它存的所有东西。
- 你随时可以在 TypeSafe、OpenRouter 那边作废或更换 key。

## 儿童

清流不面向儿童，也不会有意收集任何人的信息。

## 变更

这份政策有变化时，新版本会发在 https://github.com/remember2015/clearflow/blob/main/PRIVACY.md ，写明新的生效日期，并记在更新日志里。

## 联系

developer@ohmyai.app
