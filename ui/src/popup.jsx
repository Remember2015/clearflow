// 弹窗：第一行是当前网站（logo、名字）和它的总开关（0.21，用户：首行应该是当前平台的开启与关闭；插件名不再占第一行——
// 产品不只是清理评论，还有翻译，中文界面的名字也改成 BetterFeed；0.24 起因为重名改叫 ClearFlow，中文叫清流），下面一组是这个网站上的两项（清理、翻译，网站关了就灰掉）、
// 这一页清理和翻译了多少（一句话）、
// 今天清理了多少（三类 + 最近 7 天，所有网站）和翻译了多少、本月花费、要你处理的事。
// 插件不管的网站（0.20，用户：不支持的网站上弹窗不该能用）：没有开关和统计，只说在哪几个网站上能用、留设置入口。
// 界面上的说法：0.18 起不说"折叠"，0.20.1 起也不说"收起"，说"清理"（用户："收起"不好理解）。
// 0.20.1 去掉了"判对了吗"（最近收起的几条点判对 / 判错，用户：可以去掉；页面上提示条的判对 / 判错照旧）和
// 首页、自己的主页、列表上"不收起，只改进翻译"那句（用户：看不懂；有翻译就只说翻了几条）。
// 数字都从 chrome.storage.local 读（后台记的 ff_stats、ff_health）；"这个页面"问当前标签页里的内容脚本。
// 0.19 起用 shadcn/ui 的 maia 组件（Item、Badge、Button、Switch）。Chrome 的弹窗最高 600px，超了出滚动条：间距按这个收紧过。
import * as React from "react";
import { createRoot } from "react-dom/client";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { t, I18N, SETTINGS, PRICE, DAY, day, usd, joinSentences, failText, useStorage, writeSite, siteName, txLabel, SiteLogo, cn,
  Toggle, TipProvider, CAT_TONE, WARN_TONE, BAD_TONE, MUTED_TONE } from "./lib.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemGroup } from "@/components/ui/item";

I18N.apply();
// 清理的三类：垃圾和推广（本地规则、Jev 的三问、YouTube 的冒充频道主 / 成群吹 / 一唱一和……辱骂、色情以外的都算）、辱骂、色情；
// 你自己标的（user_*）不算"帮你清理"。0.22 起还有「赞」「mark」这类（filler，整条藏起来的，统计里是 fold_filler），也算清理了几条
const CATS = ["spam", "abuse", "sexual", "filler"];
const isSpamStat = (k) => k.startsWith("fold_") && k !== "fold_abuse" && k !== "fold_sexual" && k !== "fold_filler" && !k.startsWith("fold_user");
const counts = (s) => ({ spam: Object.keys(s).filter(isSpamStat).reduce((n, k) => n + (s[k] || 0), 0), abuse: s.fold_abuse || 0, sexual: s.fold_sexual || 0, filler: s.fold_filler || 0 });
const sum = (c) => c.spam + c.abuse + c.sexual + (c.filler || 0);
const catOf = (kind) => (kind === "abuse" ? "abuse" : kind === "sexual" ? "sexual" : "spam");
const catText = (c) => CATS.filter((k) => c[k]).map((k) => `${t(`pop.cat.${k}`)} ${c[k]}`).join(" · ");
const toSettings = (e) => { e?.preventDefault(); chrome.runtime.openOptionsPage(); };
// ff_keys：两个 key 填没填（0.28.12 起 key 本身在后台的 IndexedDB 里）；ff_key、ff_or_key 是旧版本的、后台会挪走
const KEYS = ["ff_stats", "ff_settings", "ff_keys", "ff_key", "ff_or_key", "ff_health"];
const hasKey = (d, which) => (d.ff_keys ? !!d.ff_keys[which] : !!String((which === "jev" ? d.ff_key : d.ff_or_key) || "").trim());

