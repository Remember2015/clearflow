# 清流 ClearFlow

[English](README.md) · [官网](https://clearflow.ohmyai.app/zh/)

清流（英文名 ClearFlow）是一个 Chrome 插件，让 **X、Reddit、YouTube、小红书和 Hacker News** 的评论区重新好读：

- **清理垃圾回复**：机器人刷屏、引流拉人、辱骂、色情，每条都写明为什么清理。点开照样能看，判错了能标。
- **藏起「赞」「mark」这类回复**：只有几个字的夸、附和、谢谢、mark、蹲（X、Reddit、YouTube、小红书）。评论区最上面一行写着藏了几条，点开就回来。
- **连着的合成一条**：挨着两条以上被清理的合成一条；一个帖子底下清理得太多（超过 5 条），干脆整条藏起来，最上面一行写清理了几条、点开就回来。
- **标一条，同类都清理**：自己清理掉一条垃圾（评论上的漏斗，或者 X 菜单里的「清理掉这条」），换了说法、换了账号、推同一套骗局的回复以后也清理掉。一字不差的、推同一个链接的、同一个模板的在本地就认出来；最近标的几条还当样例，跟着本来就要发的请求一起发给 TypeSafe。标错了能撤销。
- **翻译**：外文的帖子和评论翻成你的语言，原位置替换，随时切回原文。X 上只在明显比 X 自带的译文好时才换上。

界面有 19 种语言。

> 清流与 X、Reddit、YouTube / Google、小红书、Y Combinator 均无关联，未获它们认可或赞助。

## 怎么判

先跑便宜的本地规则（推广码、藏起来的联系方式、几个账号刷同一句话、塞了看不见的字符……），判不了的连同所在的帖子一起发给 [TypeSafe](https://typesafe.ai) 的 Jev 分类器，每条回复问几个是 / 否问题。翻译经 [OpenRouter](https://openrouter.ai) 交给你选的模型。门槛按每个网站自己的数据定；设计上的规矩是本地规则只看**结构**、不写话术词表，换话题、换语言照样成立。

## 要两个 key

| 服务 | 用来 | 去哪拿 |
|---|---|---|
| TypeSafe（Jev） | 清理；判 X 的译文好不好 | https://typesafe.ai |
| OpenRouter | 翻译 | https://openrouter.ai/keys |

两个都按用量计费，直接付给它们。设置页能看到本月花了多少、照现在的用法每月大约多少。不填 TypeSafe 的 key 只跑本地规则；不填 OpenRouter 的 key 就不翻译。装好后会自动打开首次设置，带你选网站、填 key。

## 隐私

你正在看的评论和帖子会用你的 key 发给 TypeSafe 和 OpenRouter。不发任何东西给开发者，没有统计、没有追踪。key 和记录只存在你的浏览器里。详见 [PRIVACY.md](PRIVACY.md)。

## 安装

- **Chrome 应用商店**：[清流](https://chromewebstore.google.com/detail/clearflow/dfojglbldlneaogknbphkiifmaagjjle)。Edge、Arc、Brave 等 Chromium 浏览器也从这里装。
- **从源码装**：下载或 clone 这个仓库，打开 `chrome://extensions`，打开「开发者模式」，点「加载已解压的扩展程序」，选 `extension` 文件夹。打包好的文件已经提交在仓库里，只是试用不用构建。支持 Chrome 120 以上和其他 Chromium 内核的浏览器（Edge、Arc、Brave……）。

## 开发

要：Node 20+、Python 3、Google Chrome（跑浏览器测试用）。

```bash
npm run setup     # 装 ui/ 的依赖（npm ci）
npm run build     # 把弹窗和设置页打包进 extension/ui，把 19 种语言的文字生成进 extension/
npm test          # 全部测试：单元、无头 Chrome、页面内测试（自己起本地服务）
npm run test:unit # 只跑单元测试，不要 Chrome
npm run pack      # 打商店用的 dist/clearflow-<版本>.zip
```

Chrome 不在 macOS 默认位置时设 `CHROME_PATH`（Linux 上一般是 `/usr/bin/google-chrome`）。

目录：

- `extension/`：插件本身（Manifest V3）。各网站的内容脚本（X 是 `content.js`；`reddit.js`、`yt.js`、`xhs.js`、`hn.js` 共用 `fold_engine.js`；翻译在 `translate.js`、`tx_engine.js`），后台 service worker（`background.js`，经 `jev.js` 调 Jev、经 `translator.js` 调 OpenRouter），测试在 `extension/test/`（全是合成的仿页面，没有真实用户数据）。
- `ui/`：弹窗和设置页（React、基于 Base UI 的 shadcn/ui、Tailwind），打包进 `extension/ui/`。
- `i18n/`：界面文字。`en.json`、`zh-CN.json` 是人写的，另外 17 种用 `i18n/translate.py` 机翻，人工改的放 `overrides.json`。
- `docs/`：[架构说明](docs/architecture.md)和上架 Chrome 应用商店的材料。
- `site/`：官网 https://clearflow.ohmyai.app（`node site/build.mjs` 构建；图片由 `node scripts/site-assets.mjs` 生成；`site/deploy.sh` 部署到 Cloudflare）。

代码注释大多是中文，写的是为什么这条规则、这个门槛是这样，常带着背后的数字。定门槛用的评测数据和脚本不在这个仓库里（里面有采来的第三方内容）。

参与开发见 [CONTRIBUTING.md](CONTRIBUTING.md)，安全问题见 [SECURITY.md](SECURITY.md)。

## 建议与反馈

设置 → 建议与反馈，或者写信到 developer@ohmyai.app。也欢迎在 GitHub 上提 issue。

## 许可证

[MIT](LICENSE) © 2026 OhMyAI。第三方组件见 [extension/THIRD_PARTY_NOTICES.txt](extension/THIRD_PARTY_NOTICES.txt)。
