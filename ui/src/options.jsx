// 设置页：每一项只留名字和控件，说明收进问号里（悬停就显示）。改了就存（每一项单独存、单独校验；key 填好点"保存"）。
// 三类清理用"宽松 / 标准 / 严格"三档，精确数字在收着的"高级"里。分组：清理规则 / 翻译 / 连接和费用 / 数据和隐私 / 高级。
// 0.19.2 起"要收起什么"和"本地规则"并成一张"清理规则"（用户：对用户来说处理垃圾的动作是"清理"，是不是本地的不重要）；
// key 能用的时候只在最左边打一个勾（不带圈，0.19.3）、不放"测试连接"（用户批的草图），用不了、没填、正在换的时候才有。
// 界面上的说法：0.18 起不说"折叠"，0.20.1 起也不说"收起"，说"清理"（用户："收起"不好理解）；"看回复里的图片"在清理规则那一组，默认关。
// 0.19 起每组是一张 shadcn/ui maia 的 Card，菜单、确认框、展开收起用 shadcn 的组件（底层 Base UI）。
// 0.20 起最上面是网站列表（不带标题，用户：草图上"网站"两个字多余），点进去是那个网站自己的一页（#site=reddit）：收起、翻译两个开关，
// 这个网站用得上的规则（默认跟"清理规则"那张卡片，改了就是这个网站单独的、标出来、能恢复），只有这个网站有的设置。
// 以前的"翻译增强""暂停"两个总开关去掉了（用户：各网站都能单独开关了，再有一个"所有网站"是多余的）。
import * as React from "react";
import { createRoot } from "react-dom/client";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { t, I18N, SETTINGS, PRICE, DAY, day, usd, send, failText, useStorage, writeSettings, writeSite, siteName, SiteLogo, levelName, cn,
  Help, Toggle, Levels, IconChevron, IconArrowLeft, IconCaret, IconCheck, IconLock, TipProvider, Toasts, toast, BAD_TONE, MUTED_TONE } from "./lib.jsx";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

I18N.apply();
// 只管翻译的设置：改了评论区不用重判
const TX_KEYS = new Set(["translate", "translateFill", "translateThreshold", "translateModel", "translateFallback"]);
// ff_keys：两个 key 填没填（0.28.12 起 key 本身存在后台的 IndexedDB 里，这边看不到；ff_key、ff_or_key 是旧版本的、后台会挪走）
const KEYS = ["ff_settings", "ff_keys", "ff_key", "ff_or_key", "ff_health", "ff_stats", "ff_confirmed_slogans"];
const hasKey = (d, which) => (d.ff_keys ? !!d.ff_keys[which] : !!String((which === "jev" ? d.ff_key : d.ff_or_key) || "").trim());

async function save(patch) {
  try {
    await writeSettings(patch);
    toast(Object.keys(patch).every((k) => TX_KEYS.has(k)) ? t("c.saved") : t("opt.savedRejudge"));
  } catch (e) { toast(failText(e), "err"); }
}
// 改某个网站的（null：恢复默认）
const saveSite = (site) => async (patch) => {
  try {
    await writeSite(site, patch);
    toast(Object.keys(patch).every((k) => TX_KEYS.has(k)) ? t("c.saved") : t("opt.savedRejudge"));
  } catch (e) { toast(failText(e), "err"); }
};