// ---------- 要你处理的事（只在出问题时出现；Jev key 的事只在这个网站开着清理时说） ----------
function Alerts({ d, st }) {
  const list = [];
  const h = d.ff_health || {};
  // 高级设置里关了 Jev 的不提 Jev key 的事（0.28.8，review）。0.29.11 起判断默认走 OpenRouter：TypeSafe 和 OpenRouter 的密钥有一个就能判；
  // TypeSafe 的问题只在填了它（直连）时说，OpenRouter 的问题在它管着判断（没填 TypeSafe）或翻译时说
  const judging = st.enabled && st.useJev, ts = hasKey(d, "jev");
  if (judging && !ts && !hasKey(d, "or")) list.push(["warn", t("pop.alert.noKey"), true]);
  else if (judging && ts && h.jev?.code === "badkey") list.push(["danger", t("pop.alert.badKey"), true]);
  else if (judging && ts && h.jev?.code === "credit") list.push(["danger", t("pop.alert.jevCredit"), true]);
  if ((st.translate || (judging && !ts)) && hasKey(d, "or")) {
    if (h.or?.code === "or_credit") list.push(["danger", t("pop.alert.orCredit"), true]);
    else if (h.or?.code === "or_badkey") list.push(["danger", t("pop.alert.orBadKey"), true]);
  }
  const tone = { warn: WARN_TONE, danger: BAD_TONE };
  return (
    <div id="alerts" className="flex flex-col gap-2 empty:hidden">
      {list.map(([kind, text, link]) => (
        <p key={kind + text} className={cn("alert rounded-2xl px-3.5 py-2.5 text-sm", tone[kind])}>
          {text}{link && <> <a href="#" className="font-medium underline underline-offset-4" onClick={toSettings}>{t("pop.goSettings")}</a></>}
        </p>
      ))}
    </div>
  );
}

// ---------- 当前标签页是哪个网站、这个页面怎么样 ----------
// 网址读得到（插件对这几个网站有权限、别的网站读不到）就按网址认；再问页面里的插件脚本（它也报自己是哪个网站）。
// 是插件管的网站、但页面里没有插件脚本（插件装上或重新加载以后没刷新过）：说一句刷新后生效
async function whereAmI() {
  let tab = null;
  try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); } catch (e) { return { site: null }; }
  if (!tab || typeof tab.id !== "number") return { site: null };
  const r = await new Promise((res) => {
    const timer = setTimeout(() => res(null), 800);
    try {
      chrome.tabs.sendMessage(tab.id, { type: "pageSummary" }, (x) => { void chrome.runtime.lastError; clearTimeout(timer); res(x || null); });
    } catch (e) { clearTimeout(timer); res(null); }
  });
  const site = SETTINGS.siteOf(tab.url) || (r && r.site) || null;
  if (!site) return { site: null };
  return { site, text: r ? hereText(r) : t("pop.reload") };
}
function hereText(r) {
  const parts = [];
  const tx = r.tx || {};
  // 翻译：X 上换掉的 Grok 译文、补翻的，和别的站点插件自己翻的，都算"翻译了几条"（用户：两种说法看不懂，合成一个数）
  const txN = tx.on === false ? 0 : (tx.improved || 0) + (tx.filled || 0);
  if (!r.enabled) { if (txN) parts.push(t("pop.hereTxN", { n: txN })); } // 这个网站关着清理：开关就在上面，只说翻了几条
  else if (r.folds) { // 这一页判过：清理几条、翻译几条一句话说完
    const c = { ...r.folds, filler: r.filler || 0 }, n = sum(c);
    parts.push(n ? t(txN ? "pop.hereHideTx" : "pop.hereHide", { n, detail: catText(c), tx: txN }) : t(txN ? "pop.hereCleanTx" : "pop.hereClean", { tx: txN }));
    if (r.pending) parts.push(t("pop.herePending", { n: r.pending }));
  } else if (!["status", "profile", "search", "feed", "home", "list"].includes(r.kind) && !r.own) { // 插件不管的页面：说这个网站上哪里管
    parts.push(t({ reddit: "pop.hereOtherReddit", hn: "pop.hereOtherHN", yt: "pop.hereOtherYT", xhs: "pop.hereOtherXHS" }[r.site] || "pop.hereOther"));
    if (txN) parts.push(t("pop.hereTxMore", { n: txN })); // 前一句已经说了"当前页"
  } else if (txN) parts.push(t("pop.hereTxN", { n: txN })); // 首页、自己的主页、只翻标题的列表（0.20.1 起不说"不收起，只……"）：只说翻了几条
  return parts.length ? joinSentences(parts) : null;
}
function Here({ text }) {
  if (!text) return null;
  return (
    <Item variant="muted" size="xs" id="here" render={<section />}>
      <h2 className="sr-only">{t("pop.here")}</h2>
      <p id="hereText" className="text-sm">{text}</p>
    </Item>
  );
}

