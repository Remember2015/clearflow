// Pricing page and terms page copy (user 10-24: Waffo's store review needs a public pricing page, terms with the refund and
// cancellation policy, and the privacy policy, all linked from the footer). Prices and rules must match the paid service
// (the paid service's server and design, which aren't public) and the Waffo products: USD, tax included, our own 7-day no-card trial (Waffo's trial off).
// Prices (user 10-24, as set in Waffo): monthly $2.90, yearly $24, 30-day pass $3.90, 1-year pass $39.
// Membership is live (extension 0.30+; 10-26 the "coming soon" badges and note came off, the paid plans get the same install button as the free one).
// PRICING has zh and en here; ja / ko / fr / pt / tr are in copy.pricing.json (translated 10-24 with GPT-6 Luna, checked: same keys, placeholders
// and prices; membership called ClearFlow メンバーシップ / 멤버십 / abonnement ClearFlow / assinatura ClearFlow / ClearFlow Üyeliği like LABELS.costLink).
import fs from "node:fs";

// Short labels used on every page, in every site language
export const LABELS = {
  zh: { nav: "价格", pricing: "价格", terms: "服务条款", account: "账号", costLink: "不想申请密钥？看看清流会员", termsPage: { title: "服务条款 · 清流", description: "清流会员的套餐、付款、取消和退款规则。", source: "服务条款以 GitHub 上的原文为准：" } },
  en: { nav: "Pricing", pricing: "Pricing", terms: "Terms of service", account: "Account", costLink: "Rather not get a key? See ClearFlow Membership", termsPage: { title: "Terms of service · ClearFlow", description: "Plans, payment, cancellation and refunds for ClearFlow Membership.", source: "The authoritative version of these terms is maintained on GitHub:" } },
  ja: { nav: "料金プラン", pricing: "料金プラン", terms: "利用規約", account: "アカウント", costLink: "キーを用意したくない方は ClearFlow メンバーシップ", termsPage: { title: "利用規約 · ClearFlow", description: "ClearFlow メンバーシップのプラン、支払い、解約、返金について。", source: "この規約は GitHub 上の原文が優先されます：" } },
  ko: { nav: "요금", pricing: "요금", terms: "서비스 약관", account: "계정", costLink: "키 발급이 번거롭다면 ClearFlow 멤버십", termsPage: { title: "서비스 약관 · ClearFlow", description: "ClearFlow 멤버십의 요금제, 결제, 해지, 환불 규정.", source: "이 약관은 GitHub의 원문이 우선합니다:" } },
  fr: { nav: "Tarifs", pricing: "Tarifs", terms: "Conditions d'utilisation", account: "Compte", costLink: "Pas envie de créer une clé ? Découvrez l'abonnement ClearFlow", termsPage: { title: "Conditions d'utilisation · ClearFlow", description: "Formules, paiement, résiliation et remboursements de l'abonnement ClearFlow.", source: "La version de référence de ces conditions est publiée sur GitHub :" } },
  pt: { nav: "Preços", pricing: "Preços", terms: "Termos de serviço", account: "Conta", costLink: "Não quer criar uma chave? Conheça a assinatura ClearFlow", termsPage: { title: "Termos de serviço · ClearFlow", description: "Planos, pagamento, cancelamento e reembolsos da assinatura ClearFlow.", source: "A versão oficial destes termos está no GitHub:" } },
  tr: { nav: "Fiyatlar", pricing: "Fiyatlar", terms: "Hizmet şartları", account: "Hesap", costLink: "Anahtar almak istemiyor musunuz? ClearFlow üyeliğine bakın", termsPage: { title: "Hizmet şartları · ClearFlow", description: "ClearFlow üyeliğinin planları, ödeme, iptal ve iade kuralları.", source: "Bu şartların geçerli sürümü GitHub'da yayımlanır:" } },
};

