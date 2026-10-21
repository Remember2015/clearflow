// Website copy, one object per language. Strings may contain HTML (written here, never from users).
// Keep every claim true for the version on the Chrome Web Store, and keep the wording in line with the store descriptions
// (public/docs/store/descriptions/) and README. The cost figure is the developer's own usage, measured 2026-10-12 (extension/README.md).

export const STORE = "https://chromewebstore.google.com/detail/clearflow/dfojglbldlneaogknbphkiifmaagjjle";
export const REPO = "https://github.com/remember2015/clearflow";
export const MAIL = "developer@ohmyai.app";

export const LANGS = {
  zh: { html: "zh-CN", assets: "zh-CN", name: "中文", og: "zh_CN" },
  en: { html: "en", assets: "en", name: "English", og: "en_US" },
  ja: { html: "ja", assets: "ja", name: "日本語", og: "ja_JP" },
};

export const COPY = {
  zh: {
    brand: "清流",
    title: "清流 · 清理垃圾评论，原地翻译外文",
    description: "清流是开源的 Chrome 扩展，自动清理 X、YouTube、Reddit、小红书和 Hacker News 的垃圾评论，原地翻译外文帖子和评论。每条清理都有原因，可随时查看原文。使用你自己的 API 密钥，不向开发者发送数据。",
    nav: {"clean": "清理", "tx": "翻译", "cost": "费用", "privacy": "隐私", "faq": "常见问题"},
    skip: "跳到正文",
    hero: {
      eyebrow: "开源 Chrome 扩展",
      h1: "让评论区，更好读",
      h1Parts: ["让评论区，", "更好读"],
      lede: "自动清理垃圾评论，原地翻译外文帖子和评论，让阅读少些干扰。",
      trust: ["开源 · MIT", "不向开发者发送数据", "19 种界面语言", "按量付费，无需订阅"],
      cta: "添加到 Chrome",
      ctaNote: "免费安装",
    },
    platforms: {"label": "支持平台", "names": {"x": "X", "yt": "YouTube", "reddit": "Reddit", "xhs": "小红书", "hn": "Hacker News"}},
    demo: {"enlarge": "查看大图", "label": "使用清流前后对比", "before": "使用前", "after": "使用后", "tabs": {"xnews": "X", "xsex": "X · 垃圾回复", "x": "X", "xhs": "小红书", "reddit": "Reddit", "yt": "YouTube", "hn": "Hacker News", "mark": "Reddit", "xhsmark": "小红书"},"sum": {"clean": "清理 {n} 条", "filler": "收起 {n} 条", "tx": "翻译 {n} 段"}, "note": "演示使用模拟页面和评论，清理与翻译均由清流实际完成。"},
    eyebrow: {"clean":"清理","learn":"手动标记","tx":"翻译","how":"工作原理","cost":"费用","privacy":"隐私","faq":"常见问题"},
    clean: {"h2": "垃圾评论，自动清理", "lede": "过滤刷屏、推广、骗局、辱骂和色情回复，让有用的讨论更容易找到。", "points": [["原因清楚，原文可查", "每条清理都显示原因。点击即可查看原文，也能反馈误判。"],["简短附和，集中收起", "“赞”“+1”等缺乏实质内容的回复，收在评论区顶部的一行提示中。"],["重复提示，合并显示", "连续清理的回复合并为一条提示。垃圾回复过多时，在顶部统一显示数量。"]], "scenes": ["x", "yt", "reddit", "xhs"],"captions": {"xnews": "识别重复推广、色情回复和无实质内容的短评。", "xsex": "清理数码帖下的色情推广和空投广告。", "x": "重复推广合并显示，辱骂和短评分别处理。", "xhs": "清理引流评论，将“码住”“蹲”等短评集中收起。", "yt": "清理骗局推广，收起纯表情回复。", "reddit": "清理无关广告，收起“nice”等简短附和。"}},
    learn: {"h2": "手动标记，帮助识别同类垃圾", "lede": "遇到漏掉的垃圾评论，可以手动清理。你的标记会作为识别样例，帮助清流判断类似回复。", "steps": [["标记漏掉的垃圾", "X：在评论的“…”菜单中选“清理掉这条”。其他网站：将鼠标移到评论上，点击作者行末的漏斗图标。"],["为后续识别提供参考", "识别出的同类垃圾会被清理，并注明与手动标记的内容相似。"],["随时撤销标记", "标记后可立即撤销，也能在设置中删除已有标记。"]],"before": "标记前", "after": "标记后的效果", "scenes": ["mark", "xhsmark"],"captions": {"mark": "示例：标记一条推广评论后，另外两条相似话术也被识别。", "xhsmark": "示例：标记一条群聊推广后，另外两条类似评论也被识别。"}},
    tx: {"h2": "外文讨论，原地读懂", "lede": "帖子和评论直接翻成你的语言，保留链接与格式，随时切回原文。", "points": [["译文留在原处", "无需跳转页面，译文同时注明原文语言。"],["原文随时可查", "点击“看原文”，即可在原文和译文之间切换。"],["保留合适的 Grok 译文", "在 X 上，只有 Grok 译文翻得不好时，才换成清流的译文。"]], "scenes": ["reddit", "yt", "hn", "xhs"],"captions": {"reddit": "不同语言的骑行建议，统一翻成中文。", "yt": "来自不同国家的烹饪评论，直接用中文阅读。", "hn": "英文技术讨论翻成中文，保留代码和链接。", "xhs": "英文、韩文评论直接翻成中文。"}},
    control: {
      points: [
        "按网站设置",
        "清理与翻译独立开关",
        "三档清理强度",
        "查看处理数量",
      ],
      h2: "按网站设置，按需调整",
      body: "为每个网站分别设置清理规则、强度和翻译开关。点击工具栏图标，可查看当前页、今天和最近 7 天的处理数量。",
      altPopup: "清流弹窗：当前页清理和翻译的条数",
      altSettings: "清流设置页：Reddit 的清理规则和翻译",
    },
    how: {
      h2: "清流如何工作",
      steps: [
        ["先用本地规则", "识别推广链接、隐藏的联系方式、重复话术等结构特征，无需密钥，也不产生费用。"],
        ["AI 结合上下文判断", "本地规则无法判断的回复，会连同原帖发送给 TypeSafe 的 Jev 模型。模型识别推广、辱骂和色情内容，达到所设阈值后才清理。"],
        ["通过 OpenRouter 翻译", "需要翻译的文字会发送给所选模型，默认使用 OpenAI，DeepSeek 备用。仅发送文字，不附带作者和帖子 ID。"],
      ],
    },
    cost: {
      h2: "按量付费，无需订阅",
      body: "使用你自己的 TypeSafe 和 OpenRouter 账号，费用直接支付给对应服务。请求不经过清流的服务器。",
      stat: "$0.10",
      statLabel: "作者使用样本：2.4 天浏览 X 上约 5,000 条回复，清理与翻译共花费 $0.10，折合约 $1.30/月。实际费用取决于使用量。",
      points: [
        "设置页显示本月花费，并根据近 7 天用量估算月费。",
        "OpenRouter 密钥可设置每月用量上限。",
        "不填密钥，也能使用本地规则清理。",
      ],
      cta: "获取 API 密钥",
    },
    privacy: {
      h2: "不向开发者发送数据",
      items: [
        ["无追踪，无数据上报", "使用和费用统计仅保存在本机，不上传分析数据或崩溃报告，也不含广告代码。"],
        ["直接连接服务商", "启用 AI 功能后，相关帖子和评论使用你的密钥，直接发送至 TypeSafe 判断、OpenRouter 翻译。"],
        ["密钥和记录保存在本机", "密钥存于扩展专用数据库，网页无法读取。卸载扩展会删除本地数据。"],
        ["开源，可自行查验", "代码以 MIT 许可公开在 GitHub 上，可查看数据如何处理、向谁发送。"],
      ],
      more: "隐私政策全文",
    },
    faq: {
      h2: "常见问题",
      items: [
        ["为什么需要自己的 API 密钥？", "内容可以直接发送给对应服务，不经过清流的服务器，也无需向清流支付订阅费。初次使用需注册服务商账号并创建密钥。<a href=\"keys/\">API 密钥设置</a>"],
        ["不填密钥能用吗？", "可以。本地规则可清理推广链接、隐藏的联系方式和重复话术。识别辱骂、色情、无实质内容的短评，以及翻译功能，需要配置相应密钥。"],
        ["会误判正常评论吗？", "有可能。每条清理都有原因，点击可查看原文并反馈误判。清理强度针对各网站分别设置，也可以调为“宽松”。"],
        ["支持哪些网站和浏览器？", "X、Reddit、YouTube、小红书、Hacker News。Chrome 120 以上，以及 Edge、Arc、Brave 等 Chromium 浏览器。"],
        ["支持哪些语言？", "界面支持 19 种语言，包括中文。设置页和弹窗跟随浏览器语言；网页提示和翻译目标通常跟随网站界面语言。Hacker News 始终使用浏览器语言，其他网站无法识别界面语言时也使用浏览器语言。"],
        ["和 X、YouTube 这些平台有关系吗？", "没有。清流是独立的开源项目，与 X、Reddit、YouTube（Google）、小红书、Y Combinator 均无关联。"],
        ["发现问题怎么反馈？", `使用扩展设置页中的“反馈”，也可以在 <a href="${REPO}/issues">GitHub</a> 提交问题，或发送邮件至 <a href="mailto:${MAIL}">${MAIL}</a>。`],
      ],
    },
    final: {"h2": "让讨论更清楚，让阅读更轻松", "cta": "添加到 Chrome"},
    footer: { privacy: "隐私政策", keys: "API 密钥设置", license: "MIT 许可", disclaimer: "清流与 X、Reddit、YouTube、小红书、Y Combinator 均无关联。" },
    keys: {
      title: "获取 API 密钥 · 清流",
      description: "为清流配置 TypeSafe 和 OpenRouter 的 API 密钥，启用 AI 清理与翻译。",
      h1: "获取 API 密钥",
      lede: "AI 清理使用 TypeSafe，翻译使用 OpenRouter，两项服务各需一个 API 密钥，按用量直接向服务商付费。安装清流后，在引导页填入密钥；之后可在设置的“连接和费用”中修改。",
      sections: [
        { h2: "TypeSafe：AI 清理", tag: "清理", steps: [
          "打开 <a href=\"https://console.typesafe.ai/\">TypeSafe 控制台</a>，注册并登录。",
          "进入 <a href=\"https://console.typesafe.ai/keys\">Keys</a> 页面，创建并复制密钥。",
          "将密钥粘贴到清流设置的“Jev (TypeSafe)”栏。",
        ], note: "按 token 用量计费。判定结果最多缓存 7 天，减少重复请求。" },
        { h2: "OpenRouter：翻译", tag: "翻译", steps: [
          "打开 <a href=\"https://openrouter.ai/\">OpenRouter</a>，注册并登录，在 Credits 页面充值。",
          "进入 <a href=\"https://openrouter.ai/keys\">Keys</a> 页面，点击 Create Key。建议设置每月重置的额度上限，例如 $2。",
          "复制以 sk-or- 开头的密钥，粘贴到清流设置的“OpenRouter”栏。",
        ], note: "默认使用 OpenAI 模型翻译，DeepSeek 备用。可在设置中更换。" },
      ],
      after: [
        ["验证连接", "有效密钥会显示勾选标记；连接失败时会显示原因，可点击“测试连接”重试。"],
        ["按需配置", "只配置 TypeSafe，可用 AI 清理；只配置 OpenRouter，可用翻译。无论是否配置密钥，本地清理规则都可使用。"],
        ["保护密钥", "密钥仅保存在你的浏览器中，请勿分享给任何人，包括开发者。如怀疑泄露，请在对应服务的控制台删除旧密钥并重新创建。"],
      ],
      back: "返回首页",
    },
    privacyPage: { title: "隐私政策 · 清流", description: "了解清流读取、发送和本地保存哪些数据。", source: "隐私政策以 GitHub 上的原文为准：" },
    notFound: { title: "找不到这个页面", body: "链接可能写错了。", home: "回首页" },
  },

  en: {
    brand: "ClearFlow",
    title: "ClearFlow · Filter junk replies and translate in place",
    description: "An open-source Chrome extension that filters junk replies on X, YouTube, Reddit, RedNote and Hacker News, and translates posts and comments in place. Every hidden reply has an explanation. Uses your own API keys; no data is sent to the developer.",
    nav: {"clean": "Filtering", "tx": "Translation", "cost": "Cost", "privacy": "Privacy", "faq": "FAQ"},
    skip: "Skip to content",
    hero: {
      eyebrow: "Open-source Chrome extension",
      h1: "Comment sections, minus the junk",
      h1Parts: ["Comment sections,", "minus the junk"],
      trust: ["Open source · MIT", "No data sent to us", "19 interface languages", "Pay as you go"],
      lede: "Filter junk replies and translate posts and comments without leaving the page.",
      cta: "Add to Chrome",
      ctaNote: "Free to install",
    },
    platforms: {"label": "Works on", "names": {"x": "X", "yt": "YouTube", "reddit": "Reddit", "xhs": "RedNote", "hn": "Hacker News"}},
    demo: {"enlarge": "View full size", "label": "Before and after ClearFlow", "before": "Before", "after": "After", "tabs": {"x": "X", "xsex": "X · bots", "xhs": "RedNote", "reddit": "Reddit", "yt": "YouTube", "mark": "Reddit", "xhsmark": "RedNote"},"sum": {"clean": "{n} filtered", "filler": "{n} collapsed", "tx": "{n} translated"}, "note": "Demo pages and comments are fictional. Filtering and translation are performed by ClearFlow."},
    eyebrow: {"clean":"Filtering","learn":"Your feedback","tx":"Translation","how":"How it works","cost":"Cost","privacy":"Privacy","faq":"FAQ"},
    clean: {"h2": "Less junk. More room for discussion.", "lede": "Filter bot spam, unwanted promotions, scams, abuse and sexual content so useful replies are easier to find.", "points": [["A reason for every hidden reply", "See why a reply was hidden, open the original or report a mistake."],["Short reactions, neatly collapsed", "Replies like “nice” and “+1” are grouped behind one notice at the top."],["Fewer notices to scroll past", "Consecutive hidden replies share one notice. In heavily spammed threads, a single count appears at the top."]], "scenes": ["x", "yt", "reddit", "xhs"],"captions": {"x": "Repeated promotions are grouped together; abuse and short reactions are handled separately.", "xsex": "Sexual promotions and airdrop spam are filtered from a gadget discussion.", "xhs": "Promotional comments are hidden, with repeated messages grouped together.", "yt": "Fake testimonials are filtered out and emoji-only replies are collapsed.", "reddit": "An unrelated ad is filtered out; short reactions are collapsed."}},
    learn: {"h2": "Help catch the spam that gets through", "lede": "Flag a missed spam reply to hide it. ClearFlow uses your examples to help recognize similar spam.", "steps": [["Flag a missed reply", "On X, choose “Hide this reply” from the reply’s “…” menu. On other sites, hover over a reply and click the funnel icon beside the author."],["Help identify similar spam", "Replies identified as similar spam are hidden, with a note linking the decision to your feedback."],["Undo at any time", "Undo immediately after marking, or remove saved examples in Settings."]],"before": "Before marking", "after": "After your feedback", "scenes": ["mark", "xhsmark"],"captions": {"mark": "Example: flagging one promotional reply helps identify two others using similar wording.", "xhsmark": "Example: flagging one group invitation helps identify two similar promotions."}},
    tx: {"h2": "Read the discussion in your language", "lede": "Translate posts and comments in place, with links and formatting intact. Switch back to the original at any time.", "points": [["Stay on the page", "Translations appear where the original text was, with the source language shown."],["Keep the original within reach", "Use “Show original” to switch between the original and translated text."],["Keep good Grok translations", "On X, ClearFlow replaces a Grok translation only when it's poor."]], "scenes": ["reddit", "yt", "xhs"],"captions": {"reddit": "Cycling advice in several languages, translated into English.", "yt": "Cooking comments from around the world, translated into English.", "xhs": "Read a RedNote post and its comments in English."}},
    control: {
      points: [
        "Settings for each site",
        "Separate filtering and translation controls",
        "Three filtering levels",
        "Counts for this page",
      ],
      h2: "Your sites. Your settings.",
      body: "Choose filtering rules, sensitivity and translation settings for each site. The toolbar popup shows counts for this page, today and the past seven days.",
      altPopup: "ClearFlow popup: replies hidden and translated on the current page",
      altSettings: "ClearFlow settings: Reddit's filtering rules and translation",
    },
    how: {
      h2: "How ClearFlow works",
      steps: [
        ["Local rules first", "Detect referral links, hidden contact details and repeated messages by their structure. No API key or payment needed."],
        ["AI checks the context", "Replies that local rules cannot classify are sent with the original post to TypeSafe’s Jev model. It checks for promotions, abuse and sexual content, using your chosen thresholds."],
        ["OpenRouter handles translation", "Text goes to your selected model: OpenAI by default, with DeepSeek as a fallback. Only text is sent, without author details or post IDs."],
      ],
    },
    cost: {
      h2: "Pay for what you use",
      body: "Use your own TypeSafe and OpenRouter accounts and pay each service directly. Requests never pass through ClearFlow’s servers.",
      stat: "$0.10",
      statLabel: "The developer spent $0.10 on filtering and translation over 2.4 days and about 5,000 replies on X—roughly $1.30/month. Your cost depends on usage.",
      points: [
        "Settings show this month’s spending and an estimate based on the past seven days.",
        "You can set a monthly credit limit for your OpenRouter key.",
        "Local filtering works without API keys.",
      ],
      cta: "Get your API keys",
    },
    privacy: {
      h2: "No data is sent to the developer",
      items: [
        ["No tracking or reporting", "Usage and cost statistics stay on your device. No analytics, crash reports or ad code."],
        ["Direct connections to your providers", "AI features send relevant posts and comments directly to TypeSafe for filtering and OpenRouter for translation, using your keys."],
        ["Keys and history stay on your device", "Keys are stored in the extension’s own database, inaccessible to websites. Uninstalling removes the local data."],
        ["Open for inspection", "The MIT-licensed code is on GitHub. You can check how data is processed and where it goes."],
      ],
      more: "Read the privacy policy",
    },
    faq: {
      h2: "FAQ",
      items: [
        ["Why do I need my own API keys?", "Your content goes directly to the service providers, and you do not need a ClearFlow subscription. To get started, create your service accounts and API keys. <a href=\"keys/\">API key setup</a>"],
        ["Does it work without keys?", "Yes. The local rules still hide replies with referral links or hidden contact details, and the same line posted by several accounts. API keys are needed for translation and for detecting abuse, sexual content and replies like “nice”."],
        ["Will it hide good comments?", "Sometimes. Each hidden reply has an explanation. You can open it to read it or mark it as a mistake. Filtering levels are set separately for each site. Choose “Relaxed” in Settings if too many replies are hidden."],
        ["Which sites and browsers?", "X, Reddit, YouTube, Xiaohongshu (RedNote) and Hacker News. Chrome 120 or later, plus Edge, Arc, Brave and other Chromium browsers."],
        ["Which languages are supported?", "The interface supports 19 languages. Settings and the popup follow your browser language. In-page labels and translations usually follow the site’s interface language. Hacker News always uses your browser language, as do other sites when their interface language cannot be detected."],
        ["Is it affiliated with X or YouTube?", "No. ClearFlow is an independent open-source project, not affiliated with X, Reddit, YouTube (Google), Xiaohongshu or Y Combinator."],
        ["How do I report a problem?", `Use Feedback in the extension's settings, open an issue on <a href="${REPO}/issues">GitHub</a>, or write to <a href="mailto:${MAIL}">${MAIL}</a>.`],
      ],
    },
    final: {"h2": "Make comment sections readable again", "cta": "Add to Chrome"},
    footer: { privacy: "Privacy policy", keys: "API key setup", license: "MIT license", disclaimer: "ClearFlow is not affiliated with X, Reddit, YouTube, Xiaohongshu or Y Combinator." },
    keys: {
      title: "Set up your API keys · ClearFlow",
      description: "Connect ClearFlow to TypeSafe and OpenRouter to enable AI filtering and translation.",
      h1: "Set up your API keys",
      lede: "AI filtering uses TypeSafe; translation uses OpenRouter. Each service needs its own API key, and you pay each provider for what you use. Enter your keys during setup or update them later under Settings → Connections and cost.",
      sections: [
        { h2: "TypeSafe: AI filtering", tag: "Filtering", steps: [
          "Open the <a href=\"https://console.typesafe.ai/\">TypeSafe console</a>, create an account and sign in.",
          "On the <a href=\"https://console.typesafe.ai/keys\">Keys</a> page, create and copy a key.",
          "Paste the key into the “Jev (TypeSafe)” field in ClearFlow’s settings.",
        ], note: "Billed by token usage. Results are cached for up to seven days to reduce repeat requests." },
        { h2: "OpenRouter: translation", tag: "Translation", steps: [
          "Open <a href=\"https://openrouter.ai/\">OpenRouter</a>, create an account and sign in. Add credit on the Credits page.",
          "On the <a href=\"https://openrouter.ai/keys\">Keys</a> page, click Create Key. Set a monthly credit limit to control spending—for example, $2 with a monthly reset.",
          "Copy the key, which starts with sk-or-, into the “OpenRouter” field in ClearFlow’s settings.",
        ], note: "Translation uses OpenAI by default, with DeepSeek as a fallback. You can change the model in Settings." },
      ],
      after: [
        ["Check the connection", "A valid key shows a check mark. If the connection fails, an explanation appears; select “Test connection” to try again."],
        ["Choose the features you need", "A TypeSafe key enables AI filtering; an OpenRouter key enables translation. Local filtering works with or without either key."],
        ["Keep your keys private", "Keys are stored only in your browser. Do not share them with anyone, including us. If a key may have been exposed, delete it in the provider’s dashboard and create a new one."],
      ],
      back: "Back to home",
    },
    privacyPage: { title: "Privacy policy · ClearFlow", description: "How ClearFlow reads, sends and stores data.", source: "The authoritative version of this policy is maintained on GitHub:" },
    notFound: { title: "Page not found", body: "The link may be mistyped.", home: "Back to home" },
  },

  ja: {
    brand: "ClearFlow",
    title: "ClearFlow · スパムを非表示に、外国語をその場で翻訳",
    description: "X・YouTube・Reddit・小紅書・Hacker News のスパム返信を非表示にし、投稿やコメントをその場で翻訳するオープンソースの Chrome 拡張機能です。非表示の理由と元の返信を確認できます。ご自身の API キーを使用し、開発者にはデータを送りません。",
    nav: {"clean":"フィルタリング","tx":"翻訳","cost":"料金","privacy":"プライバシー","faq":"よくある質問"},
    skip: "本文へスキップ",
    hero: {
      eyebrow: "オープンソースの Chrome 拡張機能",
      h1: "コメント欄を、もっと読みやすく",
      h1Parts: ["コメント欄を、", "もっと読みやすく"],
      trust: ["MIT ライセンス", "開発者への送信なし", "19 言語に対応", "従量課金"],
      lede: "スパム返信を非表示にし、外国語の投稿やコメントをその場で翻訳します。",
      cta: "Chrome に追加",
      ctaNote: "インストール無料",
    },
    platforms: {"label": "対応サイト", "names": {"x": "X", "yt": "YouTube", "reddit": "Reddit", "xhs": "小紅書", "hn": "Hacker News"}},
    demo: {"enlarge": "拡大して見る", "label": "ClearFlow の使用前後を比較", "before": "使用前", "after": "使用後", "tabs": {"xnews": "X", "xsex": "X · ボット", "x": "X", "xhs": "小紅書", "reddit": "Reddit", "yt": "YouTube", "hn": "Hacker News", "mark": "Reddit", "xhsmark": "小紅書"},"sum": {"clean": "{n} 件を非表示", "filler": "{n} 件を折りたたみ", "tx": "{n} 件を翻訳"}, "note": "デモ用の架空のページとコメントを、ClearFlow で実際に処理しています。"},
    eyebrow: {"clean":"フィルタリング","learn":"手動で指定","tx":"翻訳","how":"しくみ","cost":"料金","privacy":"プライバシー","faq":"よくある質問"},
    clean: {"h2": "スパムを減らして、議論を読みやすく", "lede": "ボットの連投、勧誘、詐欺、誹謗中傷、性的な返信を非表示にし、読むべきコメントを見つけやすくします。", "points": [["非表示の理由を確認", "返信ごとに理由を表示します。元の返信を読んだり、判定ミスを報告したりできます。"],["短い相づちは、まとめて表示", "「草」「それな」などの短い返信は、コメント欄の上部にまとめます。"],["通知もまとめて、すっきりと", "連続する非表示の返信は、1 つの通知にまとめます。スパムが多い場合は、上部に件数を表示します。"]], "scenes": ["x", "yt", "reddit", "xhs"],"captions": {"xnews": "繰り返しの宣伝、性的な返信、絵文字だけのコメントを整理します。", "xsex": "ガジェットの投稿から、性的な宣伝やエアドロップの勧誘を非表示に。", "x": "繰り返しの宣伝をまとめ、誹謗中傷や短い相づちも整理します。", "xhs": "勧誘コメントを非表示にし、短い相づちはまとめます。", "yt": "宣伝目的の体験談を非表示にし、絵文字だけの返信はまとめます。", "reddit": "無関係な広告を非表示にし、短い相づちはまとめます。"}},
    learn: {"h2": "見逃したスパムは、手動で指定", "lede": "見逃したスパムを指定すると、その返信を非表示にできます。指定した内容は、似たスパムを見分ける手がかりになります。", "steps": [["スパム返信を指定", "X では返信の「…」メニューから「この返信を非表示にする」を選択。ほかのサイトでは返信にカーソルを合わせ、投稿者名の横のフィルターアイコンを押します。"],["似たスパムの判定に活用", "似たスパムと判定した返信を非表示にし、手動で指定した内容に基づく判定であることを表示します。"],["いつでも取り消し可能", "指定直後に取り消すことも、設定から保存済みの例を削除することもできます。"]],"before": "マーク前", "after": "指定後の表示", "scenes": ["mark", "xhsmark"],"captions": {"mark": "使用例：宣伝コメントを 1 件指定すると、似た内容の 2 件も検出されます。", "xhsmark": "使用例：グループへの勧誘を 1 件指定すると、似た内容の 2 件も検出されます。"}},
    tx: {"h2": "外国語の議論も、いつもの言語で", "lede": "投稿やコメントをその場で翻訳。リンクや書式を保ち、いつでも原文に戻せます。", "points": [["ページを離れずに読める", "元の文章と同じ場所に、原文の言語と訳文を表示します。"],["原文をすぐに確認", "「原文を表示」で、原文と訳文を切り替えられます。"],["適切な Grok 訳はそのまま", "X では、Grok 訳の質が低い場合のみ ClearFlow の訳文に置き換えます。"]], "scenes": ["reddit", "yt", "hn", "xhs"],"captions": {"reddit": "さまざまな言語のサイクリングのアドバイスを、日本語で読めます。", "yt": "世界各地から寄せられた料理のコメントを、日本語で読めます。", "hn": "英語の技術的な議論を日本語に。コードやリンクはそのままです。", "xhs": "小紅書の投稿とコメントを、日本語で読めます。"}},
    control: {
      points: [
        "サイトごとに設定",
        "フィルタリングと翻訳を個別に設定",
        "3 段階の厳しさ",
        "処理した件数を確認",
      ],
      h2: "サイトごとに、自分に合った設定を",
      body: "サイトごとに、フィルタリングのルールや厳しさ、翻訳のオン・オフを選べます。ツールバーのアイコンから、このページ・今日・過去 7 日間の処理件数を確認できます。",
      altPopup: "ClearFlow のポップアップ：このページで非表示にした返信と翻訳の件数",
      altSettings: "ClearFlow の設定ページ：Reddit のフィルタリングと翻訳",
    },
    how: {
      h2: "ClearFlow のしくみ",
      steps: [
        ["まずローカルルールで判定", "紹介リンク、隠された連絡先、繰り返しの文面などを構造から検出します。API キーは不要で、費用もかかりません。"],
        ["AI が文脈を確認", "ルールで判定できない返信は、元の投稿とともに TypeSafe の Jev モデルへ送信。勧誘・誹謗中傷・性的な内容を、設定した基準で判定します。"],
        ["OpenRouter で翻訳", "文章を選択したモデルへ送ります。標準は OpenAI、予備は DeepSeek です。送るのは文章のみで、投稿者情報や投稿 ID は含みません。"],
      ],
    },
    cost: {
      h2: "使った分だけ、直接お支払い",
      body: "ご自身の TypeSafe と OpenRouter のアカウントを使用し、各サービスに直接支払います。通信は ClearFlow のサーバーを経由しません。",
      stat: "$0.10",
      statLabel: "開発者の使用例：X で 2.4 日間に約 5,000 件の返信を閲覧し、判定と翻訳に $0.10。月換算で約 $1.30 です。実際の費用は利用量によって変わります。",
      points: [
        "設定で今月の利用額と、過去 7 日間に基づく月額の見積もりを確認できます。",
        "OpenRouter のキーには、毎月の利用上限を設定できます。",
        "API キーがなくても、ローカルルールは使えます。",
      ],
      cta: "API キーを取得",
    },
    privacy: {
      h2: "開発者にはデータを送りません",
      items: [
        ["追跡も利用状況の送信もなし", "利用件数と費用は端末内に保存。解析データやクラッシュレポートの送信、広告コードはありません。"],
        ["サービスに直接接続", "AI 機能では、ご自身のキーで投稿やコメントを TypeSafe へ判定用に、OpenRouter へ翻訳用に直接送ります。"],
        ["キーと履歴は端末内に保存", "キーはウェブサイトからアクセスできない拡張機能専用のデータベースに保存。アンインストールでローカルデータも削除されます。"],
        ["コードを公開", "MIT ライセンスで GitHub に公開しています。データの処理方法や送信先を確認できます。"],
      ],
      more: "プライバシーポリシーを読む",
    },
    faq: {
      h2: "よくある質問",
      items: [
        ["なぜ自分で API キーを用意するのですか？", "内容を各サービスへ直接送り、ClearFlow のサブスクリプションを不要にするためです。初回はサービスへの登録とキーの作成が必要です。<a href=\"keys/\">API キーの設定</a>"],
        ["キーがなくても使えますか？", "使えます。紹介リンク、隠された連絡先、繰り返しの文面などは、ローカルルールで非表示にします。誹謗中傷・性的な返信・「いいね」だけの返信の判定と、翻訳にはキーが必要です。"],
        ["普通のコメントまで隠れませんか？", "誤って非表示にすることもあります。理由と元の返信を確認し、判定ミスを報告できます。サイトごとに厳しさを調整でき、非表示が多いと感じたら「ゆるめ」を選べます。"],
        ["対応サイトとブラウザは？", "X・Reddit・YouTube・小紅書（RedNote）・Hacker News。Chrome 120 以降と、Edge・Arc・Brave などの Chromium 系ブラウザです。"],
        ["表示言語は？", "表示は 19 言語に対応しています。設定とポップアップはブラウザの言語に従います。ページ内の表示と翻訳先には通常、サイトの表示言語を使います。Hacker News では常にブラウザの言語を使い、ほかのサイトでも表示言語を判別できない場合はブラウザの言語を使います。"],
        ["X や YouTube の公式ですか？", "いいえ。ClearFlow は独立したオープンソースプロジェクトで、X・Reddit・YouTube（Google）・小紅書・Y Combinator とは関係ありません。"],
        ["問題を見つけたら？", `拡張機能の設定ページの「フィードバック」、<a href="${REPO}/issues">GitHub</a> の issue、または <a href="mailto:${MAIL}">${MAIL}</a> までお知らせください。`],
      ],
    },
    final: {"h2": "返信欄を、もう一度読みやすく", "cta": "Chrome に追加"},
    footer: { privacy: "プライバシーポリシー", keys: "API キーの設定", license: "MIT ライセンス", disclaimer: "ClearFlow は X・Reddit・YouTube・小紅書・Y Combinator とは関係ありません。" },
    keys: {
      title: "API キーの設定 · ClearFlow",
      description: "TypeSafe と OpenRouter の API キーを設定して、AI 判定と翻訳を利用する方法。",
      h1: "API キーの設定",
      lede: "AI 判定には TypeSafe、翻訳には OpenRouter の API キーが必要です。ご自身のアカウントで、使った分だけ各サービスへ直接支払います。インストール後の案内に従ってキーを入力してください。あとから設定の「接続と費用」で変更できます。",
      sections: [
        { h2: "TypeSafe：AI 判定", tag: "フィルタリング", steps: [
          "<a href=\"https://console.typesafe.ai/\">TypeSafe コンソール</a>を開き、アカウントを作成してサインインします。",
          "<a href=\"https://console.typesafe.ai/keys\">Keys</a> ページでキーを作成し、コピーします。",
          "ClearFlow の設定の「Jev (TypeSafe)」欄にキーを貼り付けます。",
        ], note: "トークンの使用量に応じた課金です。判定結果は最大 7 日間保存し、重複するリクエストを減らします。" },
        { h2: "OpenRouter：翻訳", tag: "翻訳", steps: [
          "<a href=\"https://openrouter.ai/\">OpenRouter</a> を開き、アカウントを作成してサインインします。Credits ページでクレジットを追加します。",
          "<a href=\"https://openrouter.ai/keys\">Keys</a> ページで Create Key を選びます。毎月リセットされる利用上限（例：$2）の設定をおすすめします。",
          "sk-or- で始まるキーをコピーし、ClearFlow の設定の「OpenRouter」欄に貼り付けます。",
        ], note: "翻訳には標準で OpenAI、予備に DeepSeek を使います。モデルは設定で変更できます。" },
      ],
      after: [
        ["接続を確認", "有効なキーにはチェックマークが表示されます。接続に失敗した場合は理由を確認し、「接続をテスト」で再試行できます。"],
        ["必要な機能だけ設定", "TypeSafe のキーで AI 判定、OpenRouter のキーで翻訳を利用できます。ローカルルールは、キーの有無にかかわらず動作します。"],
        ["キーを安全に管理", "キーはブラウザ内にのみ保存されます。開発者を含め、誰にも共有しないでください。漏えいの疑いがある場合は、各サービスの管理画面で削除し、新しいキーを作成してください。"],
      ],
      back: "トップへ戻る",
    },
    privacyPage: { title: "プライバシーポリシー · ClearFlow", description: "ClearFlow が読み取り、送信、保存するデータについて。", source: "この日本語訳は参考用です。内容に相違がある場合は、GitHub 上の原文が優先されます：" },
    notFound: { title: "ページが見つかりません", body: "リンクが間違っているかもしれません。", home: "トップへ戻る" },
  },
};
