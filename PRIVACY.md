# ClearFlow (清流) Privacy Policy

Effective date: October 26, 2026 · [中文版本见下方](#中文)

ClearFlow is a browser extension that cleans up comment sections and translates posts on X, Reddit, YouTube, Xiaohongshu (RedNote) and Hacker News. It is published by OhMyAI. This policy explains what the extension reads, what it sends and to whom, and what it keeps on your device.

**The short version:** ClearFlow sends the comments and posts you are looking at to OpenRouter, a service you choose and pay for, using an API key you enter yourself; OpenRouter passes them to TypeSafe's Jev model (to judge them) and to a translation model (to translate them). If you also add an optional TypeSafe key, judging requests go straight to TypeSafe instead. Used this way, it sends nothing to us, the developers. If you choose ClearFlow Membership instead (optional and paid, see the section on it below), the same content goes through our server, which keeps only what that section lists. It does not upload usage statistics or track browsing behavior, and it runs no remote code. Other stored data stays in your browser.

## Where it runs

The extension's scripts run only on these sites: `x.com`, `twitter.com`, `www.reddit.com`, `www.youtube.com`, `www.xiaohongshu.com`, `www.rednote.com` and `news.ycombinator.com`. It does not read your browsing history or any other website. On those sites it reads only your own username, locally, so it doesn't judge your own posts; it never sends it anywhere.

## What is sent, and to whom

### TypeSafe's Jev model — judging comments

Used for cleaning (spam, abuse, sexual content, and replies like "nice" or "+1"), and to judge the quality of X's own translations and YouTube's auto-translated captions. By default these requests go through OpenRouter (`openrouter.ai`) with your OpenRouter key, and OpenRouter passes them to TypeSafe. If you entered a TypeSafe key (optional, under Settings → Advanced), they go straight to TypeSafe (`api.typesafe.ai`) instead. Nothing is sent if you entered neither key.

- For each comment on the page that local rules can't decide: the comment text (up to 600 characters), the commenter's display name and handle, the text of the post it belongs to (up to 400 characters) and the post author's name and handle. Up to 10 comments per request.
- On profile and search pages on X and on list pages on Reddit, the posts in the list instead of comments, with a fixed one-line description in place of the post text.
- On X posts that X translated automatically: the original text and X's (Grok's) translation, to judge whether X's translation is good enough. ClearFlow's own retranslation is not sent.
- Only if you entered a TypeSafe key and turn on "Check images in replies" (off by default): images attached to those comments, downscaled, together with the text, sent straight to TypeSafe (OpenRouter doesn't pass images on, so no images are sent without a TypeSafe key). To do this the extension asks for permission to read images from `pbs.twimg.com`, `i.redd.it`, `preview.redd.it` and `*.xhscdn.com`; it gives the permission back when you turn the option off.
- Only if you have marked spam yourself on that site ("Hide this reply", or the funnel on a notice bar): your 10 most recently marked replies on that site (text up to 240 characters and the account), sent with those comments as examples, so TypeSafe can tell whether a comment is the same kind of spam. Right after you mark one, the comments on that page that weren't cleaned are checked once more against the examples (up to 25 per request).
- On YouTube, only when you choose YouTube's auto-translated captions and "Improve auto-translated captions" is on (and the video has no human Chinese captions to use instead): the first lines (up to 40) of the original captions and YouTube's translation of them, to judge how good YouTube's translation is.
- Results are cached locally for up to 7 days to reduce repeat requests for the same comment in the same context. A comment may be sent again if the cache is cleared or an entry is removed, or if a new judgment is needed.

### OpenRouter (`openrouter.ai`) — translating, and judging by default

Translation requests are only sent if you entered an OpenRouter key and translation is on for that site. Without a TypeSafe key, OpenRouter also carries the judging requests described above.

- The text of posts and comments that need translating (or a better translation than X's). Not the author, not the post ID, not anything else on the page.
- On YouTube, only when TypeSafe judged YouTube's auto-translated captions to be poor (above): the original captions of the part of the video you are watching, about 40 lines at a time, to retranslate them. Converting Traditional Chinese captions to Simplified happens on your computer and sends nothing.
- OpenRouter passes the text to the translation model you choose in Settings (by default an OpenAI model, with a DeepSeek model as fallback). Each of those providers has its own data policy.

### Nobody else

With your own key, ClearFlow sends nothing to OhMyAI or anyone other than the two services above (for ClearFlow Membership, see below). Usage and cost statistics stay on your device. There is no analytics reporting, crash reporting, advertising or tracking code. All code is in the extension package; nothing is downloaded and run later.

When you click "Test connection" in Settings, a short fixed sample text is sent to the service being tested.

## What is stored on your device

The following data is stored in your browser's extension storage (`chrome.storage.local` and IndexedDB). API keys authenticate requests to the respective services, and marked spam may be sent to TypeSafe as examples, as described above. Other stored data is not uploaded:

- Your settings and your API keys (OpenRouter's, and TypeSafe's if you added one). The keys are kept in the extension's own database in this browser, which the websites you visit (and the extension's scripts running on them) can't read; only the extension's background worker uses them. They aren't encrypted.
- Daily counters (how many items were cleaned or translated, estimated cost).
- Your corrections ("not spam", "hide this reply") and the spam you marked, with the comment text (up to 300 characters; the last 3,000 corrections, the last 500 marked replies).
- A cache of TypeSafe results (fingerprints and scores only, no text; deleted 7 days after the comment was judged) and a cache of translations (the translated text; deleted once it hasn't been used for 30 days). Each cache is capped at 50 MB by default; the oldest entries go first when it's full.

On X and YouTube, two small scripts (`pagedata.js`, `ytdata.js`) run inside the page and read the site's own API responses that the page already received — to get a post's original (untranslated) text and who wrote a comment. They only read; they never send requests or change what the site receives.

## Your choices

- Turn ClearFlow off for any site, or turn off cleaning or translation separately, in the popup or Settings.
- Settings → Data and privacy: export your data (settings, statistics, your corrections and the spam you marked), clear the caches, or clear statistics and records, including your corrections. The spam you marked is listed in Settings, where you can delete entries one by one or all at once.
- Uninstalling the extension deletes everything it stored.
- You can revoke or rotate your API keys with TypeSafe or OpenRouter at any time.

## ClearFlow Membership (optional, paid)

ClearFlow Membership is an alternative to using your own key: you sign in with your email, and ClearFlow's AI features run through our server. Our [Terms of Service](https://clearflow.ohmyai.app/en/terms/) cover the membership. If you use the membership, the following applies in addition to the rest of this policy.

### Where content goes

The extension sends the same content described under "What is sent, and to whom" to our server, `api.clearflow.ohmyai.app` (run on Cloudflare), instead of to OpenRouter directly. Our server passes it on to OpenRouter and TypeSafe in the same way and sends back the results. Images are not checked in membership mode.

### What our server keeps

- **Your account:** your email address, your time zone (so daily limits reset at your midnight) and when your free trial started.
- **Your devices:** a random ID the extension creates, the name of the device (browser and operating system), the extension version, and when the device signed in and was last seen.
- **Sign-in:** sign-in codes and tokens are stored only as hashes, and expired ones are deleted every day.
- **Usage:** for each day, how much of your allowance you used and how many requests you made. Kept for 13 months, for limits and billing questions.
- **Payments:** from Waffo, our payment processor and merchant of record: order and payment IDs, the plan, the amount and currency, dates and refund status. We never receive your card details. Waffo keeps your payment information under its own privacy policy.
- **A shared result cache:** so the same work isn't paid for twice, judgments are cached for 7 days and translations for 30 days, under a hash of the input. Judgments are stored as scores only; translations are stored as the translated text. Cache entries aren't linked to your account.
- **Request metrics:** for each request, which feature it was, your plan, its cost, cache hits and how long it took, with your account ID, to watch costs and errors. Kept for about 3 months.

Apart from the cache, our server does not store the comments, posts or captions it processes, and we don't use them to train models.

### Emails

Sign-in codes are sent with Cloudflare's email service. We don't send marketing emails.

### Deleting your account

You can delete your account on your account page. That deletes your email address, devices, sign-in sessions and usage records. We keep payment records without your email address, because they're needed for accounting and refunds, and the device ID that used a free trial, so the trial can't be used again.

### Service providers

Cloudflare (hosting, database and email), Waffo (payments), and OpenRouter, TypeSafe and the translation model providers (processing content).

## Children

ClearFlow is not directed at children and does not knowingly collect information from anyone.

## Changes

If this policy changes, the new version will be published at https://github.com/remember2015/clearflow/blob/main/PRIVACY.md with a new effective date, and noted in the changelog.

## Contact

developer@ohmyai.app

---

<a id="中文"></a>

# 清流（ClearFlow）隐私政策

生效日期：2026 年 10 月 26 日

清流是一个浏览器插件，在 X、Reddit、YouTube、小红书和 Hacker News 上清理评论区、翻译帖子，由 OhMyAI 发布。这份政策说明插件读什么、发什么给谁、在你的设备上存什么。

**一句话：** 清流用你自己填的密钥，把你正在看的评论和帖子发给你选的付费服务 OpenRouter，由它转给 TypeSafe 的 Jev 模型判断、转给翻译模型翻译；另外填了可选的 TypeSafe 密钥的话，判断请求直接发给 TypeSafe。这样用时，它不发任何东西给我们（开发者）。如果改用清流会员（可选、付费，见下面「清流会员」一节），同样的内容会经过我们的服务器，服务器只保存那一节列出的东西。插件不上传使用统计、不追踪浏览行为，也不运行远程代码。其他存储的数据留在你的浏览器里。

## 在哪里运行

插件的脚本只在这些网站上运行：`x.com`、`twitter.com`、`www.reddit.com`、`www.youtube.com`、`www.xiaohongshu.com`、`www.rednote.com`、`news.ycombinator.com`。不读你的浏览记录，也不读别的网站。在这些网站上只在本机认出你自己的账号名（不判你自己发的），不发给任何地方。

## 发什么、发给谁

### TypeSafe 的 Jev 模型——判断评论

用于清理（垃圾、辱骂、色情，以及「赞」「mark」这类回复），以及判断 X 自己的译文、YouTube 自动翻译的字幕好不好。默认用你的 OpenRouter 密钥经 OpenRouter（`openrouter.ai`）发，由它转给 TypeSafe；填了 TypeSafe 的密钥（可选，在设置的「高级」里）则直接发给 TypeSafe（`api.typesafe.ai`）。两个密钥都没填就不发。

- 页面上本地规则判不了的每条评论：评论正文（最多 600 字）、评论者的昵称和账号、所在帖子的正文（最多 400 字）和帖子作者的昵称和账号。每次最多 10 条。
- X 的用户主页、搜索结果和 Reddit 的列表页上，发的是列表里的帖子，帖子正文那一栏换成一句固定的说明。
- X 自动翻译过的帖子：原文和 X（Grok）的译文，用来判断 X 翻得好不好。清流自己重译的译文不发。
- 只有填了 TypeSafe 的密钥、又打开「检查回复中的图片」（默认关）时：评论里的图片（缩小后）连同文字直接发给 TypeSafe（OpenRouter 不转发图片，没填 TypeSafe 密钥时不发图片）。为此插件会请求读取 `pbs.twimg.com`、`i.redd.it`、`preview.redd.it`、`*.xhscdn.com` 上图片的权限，关掉这一项时把权限还回去。
- 只有你在这个网站上自己标记过垃圾（「清理掉这条」，或提示条上的漏斗）时：你在这个网站上最近标记的 10 条（正文最多 240 字和账号），跟着这些评论一起发过去当样例，让 TypeSafe 判断一条评论是不是同一类垃圾。你刚标了一条时，这一页上没被清理的评论再按样例问一遍（每次最多 25 条）。
- 只有在 YouTube 上选了「自动翻译」的字幕、又开着「改善自动翻译的字幕」（而且视频没有可以拿来代替的人工中文字幕）时：原文字幕的前面几行（最多 40 行）和 YouTube 对它们的翻译，用来判断 YouTube 翻得好不好。
- 判定结果在本机最多缓存 7 天，减少同一条评论在相同上下文中的重复请求。缓存清空、条目被移除或需要重新判断时，可能再次发送。

### OpenRouter（`openrouter.ai`）——翻译，默认也负责判断

翻译请求只有填了 OpenRouter 的密钥、并且这个网站开着翻译才发。没填 TypeSafe 密钥时，上面那些判断请求也经 OpenRouter 发。

- 要翻译（或者比 X 的译文翻得更好）的帖子和评论的正文。不发作者、帖子 id 和页面上别的东西。
- 只有 TypeSafe 判下来 YouTube 自动翻译的字幕不好时（见上）：你正在看的那一段的原文字幕，一次大约 40 行，用来重新翻译。繁体中文字幕转简体在你的电脑上完成，什么都不发。
- OpenRouter 把文字转给你在设置里选的翻译模型（默认 OpenAI 的模型，后备 DeepSeek 的模型），这些提供方各有自己的数据政策。

### 不发给别人

用自己的密钥时，清流除了上面两个服务，不发任何东西给 OhMyAI 或其他任何人（清流会员见下文）。使用次数和费用统计只保存在本机，没有统计上报、崩溃上报、广告或追踪代码。所有代码都在插件包里，不会事后下载代码来运行。

在设置里点「测试连接」时，会把一小段固定的示例文字发给被测试的那个服务。

## 在你的设备上存什么

下面这些保存在浏览器的插件存储里（`chrome.storage.local` 和 IndexedDB）。API 密钥用于向对应服务验证请求，标记的垃圾回复可能按上文说明发给 TypeSafe 作为样例；其他存储的数据不上传：

- 你的设置和密钥（OpenRouter 的；填了的话还有 TypeSafe 的）。密钥存在这个浏览器里插件自己的数据库里，你打开的网站（以及插件在网站上运行的脚本）读不到，只有插件的后台用它；没有加密。
- 每天的计数（清理、翻译了多少条，估算的花费）。
- 你的纠错（「不是垃圾」「清理掉这条」）和你标记的垃圾，带那条评论的正文（最多 300 字；最近 3000 条纠错、最近 500 条标记）。
- TypeSafe 结果的缓存（只有指纹和分数、没有正文，判完 7 天后删）和译文的缓存（译好的文字，30 天没用到就删）。每份缓存默认最多 50 MB，满了先删最旧的。

在 X 和 YouTube 上，有两个小脚本（`pagedata.js`、`ytdata.js`）在页面里读这个网站自己的接口返回（页面本来就收到了的），用来拿帖子的原文（没被翻译的）和评论是谁写的。它们只读，不发请求，也不改网站收到的东西。

## 你能做什么

- 在弹窗或设置里，对任何网站关掉清流，或者单独关掉清理、翻译。
- 设置 → 数据和隐私：导出你的数据（设置、统计、你的纠错和标记的垃圾）、清空缓存、清空统计和记录（连你的纠错一起）。你标记的垃圾在设置里有一份列表，可以一条条删，也可以全部删掉。
- 卸载插件会删掉它存的所有东西。
- 你随时可以在 TypeSafe、OpenRouter 那边作废或更换密钥。

## 清流会员（可选、付费）

清流会员是自带密钥之外的另一种用法：用邮箱登录，清流的 AI 功能经我们的服务器提供。会员服务适用我们的[服务条款](https://clearflow.ohmyai.app/zh/terms/)。使用会员时，除了这份政策的其他部分，还适用下面这些。

### 内容发到哪里

插件把「发什么、发给谁」里说的同样内容发给我们的服务器 `api.clearflow.ohmyai.app`（运行在 Cloudflare 上），而不是直接发给 OpenRouter。服务器照样转给 OpenRouter 和 TypeSafe，再把结果传回来。会员模式下不检查回复里的图片。

### 服务器保存什么

- **账号**：邮箱、时区（每天的额度按你那里的 0 点换日）、免费试用的开始时间。
- **设备**：插件生成的随机 ID、设备名称（浏览器和操作系统）、插件版本、登录和最近使用的时间。
- **登录**：验证码和令牌只存哈希，过期的每天删除。
- **用量**：每天用了多少额度、发了多少次请求。保存 13 个月，用于额度和账单问题。
- **付款**：来自付款处理方和名义卖方 Waffo 的订单号、付款号、套餐、金额和币种、日期、退款状态。我们拿不到你的卡号等支付信息，Waffo 按它自己的隐私政策保存你的付款信息。
- **共用的结果缓存**：为了同样的活不花两次钱，判断结果缓存 7 天、译文缓存 30 天，用输入内容的哈希作为索引。判断只存分数，译文存译好的文字。缓存不和你的账号关联。
- **请求统计**：每次请求是哪个功能、你的套餐、花费、缓存命中和耗时，带你的账号 ID，用来盯成本和错误。保存约 3 个月。

除了上面的缓存，服务器不保存它处理的评论、帖子和字幕，我们也不用它们训练模型。

### 邮件

登录验证码用 Cloudflare 的邮件服务发送。我们不发营销邮件。

### 删除账号

在账号页可以删除账号。删除时会删掉你的邮箱、设备、登录状态和用量记录。付款记录会去掉邮箱后保留，因为记账和退款要用；用过免费试用的设备 ID 也会保留，防止重复试用。

### 服务商

Cloudflare（托管、数据库、邮件）、Waffo（收款），以及 OpenRouter、TypeSafe 和翻译模型的提供方（处理内容）。

## 儿童

清流不面向儿童，也不会有意收集任何人的信息。

## 变更

这份政策有变化时，新版本会发在 https://github.com/remember2015/clearflow/blob/main/PRIVACY.md ，写明新的生效日期，并记在更新日志里。

## 联系

developer@ohmyai.app