export const PRICING = {
  zh: {
    title: "价格 · 清流",
    description: "清流免费开源，用自己的 OpenRouter 密钥按量付费；也可以开清流会员，登录就能用，不用申请密钥。",
    h1: "价格",
    lede: "清流本身免费、开源。可以用自己的 API 密钥按用量付费，也可以开清流会员，登录就能用。",
    free: {
      name: "自带密钥",
      price: "$0",
      per: "",
      note: "AI 用量按实际付给 OpenRouter，重度使用约每月 $1",
      points: ["全部清理和翻译功能", "用你自己的 OpenRouter 密钥", "内容直接发给服务商，不经过我们", "不填密钥也能用本地规则清理"],
      keys: "获取 API 密钥",
    },
    plans: [
      { name: "会员 · 月付", price: "$2.90", per: "/ 月", note: "自动续费，随时取消" },
      { name: "会员 · 年付", price: "$24", per: "/ 年", note: "约 $2 / 月，比月付省 31%", badge: "更划算" },
    ],
    member: ["登录就能用，不用申请密钥", "AI 清理和翻译增强，含 YouTube 字幕", "每月用量额度，按重度使用留了余量", "最多 3 台设备", "首次购买 7 天内全额退款"],
    trial: "新账号可以免费试用 7 天，不用绑卡。",
    passes: {
      h2: "一次性付款",
      lede: "内容和会员一样，只是不自动续费，快到期时扩展里会提醒。中国大陆、香港可以用微信支付。",
      items: [["30 天", "$3.90"], ["1 年", "$39"]], wechat: "微信支付",
      note: "会员还没到期时再买，从到期日接着往后算。",
    },
    faqH2: "常见问题",
    faq: [
      ["会员和自带密钥有什么区别？", "功能一样。自带密钥时，内容直接发给 OpenRouter，不经过我们；会员模式下，内容先到清流的服务器，再转给同样的服务商。会员模式不检查回复里的图片。"],
      ["用量额度是什么？", "会员的 AI 判断和翻译由我们付钱给上游服务商，所以有每月的用量额度，另有每天的上限，免得一天用完一个月。扩展里会显示本月已用的比例。"],
      ["额度用完会怎样？", "AI 判断和翻译暂停到第二天或下个月，本地规则照常清理。也可以随时换回自己的密钥。"],
      ["怎么取消？", "在账号页或 Waffo 的账单页取消。取消后用到当期结束，不再续费。"],
      ["怎么退款？", "账号的第一笔购买，7 天内可以在账号页申请全额退款，也可以写信给我们。"],
      ["谁来收款？有发票吗？", "付款由我们的在线经销商 Waffo（Waffo.com Limited）处理。它是名义卖方，负责收款、发票和税，我们拿不到你的卡号。价格以美元计，已含税。"],
    ],
    legal: "购买会员即表示同意",
  },
  en: {
    title: "Pricing · ClearFlow",
    description: "ClearFlow is free and open source: pay for AI usage with your own OpenRouter key, or sign in with ClearFlow Membership and skip the key.",
    h1: "Pricing",
    lede: "ClearFlow itself is free and open source. Pay for what you use with your own API key, or get ClearFlow Membership and just sign in.",
    free: {
      name: "Your own key",
      price: "$0",
      per: "",
      note: "You pay OpenRouter for AI usage directly: about $1 a month for heavy use",
      points: ["Every filtering and translation feature", "Uses your own OpenRouter key", "Content goes straight to the providers, not through us", "Local rules work even without a key"],
      keys: "Get your API key",
    },
    plans: [
      { name: "Membership · Monthly", price: "$2.90", per: "/ month", note: "Renews monthly. Cancel anytime" },
      { name: "Membership · Yearly", price: "$24", per: "/ year", note: "About $2 a month, 31% less than monthly", badge: "Best value" },
    ],
    member: ["Just sign in, no API key needed", "AI filtering and enhanced translation, including YouTube captions", "Monthly usage allowance with room for heavy use", "Up to 3 devices", "Full refund within 7 days of your first purchase"],
    trial: "New accounts get a free 7-day trial. No card needed.",
    passes: {
      h2: "One-time passes",
      lede: "Everything in membership, without auto-renewal: the extension reminds you before a pass ends. WeChat Pay is available in mainland China and Hong Kong.",
      items: [["30 days", "$3.90"], ["1 year", "$39"]], wechat: "WeChat Pay",
      note: "Buying again while your membership is active extends it from its current end date.",
    },
    faqH2: "Questions",
    faq: [
      ["How is membership different from using my own key?", "The features are the same. With your own key, content goes straight to OpenRouter and never through us. With membership, it goes to ClearFlow's server first, which passes it to the same providers. Membership doesn't check images in replies."],
      ["What is the usage allowance?", "With membership, we pay the AI providers for you, so there's a monthly usage allowance and a daily limit, so a month's allowance can't go in one day. The extension shows how much of this month's allowance you've used."],
      ["What happens if I run out?", "AI filtering and translation pause until the next day or the next month, and local rules keep working. You can also switch back to your own key at any time."],
      ["How do I cancel?", "On your account page or Waffo's billing page. Your membership stays active until the end of the period and doesn't renew."],
      ["How do refunds work?", "Within 7 days of your account's first purchase, you can get a full refund from your account page or by emailing us."],
      ["Who handles payment? Do I get an invoice?", "Payments are processed by our online reseller Waffo (Waffo.com Limited). As merchant of record, Waffo takes the payment and handles invoices and taxes; we never see your card details. Prices are in US dollars and include tax."],
    ],
    legal: "By buying a membership, you agree to the",
  },
};

Object.assign(PRICING, JSON.parse(fs.readFileSync(new URL("./copy.pricing.json", import.meta.url), "utf8")));
export const pricingFor = (lang) => ({ lang: PRICING[lang] ? lang : "en", P: PRICING[lang] || PRICING.en });
