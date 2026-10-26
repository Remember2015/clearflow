// Account page (/<lang>/account/) and payment result page (/<lang>/paid/) copy (user 10-24: "账号和支付结果页面要做一下";
// 10-25 redesign from the approved sketch: centered sign-in card with a 6-box code, two-column account page, busy states on buttons,
// no developer-facing wording). Waffo sends buyers back to /<lang>/paid/?co=<our checkout id> whether they paid, failed or
// cancelled, so that page asks the API. Short sentences (user 10-24: "文字要简单点"). zh and en here; ja / ko / fr / pt / tr in
// copy.account.json (GPT-6 Luna, checked: same keys and placeholders; glossary as copy.pricing.json).
import fs from "node:fs";
// API: production (same as extension/account.js since 0.31.0; it used to be api-staging.clearflow.ohmyai.app).
export const API = "https://api.clearflow.ohmyai.app";

export const ACCOUNT = {
  zh: {
    paid: {
      title: "付款结果 · 清流",
      checking: "正在确认付款…", checkingText: "通常几秒就好。",
      paidTitle: "会员已开通", paidText: "回到原来的页面就行，清流几秒内自动生效。",
      slowTitle: "还在确认", slowText: "如果已经付了款，几分钟内会自动生效，可以先关掉这页。",
      noneTitle: "没有完成付款", noneText: "这次没有扣款。可以关掉这页，回到清流里重新开通。",
      errorText: "暂时查不到付款结果，过一会儿打开账号页看看。",
      toAccount: "查看账号",
    },
    account: {
      title: "账号 · 清流", description: "登录清流账号，查看会员、管理订阅和设备。",
      loading: "加载中…",
      signInTitle: "登录清流", signInSub: "管理会员、订阅和设备", email: "邮箱", sendCode: "发送验证码",
      codeTitle: "输入验证码", codeSentTo: "已发到 {email}", changeEmail: "换个邮箱", code: "验证码", signIn: "登录",
      resendIn: "{n} 秒后可重新发送", resend: "重新发送",
      accountLabel: "清流账号", signOut: "退出登录",
      member: "会员", heroMember: "清流会员", heroTrial: "试用还剩 {n} 天", heroTrialOne: "试用还剩 1 天", heroNone: "还没有开通", noneSub: "开通后不用申请密钥，AI 清理和翻译直接能用。",
      plan: { trial: "试用", monthly: "月付", yearly: "年付", pass30: "30 天", pass365: "1 年" },
      badge: { trial: "试用中", renews: "{plan} · 自动续费", canceled: "{plan} · 已取消", pass: "{plan}", pastDue: "扣款失败", none: "未开通" },
      nextRenewal: "下次续费 {date}", until: "到 {date}", endsOn: "{date} 结束", pastDueSub: "续费没扣成，去更新付款方式。",
      usedToday: "今天已用 {pct}", usedMonth: "本月已用 {pct}",
      manage: "管理订阅", refund: "退款（{date} 前）", refundConfirm: "确定退款？全额退款，会员立即停用。", refunded: "已申请退款",
      plansTitle: "开通清流会员", benefits: ["不用申请密钥", "AI 清理和翻译增强", "最多 3 台设备"],
      monthly: "月付", yearly: "年付", perMonth: "/ 月", perYear: "/ 年", monthlyNote: "自动续费，随时取消", yearlyNote: "自动续费，约 $2 / 月", recommended: "推荐 · 省 31%",
      onceNote: "一次性，不续费", wechat: "微信支付", d30: "30 天", y1: "1 年", pay: "去付款 · {price}", refundNote: "首次购买 7 天内可全额退款",
      devices: "设备", noDevices: "在插件里用这个邮箱登录后，设备会出现在这里。", remove: "移除",
      helpTitle: "帮助", helpExt: "在插件里用这个邮箱登录就能用", helpRefund: "首次购买 7 天内全额退款", helpWaffo: "付款和发票由 Waffo 处理", terms: "服务条款",
      deletePrompt: "不再使用？", deleteLink: "删除账号", deleteNote: "（会先取消自动续费）", deleteConfirm: "确定删除账号？删除后不能恢复。", deleted: "账号已删除",
      busy: { sending: "发送中…", signingIn: "登录中…", opening: "正在打开…", refunding: "退款中…", removing: "移除中…", signingOut: "正在退出…", deleting: "删除中…", resuming: "恢复中…" },
      // 0.33.0（用户 10-25）：取消了还没到期——恢复自动续费；月付——改成年付；退了款——一行说明
      resume: "恢复自动续费", resumed: "已恢复自动续费", toYearly: "改成年付", refundLine: "已退款，3–10 个工作日原路退回",
      nav: { signIn: "登录", account: "账号：{email}" },
      // 插件登录确认页（/<语言>/activate/，0.32.0）：插件开这一页，没登录先登录，再确认登录插件
      activate: {
        title: "登录插件 · 清流", heading: "登录清流插件", signInSub: "先登录清流账号，再确认登录插件",
        device: "在 {device} 上登录清流插件", check: "核对码 {code}，和插件里显示的一样", confirm: "登录插件", confirming: "登录中…", switchAccount: "换个账号",
        limitTitle: "已经在 3 台设备上登录", limitText: "先移除一台，再登录这台",
        doneTitle: "插件已登录", doneText: "这页会自动关掉，也可以直接关掉",
        badTitle: "这个登录链接用不了了", badText: "可能已经过期或用过了。回到清流插件，重新点「登录」",
      },
      err: {
        invalid_email: "邮箱格式不对", code_invalid: "验证码不对", code_expired: "验证码过期了，重新发一个", too_many_codes: "发得太频繁了，10 分钟后再试",
        rate_limited: "操作太频繁，稍等一会儿再试", network: "连不上清流的服务器，检查一下网络", has_subscription: "已经在订阅了，先取消订阅或等它到期",
        already_subscribed: "已经订阅了", billing_unavailable: "暂时不能付款，稍后再试", refund_window_passed: "已经过了 7 天的退款期限",
        not_refundable: "这笔不能自助退款，写信给我们", account_disabled: "这个账号已停用", other: "出错了，稍后再试", cannot_resume: "这个订阅没法恢复，可以重新开通", resume_first: "先恢复自动续费，再换套餐", past_due: "续费没扣成，先更新付款方式",
      },
    },
  },
  en: {
    paid: {
      title: "Payment · ClearFlow",
      checking: "Confirming your payment…", checkingText: "This usually takes a few seconds.",
      paidTitle: "Your membership is active", paidText: "Go back to where you were. ClearFlow picks it up within a few seconds.",
      slowTitle: "Still confirming", slowText: "If you paid, it takes effect within a few minutes. You can close this page.",
      noneTitle: "Payment not completed", noneText: "You weren't charged. Close this page and try again from ClearFlow.",
      errorText: "Couldn't check the payment right now. Check your account page in a little while.",
      toAccount: "View account",
    },
    account: {
      title: "Account · ClearFlow", description: "Sign in to see your ClearFlow membership and manage your subscription and devices.",
      loading: "Loading…",
      signInTitle: "Sign in to ClearFlow", signInSub: "Manage your membership, subscription and devices", email: "Email", sendCode: "Send code",
      codeTitle: "Enter the code", codeSentTo: "Sent to {email}", changeEmail: "Use another email", code: "Code", signIn: "Sign in",
      resendIn: "Resend in {n}s", resend: "Resend code",
      accountLabel: "ClearFlow account", signOut: "Sign out",
      member: "Membership", heroMember: "ClearFlow Membership", heroTrial: "{n} days left in your trial", heroTrialOne: "1 day left in your trial", heroNone: "No membership yet", noneSub: "With a membership, AI filtering and translation work without an API key.",
      plan: { trial: "Trial", monthly: "Monthly", yearly: "Yearly", pass30: "30 days", pass365: "1 year" },
      badge: { trial: "Trial", renews: "{plan} · renews automatically", canceled: "{plan} · cancelled", pass: "{plan}", pastDue: "Payment failed", none: "Not active" },
      nextRenewal: "Renews on {date}", until: "Until {date}", endsOn: "Ends on {date}", pastDueSub: "Your renewal payment failed. Update your payment method.",
      usedToday: "{pct} used today", usedMonth: "{pct} used this month",
      manage: "Manage subscription", refund: "Refund (until {date})", refundConfirm: "Get a full refund? Your membership ends right away.", refunded: "Refund requested",
      plansTitle: "Get ClearFlow Membership", benefits: ["No API key needed", "AI filtering and enhanced translation", "Up to 3 devices"],
      monthly: "Monthly", yearly: "Yearly", perMonth: "/ month", perYear: "/ year", monthlyNote: "Renews monthly, cancel anytime", yearlyNote: "Renews yearly, about $2 a month", recommended: "Recommended · save 31%",
      onceNote: "One-time, doesn't renew", wechat: "WeChat Pay", d30: "30 days", y1: "1 year", pay: "Go to checkout · {price}", refundNote: "Full refund within 7 days of your first purchase",
      devices: "Devices", noDevices: "Sign in with this email in the extension and your devices show up here.", remove: "Remove",
      helpTitle: "Help", helpExt: "Sign in with this email in the extension to use it", helpRefund: "Full refund within 7 days of your first purchase", helpWaffo: "Payments and invoices are handled by Waffo", terms: "Terms of service",
      deletePrompt: "Not using it anymore?", deleteLink: "Delete account", deleteNote: "(a renewing subscription is cancelled first)", deleteConfirm: "Delete your account? This can't be undone.", deleted: "Account deleted",
      busy: { sending: "Sending…", signingIn: "Signing in…", opening: "Opening…", refunding: "Refunding…", removing: "Removing…", signingOut: "Signing out…", deleting: "Deleting…", resuming: "Turning on…" },
      // 0.33.0（用户 10-25）：取消了还没到期——恢复自动续费；月付——改成年付；退了款——一行说明
      resume: "Turn auto-renew back on", resumed: "Auto-renew is back on", toYearly: "Switch to yearly", refundLine: "Refunded. It reaches your account in 3–10 business days",
      nav: { signIn: "Sign in", account: "Account: {email}" },
      activate: {
        title: "Sign in to the extension · ClearFlow", heading: "Sign in to the ClearFlow extension", signInSub: "Sign in to your ClearFlow account, then confirm",
        device: "Sign in to ClearFlow on {device}", check: "Check code {code}. It should match the one in the extension", confirm: "Sign in extension", confirming: "Signing in…", switchAccount: "Use another account",
        limitTitle: "You're signed in on 3 devices", limitText: "Remove one to sign in here",
        doneTitle: "The extension is signed in", doneText: "This page closes by itself, or you can close it now",
        badTitle: "This sign-in link no longer works", badText: "It may have expired or already been used. Go back to the ClearFlow extension and click Sign in again",
      },
      err: {
        invalid_email: "Enter a valid email", code_invalid: "That code isn't right", code_expired: "That code has expired. Send a new one",
        too_many_codes: "Too many codes requested. Try again in 10 minutes", rate_limited: "Too many tries. Wait a minute and try again",
        network: "Can't reach ClearFlow's server. Check your connection", has_subscription: "You already have a subscription. Cancel it or wait for it to end first",
        already_subscribed: "You're already subscribed", billing_unavailable: "Payments aren't available right now. Try again later",
        refund_window_passed: "The 7-day refund window has passed", not_refundable: "This purchase can't be refunded here. Email us",
        account_disabled: "This account has been disabled", other: "Something went wrong. Try again later", cannot_resume: "This subscription can't be restored. You can subscribe again", resume_first: "Turn auto-renew back on first, then switch plans", past_due: "Your renewal payment failed. Update your payment method first",
      },
    },
  },
};
Object.assign(ACCOUNT, JSON.parse(fs.readFileSync(new URL("./copy.account.json", import.meta.url), "utf8")));
export const accountFor = (lang) => ({ lang: ACCOUNT[lang] ? lang : "en", A: ACCOUNT[lang] || ACCOUNT.en });