// ---------- 今天、最近 7 天 ----------
function Today({ stats }) {
  const s = stats[day(new Date())] || {};
  const c = counts(s);
  // 看过哪些页面：帖子、主页、搜索、列表，只列有的（"帖子 28 · 主页 3"，各种语言都不用变词形）
  const seen = [["posts", s.posts], ["profiles", s.profiles], ["searches", s.searches], ["feeds", s.feeds]].filter(([, n]) => n).map(([k, n]) => `${t(`pop.page.${k}`)} ${n}`);
  const txN = (s.tx_replaced || 0) + (s.tx_fill || 0); // 今天翻译了几条（换掉的 Grok 译文 + 补翻 + 别的站点插件翻的），0.18 起从翻译那一行挪到这里
  const where = [txN ? t("pop.todayTx", { n: txN }) : "", seen.length ? t("pop.where", { detail: seen.join(" · ") }) : ""].filter(Boolean).join(" · ");
  const days = [...Array(7)].map((_, i) => day(new Date(Date.now() - (6 - i) * DAY)));
  const totals = days.map((d) => sum(counts(stats[d] || {})));
  const max = Math.max(...totals);
  return (
    <section id="today" className="flex flex-col gap-1.5">
      <h2 className="text-sm text-muted-foreground">{t("pop.today")}</h2>
      <div className="flex items-end justify-between gap-3">
        <p className="text-4xl leading-none font-semibold tabular-nums" id="todayN">{sum(c)}</p>
        {max > 0 && (
          <div id="bars" className="flex h-9 items-end gap-1" role="img" aria-label={t("pop.weekAria", { list: days.map((d, i) => `${d.slice(5)} ${totals[i]}`).join(", ") })}>
            {totals.map((v, i) => <span key={days[i]} className={cn("bar w-2.5 rounded-full", i === 6 ? "bg-on" : "bg-muted-foreground/30 dark:bg-white/18")} title={`${days[i].slice(5)}：${v}`}
              style={{ height: `${Math.max(v ? 16 : 7, Math.round((v / max) * 100))}%` }} />)}
          </div>
        )}
      </div>
      <div id="cats" className="flex flex-wrap gap-1.5 pt-1.5">
        {CATS.map((k) => (
          <Badge key={k} className={cn("chip", c[k] ? CAT_TONE[k] : MUTED_TONE)}><span>{t(`pop.cat.${k}`)}</span> <b className="font-semibold tabular-nums">{c[k]}</b></Badge>
        ))}
      </div>
      <p id="todayWhere" className="text-xs text-muted-foreground">{where || t("pop.whereNone")}</p>
    </section>
  );
}

// ---------- 这个网站的两项、花费 ----------
// 清理、翻译（0.20 起只管当前网站）：一组，两行一样大（0.18.1，用户："字体不一样大"）；网站总开关关着时灰掉、不能点。
// 翻译只在开着却用不了、或者 X 上只能补翻时说一句
function SiteRow({ id, name, checked, note, onChange, disabled }) {
  return (
    <div id={`row-${id}`} className="feat-row flex items-center justify-between gap-3 border-t py-2 first:border-t-0">
      <div className="flex min-w-0 flex-col">
        <span className="label text-sm leading-5">{name}</span>
        {note && <span id={`${id}Note`} className="text-xs text-muted-foreground">{note}</span>}
      </div>
      <Toggle id={id} checked={checked} label={name} disabled={disabled} onChange={onChange} />
    </div>
  );
}
// 0.29.11 起判断也走 OpenRouter：有它就什么都能做（以前没填 Jev 时 X 上只能补翻）
function txNote(d, st) {
  return st.translate && !hasKey(d, "or") ? t("pop.txNeedKey") : "";
}
function cost(stats) {
  const month = day(new Date()).slice(0, 7);
  let jev = 0, or = 0;
  for (const [d, s] of Object.entries(stats)) {
    if (!d.startsWith(month)) continue;
    jev += ((s.tokens || 0) + (s.tx_jev_tokens || 0)) * PRICE;
    or += s.tx_usd || 0;
  }
  return { text: t("pop.cost", { usd: usd(jev + or) }), title: t("pop.costTitle", { jev: usd(jev), or: usd(or) }) };
}