// 卡片里的一行：上面有分隔线（第一行没有）。名字（和问号）在前，控件在后；底下可以再挂一句小字
const ROW = "row border-t py-3 first:border-t-0";
const MAIN = "row-main flex min-w-0 flex-[1_1_12rem] items-center gap-1";
const CTRL = "row-ctrl ms-auto flex shrink-0 items-center gap-3";
const NAME = "row-name text-sm";
function Row({ name, help, children, note, id }) {
  return (
    <div className={cn(ROW, "flex flex-wrap items-center gap-x-3 gap-y-1.5")} id={id}>
      <div className={MAIN}>
        <span className={NAME}>{name}</span>
        {help && <Help label={t("c.helpFor", { name })}>{help}</Help>}
      </div>
      <div className={CTRL}>{children}</div>
      {note && <p className="row-note basis-full text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
// 一组一张卡片：标题（h2）、旁边一句小字（sub）和问号在上，下面一行一行；没有标题的卡片（网站列表、网站页的开关）直接一行一行。
// 上下留白对齐（0.21，用户：底部间距和顶部对不上）：标题离卡片上边、最后一行的字离下边都是 19px 左右——行自己上下各 12px，
// 所以有标题的卡片底下只留 7px（以前 16px，加上行的 12px 是 28px；量的是字的上下沿）
function Section({ id, title, sub, help, children, label }) {
  if (!title) return (
    <Card id={id} className="sec gap-0 py-1.5" aria-label={label}>
      <CardContent className="flex flex-col px-5">{children}</CardContent>
    </Card>
  );
  return (
    <Card id={id} className="sec gap-1 pt-4 pb-[7px]">
      <CardHeader className="px-5">
        <div className="flex items-center gap-1">
          <h2 className="font-heading text-base font-medium">{title}</h2>
          {sub && <span className="ms-1 text-sm text-muted-foreground">{sub}</span>}
          {help && <Help label={t("c.helpFor", { name: title })}>{help}</Help>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col px-5">{children}</CardContent>
    </Card>
  );
}
const P = ({ k, vars }) => <p>{t(k, vars)}</p>;
// 展开收起的面板：高度动画（Base UI 量好的 --collapsible-panel-height）；左右下留 1px，里面卡片的描边不被裁掉
const PANEL = "panel h-(--collapsible-panel-height) overflow-hidden px-px pb-px transition-[height] duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0";

// ---------- 清理什么 ----------
// 网站页上的一行和默认不一样时：小字写"单独设置（默认：标准）· 恢复默认"（base：默认的那一份，keys：这一行管的几项里改过的）
function Override({ base, keys, levels, onReset }) {
  const v = keys.map((k) => (typeof base[k] === "boolean" ? t(base[k] ? "opt.valOn" : "opt.valOff") : levelName(base[k], levels))).join(" · ");
  return (
    <span className="override text-primary">
      {t("opt.override", { v })} · <button type="button" className="reset cursor-pointer font-medium underline-offset-4 hover:underline" onClick={onReset}>{t("opt.resetDefault")}</button>
    </span>
  );
}
// 一类：三档 + 开关。put：改了存到哪（默认的那一份，或者某个网站）；site：在网站页上时 {base: 默认的那一份, over: 这个网站改过的项, off: 这个网站关着收起}
const CATS = { spam: ["opt.spam", "opt.spamHint", "threshold", [0.7, 0.6, 0.5], null], abuse: ["opt.abuse", "opt.abuseHint", "abuseThreshold", [0.8, 0.7, 0.6], "abuse"],
  sexual: ["opt.sexual", "opt.sexualHint", "sexualThreshold", [0.7, 0.6, 0.5], "sexual"] };
function Category({ cat, s, put = save, site }) {
  const [name, hint, levelKey, levels, toggleKey] = CATS[cat];
  const v = s[levelKey], on = toggleKey ? !!s[toggleKey] : true;
  const custom = !levels.some((x) => Math.abs(x - v) < 1e-9);
  const changed = site ? [levelKey, toggleKey].filter((k) => k && k in site.over) : [];
  const note = changed.length ? <Override base={site.base} keys={changed} levels={levels} onReset={() => put(Object.fromEntries(changed.map((k) => [k, null])))} />
    : custom ? t("opt.custom", { v }) : null;
  return (
    <Row name={t(name)} help={<P k={hint} />} note={note} id={`row-${levelKey}`}>
      <Levels value={v} levels={levels} label={t(name)} disabled={!on || site?.off} onChange={(x) => put({ [levelKey]: x })} />
      {toggleKey && <Toggle id={toggleKey} checked={on} label={t(name)} disabled={site?.off} onChange={(x) => put({ [toggleKey]: x })} />}
    </Row>
  );
}
// 一个开关的一行，网站页上也能标"单独设置"
function SwitchRow({ k, name, hint, hintVars, s, put = save, site, disabled }) {
  const changed = site && k in site.over;
  return (
    <Row name={t(name)} help={<P k={hint} vars={hintVars} />} id={`row-${k}`}
      note={changed ? <Override base={site.base} keys={[k]} onReset={() => put({ [k]: null })} /> : null}>
      <Toggle id={k} checked={!!s[k]} label={t(name)} disabled={disabled || site?.off} onChange={(x) => put({ [k]: x })} />
    </Row>
  );
}
// 看回复里的图片（0.18，默认关）：打开时先向浏览器要读这几个图片网站的权限（settings.js 的 IMAGE_ORIGINS，manifest 里是可选权限），
// 不给就不打开；关掉时、哪个网站都不看图了，把权限还回去。chrome.permissions.request 要在点击里直接调，前面不能先 await 别的。
// raw：存着的整份设置（算"关了这一处以后还有没有网站在看图"）
// value：false 关掉、null 恢复默认（这个网站跟着默认的走）。改完以后哪个网站都不看图了就把权限还回去
// （0.28.8，review：以前只有拨开关时还，点"恢复默认"关掉的不还）
function releaseImagesAfter(raw, siteId, value) {
  const after = SETTINGS.normalize(raw);
  if (siteId) {
    const own = { ...(after.sites[siteId] || {}) };
    if (value === null) delete own.images; else own.images = value;
    after.sites = { ...after.sites, [siteId]: own };
  } else after.images = value;
  if (!SETTINGS.SITES.some((x) => x.rules.includes("images") && SETTINGS.forSite(after, x.id).images)) chrome.permissions.remove({ origins: [...SETTINGS.IMAGE_ORIGINS] }).catch(() => {});
}
function ImagesRow({ s, raw, put = save, site, siteId }) {
  const onChange = async (on) => {
    const origins = [...SETTINGS.IMAGE_ORIGINS];
    if (on) {
      let ok = false;
      try { ok = await chrome.permissions.request({ origins }); } catch (e) { ok = false; }
      if (!ok) { toast(t("opt.imagesDenied"), "err"); return; }
    } else releaseImagesAfter(raw, siteId, false);
    put({ images: on });
  };
  const changed = site && "images" in site.over;
  return (
    <Row name={t("opt.images")} help={<P k="opt.imagesHint" />} id="row-images"
      note={changed ? <Override base={site.base} keys={["images"]} onReset={() => { releaseImagesAfter(raw, siteId, null); put({ images: null }); }} /> : null}>
      <Toggle id="images" checked={!!s.images} label={t("opt.images")} disabled={site?.off} onChange={onChange} />
    </Row>
  );
}
// 你标记的垃圾（0.26 起；以前叫"你记住的句子"）：原文、在哪个网站标的，能逐条删、全部删。新的在上面
function Slogans() {
  const [list, setList] = React.useState(null);
  const load = React.useCallback(async () => {
    try {
      const { slogans } = await send({ type: "sloganList" });
      if (!Array.isArray(slogans)) throw new Error(t("c.badData"));
      setList(slogans);
    } catch (e) { toast(failText(e), "err"); }
  }, []);
  React.useEffect(() => {
    load();
    const f = (ch, area) => { if (area === "local" && ch.ff_confirmed_slogans) load(); };
    chrome.storage.onChanged.addListener(f);
    return () => chrome.storage.onChanged.removeListener(f);
  }, [load]);
  const act = (msg, done) => async () => { try { await send(msg); await load(); toast(done); } catch (e) { toast(failText(e), "err"); } };
  const n = list ? list.length : 0;
  return (
    <Collapsible className={cn(ROW, "row-col flex flex-col")} id="row-slogans">
      <div className="row-top flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className={MAIN}>
          <span className={NAME}>{t("opt.slogans")}</span>
          <Help label={t("c.helpFor", { name: t("opt.slogans") })}><P k="opt.sloganHint" /></Help>
          <span className="ms-1.5 text-sm text-muted-foreground tabular-nums" id="sloganCount">{t("opt.sloganN", { n })}</span>
        </div>
        {n > 0 && (
          <div className={CTRL}>
            <CollapsibleTrigger id="sloganToggle" render={<Button variant="ghost" size="sm" className="btn group" />}>{t("opt.manage")} <IconChevron /></CollapsibleTrigger>
          </div>
        )}
      </div>
      <CollapsibleContent className={PANEL}>
        <ul className="mt-2 flex flex-col" id="slogans">
          {[...(list || [])].reverse().map((x, i) => (
            <li key={`${x.source?.id || ""}|${x.text}|${i}`} className="flex items-center gap-2 border-t py-1.5">
              <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
                {x.raw || x.text}
                {x.site ? <span className="ms-1.5 text-xs text-muted-foreground">{siteName(x.site)}</span> : null}
              </span>
              <Button variant="ghost" size="sm" className="btn" onClick={act({ type: "sloganRemove", text: x.text, id: x.source?.id || null }, t("opt.forgotOne"))}>{t("opt.forgetOne")}</Button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t pt-1.5">
          <Button id="clearSlogans" variant="ghost" size="sm" className="btn text-destructive hover:text-destructive" onClick={act({ type: "sloganClear" }, t("c.cleared"))}>{t("opt.clearSlogans")}</Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
// 清理规则（所有网站的默认）：三类、「赞」「mark」这类（0.22）、看图片、刷同一句话、记住的句子，一张卡片
function Fold({ s, raw }) {
  return (
    <Section id="fold" title={t("opt.foldTitle")} sub={t("opt.foldDefault")} help={<P k="opt.foldHint" />}>
      <Category cat="spam" s={s} />
      <Category cat="abuse" s={s} />
      <Category cat="sexual" s={s} />
      <SwitchRow k="filler" name="opt.filler" hint="opt.fillerHint" s={s} />
      <ImagesRow s={s} raw={raw} />
      <SwitchRow k="dup" name="opt.dup" hint="opt.dupHint" s={s} />
      <Slogans />
    </Section>
  );
}

// ---------- 网站 ----------
// 首页最上面：每个网站一行（前面是这个网站的 logo，0.20.1），右边写开着什么、有几项单独改过，点进去改
function SiteList({ raw }) {
  const base = SETTINGS.normalize(raw);
  return (
    <Section id="sites" label={t("opt.sites")}>
      {SETTINGS.SITES.map((x) => {
        const s = SETTINGS.forSite(raw, x.id), o = base.sites[x.id] || {};
        const n = x.rules.filter((k) => k in o).length;
        const state = s.enabled && s.translate ? "opt.site.both" : s.enabled ? "opt.site.foldOnly" : s.translate ? "opt.site.txOnly" : "opt.site.off";
        return (
          <a key={x.id} href={`#site=${x.id}`} id={`site-${x.id}`}
            className={cn(ROW, "site-row flex items-center gap-3 text-foreground no-underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50")}>{/* 不带圆角：上边框会跟着圆角弯（用户 10-17：分割线变弯了） */}
            <SiteLogo id={x.id} size={22} />
            <span className={NAME}>{siteName(x.id)}</span>
            <span className="ms-auto flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
              <span className="site-state">{t(state)}</span>
              {n > 0 && <>· <span className="site-custom text-primary">{t("opt.site.custom", { n })}</span></>}
              <IconChevron />
            </span>
          </a>
        );
      })}
    </Section>
  );
}
// 点进一个网站：两个开关；清理什么（这个网站用得上的，默认跟"清理规则"，改了的标出来）；只有这个网站有的设置
function SitePage({ id, d }) {
  const raw = d.ff_settings, base = SETTINGS.normalize(raw), s = SETTINGS.forSite(raw, id), x = SETTINGS.SITES.find((y) => y.id === id);
  const put = saveSite(id);
  const o = base.sites[id] || {}, on = o.on !== false; // 开关上显示存着的值（总开关关着时 s 里清理、翻译都是关）
  const site = { base, over: Object.fromEntries(Object.entries(o).filter(([k]) => x.rules.includes(k))), off: !s.enabled };
  const has = (k) => x.rules.includes(k);
  const foldName = t(id === "hn" ? "c.siteFoldHN" : "c.siteFold");
  return (
    <>
      {/* 返回：左上角一个圆形的箭头按钮，和网站的 logo、名字一行（0.21，照 Chrome 设置的子页；用户：以前那个"‹ 设置"太糙） */}
      <div className="flex items-center gap-2.5 px-1">
        <a href="#" id="back" aria-label={t("opt.backTo")} title={t("opt.backTo")}
          className="back -ms-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-foreground no-underline outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-foreground/[0.06] focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.96]">
          <IconArrowLeft />
        </a>
        <SiteLogo id={id} size={26} />
        <h1 className="text-xl font-semibold" id="siteTitle">{siteName(id)}</h1>
      </div>
      {/* 总开关在最上面（和弹窗第一行一样），下面两项这个网站关着时灰掉 */}
      <Section id="siteMain" label={siteName(id)}>
        <Row name={t("c.siteOn", { site: siteName(id) })} id="row-on">
          <Toggle id="on" checked={on} label={t("c.siteOn", { site: siteName(id) })} onChange={(v) => put({ on: v })} />
        </Row>
        <Row name={foldName} help={<P k={`opt.foldOn.${id}`} />} id="row-fold">
          <Toggle id="fold" checked={o.fold !== false} disabled={!on} label={foldName} onChange={(v) => put({ fold: v })} />
        </Row>
        <Row name={t("c.siteTx")} help={<><P k={`opt.txOn.${id}`} /><P k="opt.txLang" /></>} id="row-translate">
          <Toggle id="translate" checked={o.translate !== false} disabled={!on} label={t("c.siteTx")} onChange={(v) => put({ translate: v })} />
        </Row>
      </Section>
      <Section id="siteFold" title={t("opt.whatFold")}>
        {has("threshold") && <Category cat="spam" s={s} put={put} site={site} />}
        <Category cat="abuse" s={s} put={put} site={site} />
        <Category cat="sexual" s={s} put={put} site={site} />
        {has("filler") && <SwitchRow k="filler" name="opt.filler" hint="opt.fillerHint" s={s} put={put} site={site} />}
        {has("images") && <ImagesRow s={s} raw={raw} put={put} site={site} siteId={id} />}
        {has("dup") && <SwitchRow k="dup" name="opt.dup" hint="opt.dupHint" s={s} put={put} site={site} />}
        {id === "x" && <SwitchRow k="m1" name="opt.m1" hint="opt.m1Hint" hintVars={{ n: s.m1MaxLen, m: s.m1MaxLen * 4 }} s={s} disabled={site.off} />}
      </Section>
      {/* 只有这个网站有的高级设置收着（0.21，用户：补翻作者自己的回复是高级设置，不该在最上面）：X 的补翻（Reddit 的评测记录 0.24 去掉了） */}
      {id === "x" && (
        <Collapsible className="flex flex-col gap-2" id="siteAdv">
          <CollapsibleTrigger id="siteAdvTrigger" render={<Button variant="ghost" size="sm" className="adv-trigger group w-fit gap-1 ps-2 text-muted-foreground" />}>
            <IconChevron /> {t("opt.advTitle")}
          </CollapsibleTrigger>
          <CollapsibleContent className={PANEL}>
            <Section id="siteAdvCard">
              <SwitchRow k="translateFill" name="opt.translateFill" hint="opt.translateFillHint" s={s} disabled={!s.translate} />
            </Section>
          </CollapsibleContent>
        </Collapsible>
      )}
      {/* YouTube 的字幕（0.29.0，用户 10-19 定：开关放在 YouTube 的设置里、默认开）：繁体字幕显示成简体；自动翻译的字幕差了重翻 */}
      {id === "yt" && (
        <Collapsible className="flex flex-col gap-2" id="siteAdv">
          <CollapsibleTrigger id="siteAdvTrigger" render={<Button variant="ghost" size="sm" className="adv-trigger group w-fit gap-1 ps-2 text-muted-foreground" />}>
            <IconChevron /> {t("opt.advTitle")}
          </CollapsibleTrigger>
          <CollapsibleContent className={PANEL}>
            <Section id="siteAdvCard">
              <SwitchRow k="captionConvert" name="opt.captionConvert" hint="opt.captionConvertHint" s={s} disabled={!s.translate} />
              <SwitchRow k="captionFix" name="opt.captionFix" hint="opt.captionFixHint" s={s} disabled={!s.translate} />
            </Section>
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
}

// ---------- 连接和费用 ----------
function stateOf(hasKey, code) {
  return !hasKey ? [MUTED_TONE, "opt.state.none"] : code === "or_credit" || code === "credit" ? [BAD_TONE, "opt.state.credit"] : code ? [BAD_TONE, "opt.state.bad"] : [null, "opt.state.ok"];
}
// link：去哪里拿 key（0.23，开源前检查：界面上没有一处告诉人去哪拿）；note：名字下面常显的一句（首次设置那一页用，设置页用问号）
// has：这个 key 填了没有（key 本身在后台，这一页看不到；存 key 走后台的 setKey，0.28.12）
function KeyRow({ id, name, hint, has, code, placeholder, test, link, note }) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [msg, setMsg] = React.useState(null);
  const [tone, stateKey] = stateOf(has, code);
  const open = editing || !has, usable = stateKey === "opt.state.ok";
  const doSave = async () => {
    if (!value.trim()) { setMsg([t("err.nokey"), "err"]); return; } // 空的不存（0.28.8 以前会把存着的 key 清掉、还说"已保存"）
    try {
      await send({ type: "setKey", which: id, value: value.trim() });
      setEditing(false); setValue(""); setMsg(null); toast(t("c.saved"));
    } catch (e) { setMsg([failText(e), "err"]); }
  };
  const doTest = async () => {
    setMsg([t("c.testing"), ""]);
    try { setMsg([await test(open ? value.trim() : ""), "ok"]); } catch (e) { setMsg([failText(e), "err"]); } // 空的：后台测存着的那个
  };
  const msgTone = msg && (msg[1] === "err" ? "text-destructive" : msg[1] === "ok" ? "text-green-700 dark:text-green-400" : "text-muted-foreground");
  return (
    <div className={cn(ROW, "row-col flex flex-col")} id={`row-${id}`}>
      <div className="row-top flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className={MAIN}>
          {/* 能用的在最左边打一个勾（0.19.3，用户：不要圈、放最左边）；别的状态这一格空着、两行的名字对齐（像苹果设置里已连接的那一项） */}
          <span className={cn("me-1 inline-flex size-4 shrink-0 text-green-700 dark:text-green-400", usable && "state")}
            {...(usable ? { id: `${id}State`, title: t(stateKey) } : { "aria-hidden": true })}>
            {usable && <><IconCheck className="size-4" /><span className="sr-only">{t(stateKey)}</span></>}
          </span>
          <span className={NAME}>{name}</span>
          {!note && <Help label={t("c.helpFor", { name })}><P k={hint} /></Help>}
          {!usable && <Badge id={`${id}State`} className={cn("state ms-1.5", tone)}>{t(stateKey)}</Badge>}
          {link && <a href={link} target="_blank" rel="noopener noreferrer" id={`${id}Get`} className="key-get ms-2 text-sm text-primary no-underline hover:underline">{t("welcome.getKey")} ↗</a>}
        </div>
        <div className={cn(CTRL, "gap-2")}>
          {!open && <Button variant="outline" size="sm" className="btn" id={`${id}Change`} onClick={() => { setEditing(true); setMsg(null); }}>{t("opt.change")}</Button>}
          {(!usable || open) && <Button variant="ghost" size="sm" className="btn" id={`${id}Test`} onClick={doTest}>{t("c.test")}</Button>}
        </div>
      </div>
      {open && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Input type="password" id={id === "jev" ? "key" : "orKey"} className="h-8 flex-[1_1_14rem] text-sm md:text-sm" autoComplete="off" spellCheck={false} placeholder={placeholder}
            aria-label={`${name} API key`} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doSave(); }} />
          <Button size="sm" className="btn" id={id === "jev" ? "saveKey" : "saveOrKey"} onClick={doSave}>{t("c.save")}</Button>
          {has && <Button variant="ghost" size="sm" className="btn" onClick={() => { setEditing(false); setValue(""); setMsg(null); }}>{t("c.cancel")}</Button>}
        </div>
      )}
      {note && <p className="row-note mt-1 text-xs text-muted-foreground" id={`${id}Note`}>{note}</p>}
      {msg && <p className={cn("row-note mt-2 text-xs", msgTone)} role="status" id={id === "jev" ? "keyMsg" : "orKeyMsg"}>{msg[0]}</p>}
    </div>
  );
}
// 首次设置那一页填 key（0.29.10，用户 10-23：字多、按钮链接多，不好看）：一行"用途 · 服务名"、右边"获取密钥"，下面输入框和保存，一句灰字。
// 不放"没填"和"测试连接"：保存时顺手测一次，能用打勾、不能用写原因（只说能不能用，不报分数）。设置页还是 KeyRow
function WelcomeKey({ id, name, has, code, placeholder, test, link, note }) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [msg, setMsg] = React.useState(null);
  const [tone, stateKey] = stateOf(has, code);
  const open = editing || !has, usable = stateKey === "opt.state.ok";
  const doSave = async () => {
    const v = value.trim();
    if (!v) { setMsg([t("err.nokey"), "err"]); return; }
    setMsg([t("c.testing"), ""]);
    try {
      await send({ type: "setKey", which: id, value: v });
      setEditing(false); setValue("");
      // 测出来不能用：输入框留着好马上改；密钥无效就直说，别的（网络之类）照旧"失败：……请重试"
      try { await test(v); setMsg([t("welcome.keyOk"), "ok"]); } catch (e) { setEditing(true); setMsg([/badkey$/.test(e?.code || "") ? t("welcome.keyBad") : failText(e), "err"]); }
    } catch (e) { setMsg([failText(e), "err"]); }
  };
  const msgTone = msg && (msg[1] === "err" ? "text-destructive" : msg[1] === "ok" ? "text-green-700 dark:text-green-400" : "text-muted-foreground");
  return (
    <div className={cn(ROW, "row-col flex flex-col gap-2")} id={`row-${id}`}>
      <div className="flex min-h-8 items-center gap-2">
        <span className={cn(NAME, "font-medium")}>{name}</span>
        {has && usable && <span className="state inline-flex text-green-700 dark:text-green-400" id={`${id}State`} title={t(stateKey)}><IconCheck className="size-4" /><span className="sr-only">{t(stateKey)}</span></span>}
        {has && !usable && !msg && <Badge id={`${id}State`} className={cn("state", tone)}>{t(stateKey)}</Badge>}
        <span className="ms-auto">
          {open ? <a href={link} target="_blank" rel="noopener noreferrer" id={`${id}Get`} className="key-get text-sm text-primary no-underline hover:underline">{t("welcome.getKey")} ↗</a>
            : <Button variant="outline" size="sm" className="btn" id={`${id}Change`} onClick={() => { setEditing(true); setMsg(null); }}>{t("opt.change")}</Button>}
        </span>
      </div>
      {open && (
        <div className="flex gap-2">
          <Input type="password" id={id === "jev" ? "key" : "orKey"} className="h-8 min-w-0 flex-1 text-sm md:text-sm" autoComplete="off" spellCheck={false} placeholder={placeholder}
            aria-label={`${name} API key`} value={value} onKeyDown={(e) => { if (e.key === "Enter") doSave(); }}
            onChange={(e) => { setValue(e.target.value); if (msg && msg[1] === "err") setMsg(null); }} />{/* 重新输入时收起上一次的报错 */}
          <Button size="sm" className="btn" id={id === "jev" ? "saveKey" : "saveOrKey"} onClick={doSave}>{t("c.save")}</Button>
          {has && <Button variant="ghost" size="sm" className="btn" onClick={() => { setEditing(false); setValue(""); setMsg(null); }}>{t("c.cancel")}</Button>}
        </div>
      )}
      {msg ? <p className={cn("row-note text-xs", msgTone)} role="status" id={id === "jev" ? "keyMsg" : "orKeyMsg"}>{msg[0]}</p>
        : open && note && <p className="row-note text-xs text-muted-foreground" id={`${id}Note`}>{note}</p>}
    </div>
  );
}
// 去哪里拿 key（用户 10-17 定：Jev 链到 TypeSafe 官网）
const KEY_URL = { jev: "https://typesafe.ai", or: "https://openrouter.ai/keys" };
// 按最近 7 天的花费估一个月：7 天的总花费按 7 天平均（刚装几天的按装了几天：最早有统计的那天起算）。
// 0.28.8 以前按"7 天里有统计的天数"平均，7 天只用了一天的会把那一天乘 30，最多高估 7 倍（review）
function costLine(stats) {
  const c = (s) => [((s.tokens || 0) + (s.tx_jev_tokens || 0)) * PRICE, s.tx_usd || 0];
  const month = day(new Date()).slice(0, 7);
  let jev = 0, or = 0, week = 0, used = false;
  for (const [d, s] of Object.entries(stats)) { const [a, b] = c(s); if (d.startsWith(month)) { jev += a; or += b; } }
  for (let i = 0; i < 7; i++) { const s = stats[day(new Date(Date.now() - i * DAY))]; if (s) { week += c(s)[0] + c(s)[1]; used = true; } }
  const first = Object.keys(stats).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()[0];
  const since = first ? Math.floor((Date.parse(day(new Date())) - Date.parse(first)) / DAY) + 1 : 7;
  const span = Math.min(7, Math.max(1, since));
  return t(used ? "opt.cost" : "opt.costNone", { jev: usd(jev), or: usd(or), month: usd(used ? (week / span) * 30 : 0) });
}
const testJev = async (key) => {
  const r = await send({ type: "testKey", key, lang: I18N.uiLang() });
  return t("opt.keyOk", { model: r.model, sample: r.sample, score: r.score.benefit.toFixed(2) });
};
const testOr = async (key) => {
  const r = await send({ type: "orTest", key, target: chrome.i18n.getUILanguage() });
  const think = r.reasoningTokens ? t("opt.orThink", { n: r.reasoningTokens }) : t("opt.orNoThink");
  return t("opt.orOk", { model: r.model, secs: r.secs.toFixed(1), think, text: r.text });
};
function Connections({ d }) {
  const h = d.ff_health || {};
  return (
    <Section id="conn" title={t("opt.connTitle")}>
      <KeyRow id="jev" name="Jev (TypeSafe)" hint="opt.jevHint" has={hasKey(d, "jev")} code={h.jev?.code} placeholder="apikey_…" test={testJev} link={KEY_URL.jev} />
      <KeyRow id="or" name="OpenRouter" hint="opt.orHint" has={hasKey(d, "or")} code={h.or?.code} placeholder="sk-or-…" test={testOr} link={KEY_URL.or} />
      <div className={ROW}><p className="text-sm text-muted-foreground" id="costLine">{costLine(d.ff_stats || {})}</p></div>
    </Section>
  );
}

// ---------- 数据和隐私 ----------
function Data({ d }) {
  const [cache, setCache] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const loadCache = React.useCallback(async () => {
    try {
      const r = await send({ type: "cacheStats" });
      if (!Number.isFinite(r.bytes) || !Number.isFinite(r.count)) throw new Error(t("c.badData"));
      const tx = r.tx && Number.isFinite(r.tx.bytes) ? r.tx : { bytes: 0, count: 0 };
      setCache(t("opt.cacheStats", { mb: (r.bytes / 1048576).toFixed(1), n: r.count, txmb: (tx.bytes / 1048576).toFixed(1), txn: tx.count }));
    } catch (e) { setCache(failText(e)); }
  }, []);
  React.useEffect(() => { loadCache(); }, [loadCache]);
  const run = (msg, done, after) => async () => { try { await send(msg); toast(done); after && (await after()); } catch (e) { toast(failText(e), "err"); } };
  const exportData = async () => {
    try {
      const r = await send({ type: "export" });
      if (!r.data || typeof r.data !== "object") throw new Error(t("c.badData"));
      const blob = new Blob([JSON.stringify(r.data, null, 1)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `clearflow-${day(new Date())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast(t("c.exported"));
    } catch (e) { toast(failText(e), "err"); }
  };
  const facts = <ul className="list-disc space-y-1 ps-4">{["opt.fact1", "opt.fact2", "opt.fact7", "opt.fact5", "opt.fact3", "opt.fact4", "opt.fact6"].map((k) => <li key={k}>{t(k)}</li>)}</ul>;
  return (
    <Section id="data" title={t("opt.dataTitle")} help={facts}>
      <div className={cn(ROW, "row-col flex flex-col")}>
        <div className="row-top flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="btn" id="export" onClick={exportData}>{t("opt.export")}</Button>
          <DropdownMenu>
            <DropdownMenuTrigger id="clearMenu" render={<Button variant="outline" size="sm" className="btn" />}>{t("opt.clearCacheMenu")} <IconCaret /></DropdownMenuTrigger>
            <DropdownMenuContent sideOffset={6} className="w-auto">
              <DropdownMenuItem className="menu-item" id="clearCache" onClick={run({ type: "cacheClear" }, t("c.cleared"), loadCache)}>{t("opt.clearCache")}</DropdownMenuItem>
              <DropdownMenuItem className="menu-item" id="clearTxCache" onClick={run({ type: "txCacheClear" }, t("opt.txCacheCleared"), loadCache)}>{t("opt.clearTxCache")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialog open={confirm} onOpenChange={setConfirm}>
            <AlertDialogTrigger id="clear" render={<Button variant="ghost" size="sm" className="btn ms-auto text-destructive hover:text-destructive" />}>{t("opt.clear")}</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("opt.clear")}</AlertDialogTitle>
                <AlertDialogDescription>{t("opt.confirmClear")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("c.cancel")}</AlertDialogCancel>
                <Button variant="destructive" id="clearConfirm"
                  onClick={async () => { setConfirm(false); await run({ type: "clearLog" }, t("c.cleared"))(); }}>{t("opt.clearNow")}</Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <p className="row-note mt-2 text-xs text-muted-foreground" id="cacheStats">{cache}</p>
      </div>
    </Section>
  );
}

// ---------- 高级（收着）：精确的阈值、长度、缓存、模型 ----------
const NUMS = [["threshold", "opt.threshold", 0.1, 0.99, "any"], ["recThreshold", "opt.recThreshold", 0.1, 0.99, "any"],
  ["abuseThreshold", "opt.abuseThreshold", 0.3, 0.99, "any"], ["sexualThreshold", "opt.sexualThreshold", 0.3, 0.99, "any"],
  ["m1MaxLen", "opt.m1MaxLen", 5, 40, "1"], ["bannerRatio", "opt.bannerRatio", 0.1, 1, "any"], ["cacheMB", "opt.cacheMB", 5, 500, "5"],
  ["txCacheMB", "opt.txCacheMB", 5, 500, "5"], ["translateThreshold", "opt.txThreshold", 0.3, 0.95, "any"]];
// 改完（离开输入框或回车）才存；不合规就提示、退回原来的值；别处改了、又没在改这一格，就跟着变
const FIELD = "field flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t py-2.5 first:border-t-0";
const FIELD_NAME = "flex min-w-0 flex-[1_1_16rem] flex-wrap items-center gap-1 text-sm";
function Field({ id, label, value, type = "number", min, max, step, list, help }) {
  const [v, setV] = React.useState(String(value ?? ""));
  const focused = React.useRef(false);
  React.useEffect(() => { if (!focused.current) setV(String(value ?? "")); }, [value]);
  const commit = async () => {
    focused.current = false;
    if (v === String(value ?? "")) return;
    try { await writeSettings({ [id]: v }); toast(TX_KEYS.has(id) ? t("c.saved") : t("opt.savedRejudge")); }
    catch (e) { toast(failText(e), "err"); setV(String(value ?? "")); }
  };
  return (
    <label className={FIELD}>
      <span className={FIELD_NAME}>{t(label)}{help && <Help label={t("c.helpFor", { name: t(label) })}>{help}</Help>}</span>
      <Input id={id} className={cn("h-8 text-sm md:text-sm", type === "number" ? "w-24 tabular-nums" : "w-60 max-w-full")} type={type} min={min} max={max} step={step} list={list} spellCheck={false}
        value={v} onFocus={() => { focused.current = true; }} onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
    </label>
  );
}
function Advanced({ s, d }) {
  return (
    <Collapsible className="flex flex-col gap-2" id="adv">
      <CollapsibleTrigger id="advTrigger" render={<Button variant="ghost" size="sm" className="adv-trigger group w-fit gap-1 ps-2 text-muted-foreground" />}>
        <IconChevron /> {t("opt.advTitle")}
      </CollapsibleTrigger>
      <CollapsibleContent className={PANEL}>
        <p className="px-1 pb-2 text-xs text-muted-foreground">{t("opt.advHint")}</p>
        <Card className="gap-0 py-1.5">
          <CardContent className="flex flex-col px-5">
            {NUMS.map(([k, label, min, max, step]) => <Field key={k} id={k} label={label} value={s[k]} min={min} max={max} step={step} />)}
            <Field id="translateModel" label="opt.model" value={s.translateModel} type="text" list="txModels" help={<P k="opt.modelHint" />} />
            <Field id="translateFallback" label="opt.fallback" value={s.translateFallback} type="text" list="txModels" />
            <div className={FIELD}>
              <span className={FIELD_NAME}>{t("opt.useJev")}</span>
              <Toggle id="useJev" checked={s.useJev} label={t("opt.useJev")} onChange={(x) => save({ useJev: x })} />
            </div>
          </CardContent>
        </Card>
        <a href="#welcome" id="rerunWelcome" className="mt-2 inline-block px-1 text-sm text-primary no-underline hover:underline">{t("opt.rerunWelcome")}</a>
        <datalist id="txModels">
          {["openai/gpt-6-luna", "deepseek/deepseek-v4.1-flash", "qwen/qwen3.8-flash", "anthropic/claude-haiku-5.5"].map((m) => <option key={m} value={m} />)}
        </datalist>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------- 建议与反馈（0.23，设置页最下面；弹窗上的"反馈"打开这里） ----------
// 邮箱用户定的。很多人没配邮件程序，点 mailto 没反应，所以邮箱写出来、能复制；"写邮件"带上版本、浏览器、界面语言，不带看过的内容
const FEEDBACK_MAIL = "developer@ohmyai.app";
function browserName() {
  const b = (navigator.userAgentData?.brands || []).filter((x) => !/not.?a.?brand/i.test(x.brand));
  const main = b.find((x) => x.brand !== "Chromium") || b[0];
  return main ? `${main.brand} ${main.version}` : "Chrome";
}
function Feedback() {
  const v = chrome.runtime.getManifest?.().version || "";
  const href = `mailto:${FEEDBACK_MAIL}?subject=${encodeURIComponent(t("fb.subject", { v }))}` +
    `&body=${encodeURIComponent(t("fb.body", { v, browser: browserName(), lang: I18N.uiLang() }))}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(FEEDBACK_MAIL); toast(t("fb.copied")); } catch (e) { toast(failText(e), "err"); }
  };
  return (
    <Section id="feedback" title={t("fb.title")}>
      <div className={cn(ROW, "row-col flex flex-col gap-2")}>
        <p className="text-sm">{t("fb.text")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span id="fbMail" className="font-mono text-sm select-all">{FEEDBACK_MAIL}</span>
          <span className="ms-auto flex gap-2">
            <Button variant="outline" size="sm" className="btn" id="fbCopy" onClick={copy}>{t("fb.copy")}</Button>
            <a id="fbWrite" href={href} target="_blank" rel="noopener" className={cn(buttonVariants({ size: "sm" }), "btn no-underline")}>{t("fb.write")}</a>
          </span>
        </div>
        <p className="row-note text-xs text-muted-foreground">{t("fb.note")}</p>
      </div>
    </Section>
  );
}

// ---------- 首次设置（0.23，装上以后自动打开 options.html#welcome；设置页"高级"里能再走一遍） ----------
// 用户 10-17 批的草图：三步——在哪些网站上用（每个网站一个总开关，开着的下面"清理""翻译"两个勾，默认全开）→ 填两个 key
// （各带"去哪里拿"，没选翻译就不问 OpenRouter，可以稍后再填）→ 好了（开着的网站各一个"去看看"）。改了就存，和设置页同一份
const SITE_HOME = { x: "https://x.com", reddit: "https://www.reddit.com", yt: "https://www.youtube.com", xhs: "https://www.xiaohongshu.com", hn: "https://news.ycombinator.com" };
function Check({ id, checked, disabled, label, onChange }) {
  return (
    <label className={cn("inline-flex items-center gap-1.5 text-sm", disabled && "opacity-50")}>
      <input type="checkbox" id={id} className="size-3.5 accent-primary" checked={!!checked} disabled={!!disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
function Welcome({ d }) {
  const [step, setStep] = React.useState(1);
  const raw = d.ff_settings, base = SETTINGS.normalize(raw), h = d.ff_health || {};
  const put = (id, patch) => writeSite(id, patch).catch((e) => toast(failText(e), "err"));
  const on = SETTINGS.SITES.filter((x) => (base.sites[x.id] || {}).on !== false);
  const anyTx = SETTINGS.SITES.some((x) => SETTINGS.forSite(raw, x.id).translate);
  const finish = async () => {
    try { await chrome.storage.local.set({ ff_onboarded: Date.now() }); } catch (e) { /* 下次不弹也无所谓 */ }
    chrome.tabs.getCurrent((tab) => { if (tab && tab.id != null) chrome.tabs.remove(tab.id); else location.hash = ""; });
  };
  const nav = (
    <div className="flex items-center justify-between gap-3 px-1" id="welcomeNav">
      <div className="flex gap-1.5" aria-hidden="true">{[1, 2, 3].map((n) => <span key={n} className={cn("size-1.5 rounded-full", n === step ? "bg-foreground" : "bg-foreground/20")} />)}</div>
      <div className="flex items-center gap-2">
        {step > 1 && <Button variant="ghost" size="sm" className="btn" id="welcomeBack" onClick={() => setStep(step - 1)}>{t("welcome.back")}</Button>}
        {/* 第 2 步一个都没填：同一个按钮写"稍后再填"（0.29.10 以前"稍后再填""下一步"两个按钮做同一件事） */}
        {step < 3 ? <Button size="sm" className="btn" id="welcomeNext" onClick={() => setStep(step + 1)}>{t(step === 2 && !hasKey(d, "jev") && !hasKey(d, "or") ? "welcome.later" : "welcome.next")}</Button>
          : <Button size="sm" className="btn" id="welcomeDone" onClick={finish}>{t("welcome.finish")}</Button>}
      </div>
    </div>
  );
  return (
    <>
      <div className="flex flex-col gap-1 px-1">
        <p className="text-sm text-muted-foreground" id="welcomeStep">{t("welcome.step", { n: step, m: 3 })}</p>
        <h1 className="text-xl font-semibold" id="welcomeTitle">{t(step === 1 ? "welcome.sitesTitle" : step === 2 ? "welcome.keysTitle" : "welcome.doneTitle")}</h1>
      </div>
      {step === 1 && (
        <Section id="welcomeSites" label={t("welcome.sitesTitle")}>
          {SETTINGS.SITES.map((x) => {
            const o = base.sites[x.id] || {}, siteOn = o.on !== false;
            return (
              <div key={x.id} className={cn(ROW, "row-col flex flex-col gap-2")} id={`w-${x.id}`}>
                <div className="flex items-center gap-2.5">
                  <SiteLogo id={x.id} size={20} />
                  <span className={NAME}>{siteName(x.id)}</span>
                  <span className="ms-auto"><Toggle id={`w-${x.id}-on`} checked={siteOn} label={t("c.siteOn", { site: siteName(x.id) })} onChange={(v) => put(x.id, { on: v })} /></span>
                </div>
                {siteOn && (
                  <div className="flex flex-wrap gap-x-5 gap-y-1 ps-[30px]">
                    <Check id={`w-${x.id}-fold`} checked={o.fold !== false} label={t(x.id === "hn" ? "c.siteFoldHN" : "c.siteFold")} onChange={(v) => put(x.id, { fold: v })} />
                    <Check id={`w-${x.id}-tx`} checked={o.translate !== false} label={t("c.siteTx")} onChange={(v) => put(x.id, { translate: v })} />
                  </div>
                )}
              </div>
            );
          })}
          <div className={ROW}><p className="text-xs text-muted-foreground">{t("welcome.sitesNote")}</p></div>
        </Section>
      )}
      {step === 2 && (
        <>
          <div className="flex flex-col gap-1.5 px-1 text-sm text-muted-foreground">
            <p id="welcomeKeysIntro">{t("welcome.keysIntro")}</p>
            {/* key 放在哪（用户 10-18：引导页上要告诉用户密钥是放本地的）：单独一行带锁，填之前就看得到 */}
            <p className="flex items-start gap-2" id="welcomeKeysLocal"><IconLock className="mt-0.5 size-4 shrink-0" />{t("welcome.keysLocal")}</p>
          </div>
          <Section id="welcomeKeys" label={t("welcome.keysTitle")}>
            <WelcomeKey id="jev" name={t("welcome.jevName")} has={hasKey(d, "jev")} code={h.jev?.code} placeholder="apikey_…" test={testJev} link={KEY_URL.jev} note={t("welcome.jevNote")} />
            {anyTx && <WelcomeKey id="or" name={t("welcome.orName")} has={hasKey(d, "or")} code={h.or?.code} placeholder="sk-or-…" test={testOr} link={KEY_URL.or} note={t("welcome.orNote")} />}
          </Section>
        </>
      )}
      {step === 3 && (
        <Section id="welcomeDoneCard" label={t("welcome.doneTitle")}>
          <div className={cn(ROW, "row-col flex flex-col gap-3")}>
            <p className="text-sm" id="welcomeDoneText">{t(on.length ? "welcome.doneText" : "welcome.doneNone")}</p>
            {on.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" id="welcomeVisit">
                {/* 按钮上只写网站名（"去 小红书 看看"中文名两边多了空格）；整句留给读屏和鼠标提示 */}
                <span className="text-sm text-muted-foreground">{t("welcome.visitLabel")}</span>
                {on.map((x) => (
                  <a key={x.id} href={SITE_HOME[x.id]} target="_blank" rel="noopener noreferrer" aria-label={t("welcome.visit", { site: siteName(x.id) })} title={t("welcome.visit", { site: siteName(x.id) })}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "btn gap-1.5 no-underline")}>
                    <SiteLogo id={x.id} size={14} />{siteName(x.id)}
                  </a>
                ))}
              </div>
            )}
            {!hasKey(d, "jev") && <p className="text-sm text-amber-800 dark:text-[#ffc46b]" id="welcomeNoKey">{t("welcome.doneNoKey")}</p>}
            <p className="text-xs text-muted-foreground">{t("welcome.donePopup")}</p>
            <div><Button variant="outline" size="sm" className="btn" id="welcomeOpts" onClick={() => { chrome.storage.local.set({ ff_onboarded: Date.now() }).catch(() => {}); location.hash = ""; }}>{t("welcome.openSettings")}</Button></div>
          </div>
        </Section>
      )}
      {nav}
    </>
  );
}

// #site=reddit 网站那一页；#welcome 首次设置（0.23）；#feedback 主页、停在"建议与反馈"那张卡片（弹窗上的"反馈"）
const routeOf = () => {
  if (location.hash === "#welcome") return "welcome";
  const m = /^#site=(\w+)$/.exec(location.hash);
  return m && SETTINGS.SITES.some((x) => x.id === m[1]) ? m[1] : null;
};
const toFeedback = () => { if (location.hash === "#feedback") requestAnimationFrame(() => document.getElementById("feedback")?.scrollIntoView({ block: "start" })); };
function Options() {
  const [d] = useStorage(KEYS);
  const [route, setRoute] = React.useState(routeOf);
  React.useEffect(() => {
    const f = () => { setRoute(routeOf()); window.scrollTo(0, 0); toFeedback(); };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  React.useEffect(() => { if (d) toFeedback(); }, [!!d]);
  React.useEffect(() => {
    document.title = route === "welcome" ? t("welcome.title") : route ? `${siteName(route)} · ${t("opt.title")}` : t("opt.title");
  }, [route]);
  if (!d) return null;
  const s = SETTINGS.normalize(d.ff_settings);
  return (
    <main className="mx-auto flex max-w-[640px] flex-col gap-5 px-5 pt-7 pb-20">
      {route === "welcome" ? <Welcome d={d} /> : route ? <SitePage id={route} d={d} /> : <>
        <h1 className="px-1 text-xl font-semibold">{t("opt.h1")}</h1>
        <SiteList raw={d.ff_settings} />
        <Fold s={s} raw={d.ff_settings} />
        <Connections d={d} />
        <Data d={d} />
        <Advanced s={s} d={d} />
        <Feedback />
      </>}
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <DirectionProvider direction={document.documentElement.dir === "rtl" ? "rtl" : "ltr"}>
    <TipProvider><Toasts><Options /></Toasts></TipProvider>
  </DirectionProvider>,
);