// 插件不管的网站（Google、新标签页、chrome:// 这些）：只说在哪几个网站上能用
function Unsupported() {
  return (
    <div id="unsupported" className="flex flex-col gap-3 px-4 py-3.5">
      <h1 className="text-base leading-6 font-semibold">{t("app.name")}</h1>
      <Item variant="muted" size="xs" render={<section />} className="flex-col items-start gap-1.5">
        <h2 className="text-sm font-medium">{t("pop.unsupported")}</h2>
        <p className="text-xs text-muted-foreground">{t("pop.unsupportedHint")}</p>
        <div id="siteList" className="flex flex-wrap gap-1.5 pt-0.5">
          {SETTINGS.SITES.map((x) => <Badge key={x.id} variant="outline" className="chip gap-1.5 ps-1"><SiteLogo id={x.id} size={14} />{siteName(x.id)}</Badge>)}
        </div>
      </Item>
      <footer className="flex justify-end">
        <span className="flex items-center gap-3">
          {/* 建议与反馈（0.23）：打开设置页、停在那张卡片（邮箱写在那里、能复制；直接点 mailto 在没配邮件程序的电脑上没反应） */}
          <a href="#" id="feedback" className="text-sm text-muted-foreground no-underline hover:text-foreground"
            onClick={(e) => { e.preventDefault(); chrome.tabs.create({ url: chrome.runtime.getURL("options.html#feedback") }); window.close(); }}>{t("pop.feedback")}</a>
          <Button id="openOpts" variant="outline" size="sm" className="btn" onClick={() => chrome.runtime.openOptionsPage()}>{t("pop.settings")}</Button>
        </span>
      </footer>
    </div>
  );
}

function Popup() {
  const [d, reload] = useStorage(KEYS);
  const [place, setPlace] = React.useState(null);
  const [status, setStatus] = React.useState("");
  React.useEffect(() => { whereAmI().then(setPlace, () => setPlace({ site: null })); }, []);
  if (!d || !place) return null;
  if (!place.site) return <Unsupported />;
  const site = place.site, st = SETTINGS.forSite(d.ff_settings, site);
  const o = SETTINGS.normalize(d.ff_settings).sites[site] || {}, on = o.on !== false; // 开关上显示存着的值（总开关关着时 st 里两项都是关）
  const onError = (e) => setStatus(failText(e));
  const onToggle = async (key, value) => {
    setStatus("");
    try { await writeSite(site, { [key]: value }); await reload(); } catch (e) { onError(e); }
  };
  const c = cost(d.ff_stats || {});
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5">
      <div className="flex flex-col gap-2.5">
        <header className="pop-head flex items-center justify-between gap-3" id="row-on">
          <div className="flex min-w-0 items-center gap-2.5">
            <SiteLogo id={site} size={24} className="site-name" />
            <h1 className="truncate text-base leading-6 font-semibold">{siteName(site)}</h1>
          </div>
          <Toggle id="on" checked={on} label={t("c.siteOn", { site: siteName(site) })} onChange={(v) => onToggle("on", v)} />
        </header>
        <section id="feats" aria-label={siteName(site)} className={cn("feat-group rounded-2xl bg-muted px-3.5 transition-opacity duration-150", !on && "opacity-50")}>
          <SiteRow id="fold" name={t(site === "hn" ? "c.siteFoldHN" : "c.siteFold")} checked={o.fold !== false} disabled={!on} onChange={(v) => onToggle("fold", v)} />
          <SiteRow id="translate" name={txLabel(site)} checked={o.translate !== false} disabled={!on} note={on ? txNote(d, st, site) : ""} onChange={(v) => onToggle("translate", v)} />
        </section>
      </div>
      <Alerts d={d} st={st} />
      <Here text={place.text} />
      <Today stats={d.ff_stats || {}} />
      {/* 花费那一句不折行（0.24：加了"反馈"以后英文、德文等 10 种语言把"约 $0.05"折到第二行）；放不下时右边两个控件整体换到下一行、靠右 */}
      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t pt-2.5">
        <span id="cost" className="text-sm whitespace-nowrap text-muted-foreground" title={c.title}>{c.text}</span>
        <span className="ms-auto flex items-center gap-3">
          {/* 建议与反馈（0.23）：打开设置页、停在那张卡片（邮箱写在那里、能复制；直接点 mailto 在没配邮件程序的电脑上没反应） */}
          <a href="#" id="feedback" className="text-sm text-muted-foreground no-underline hover:text-foreground"
            onClick={(e) => { e.preventDefault(); chrome.tabs.create({ url: chrome.runtime.getURL("options.html#feedback") }); window.close(); }}>{t("pop.feedback")}</a>
          <Button id="openOpts" variant="outline" size="sm" className="btn" onClick={() => chrome.runtime.openOptionsPage()}>{t("pop.settings")}</Button>
        </span>
      </footer>
      {status && <p id="status" className="text-xs text-destructive" role="status">{status}</p>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <DirectionProvider direction={document.documentElement.dir === "rtl" ? "rtl" : "ltr"}>
    <TipProvider><Popup /></TipProvider>
  </DirectionProvider>,
);
