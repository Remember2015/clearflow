// 清流会员（0.30.0，草图批了，用户 10-24：文字要简单、少解释）：设置页"连接"里的模式切换、登录（邮箱验证码，在插件里填）、账号信息，
// "开通清流会员"选套餐和等付款，弹窗上的状态行和提示卡。0.30.1（用户 10-25 批的草图）：账号和开通合成一张（MemberPanel），
// 上面是状态（试用还剩几天 / 会员），下面选套餐（年付默认、标"推荐"）和"去付款 · 价格"；会等的按钮转圈、换成进行中的字（BusyButton）。数据都从 storage.local 的 ff_account 来（后台 account.js 写，没有令牌），
// 操作都发给后台（{type: "account", op}）。价格写死在这里，和 Waffo 的商品、官网价格页一致（用户 10-24 定）
import * as React from "react";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { t, I18N, cn, send, failText, writeSettings, toast, WARN_TONE, BAD_TONE, MUTED_TONE, IconChevron, IconCaret } from "./lib.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const PRICES = { monthly: "$2.90", yearly: "$24", pass30: "$3.90", pass365: "$39" };
const DAY = 864e5;
const daysLeft = (ts) => Math.max(0, Math.ceil((ts - Date.now()) / DAY));
// 日期：今年的只写月日，跨年的（1 年那种）带上年份
const date = (ts) => new Date(ts).toLocaleDateString(I18N.uiLang(), { ...(new Date(ts).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}), month: "short", day: "numeric" });
const pct = (x) => `${Math.round(Math.min(1, x || 0) * 100)}%`;
const acct = (op, extra = {}) => send({ type: "account", op, ...extra });
// 报错只说人话：认得的错误码有自己的一句，认不出的（token_revoked 这类）统一"出错了，稍后再试"，不把代码露给用户（用户 10-25）
const errText = (e) => {
  const key = `acct.err.${e?.code || ""}`, s = t(key);
  return s && s !== key ? s : t("acct.err.other");
};
async function run(op, extra) {
  const r = await chrome.runtime.sendMessage({ type: "account", op, ...extra });
  if (!r || r.ok === false) throw Object.assign(new Error(r?.error || "network"), { code: r?.error || "network", devices: r?.devices });
  return r;
}
export const openPage = (hash) => { chrome.tabs.create({ url: chrome.runtime.getURL(`options.html#${hash}`) }); window.close?.(); };
// 登录在官网上（0.32.0，用户 10-25）：点了开官网的确认页，后台等确认（ff_account.login；见 background.js startLogin）。intent {pay: 套餐}：登录上了接着开付款页
export const loginPending = (a) => !!a?.login && !a.login.error;
export const startWebLogin = (intent) => run("loginStart", intent ? { intent } : {});

// ---------- 状态 ----------
// 登录着（ff_account 有邮箱、没被踢出）
export const signedIn = (a) => !!a && !a.signedOut && !!a.email;
export const usable = (a) => signedIn(a) && ["trialing", "active", "canceled", "past_due"].includes(a.status);
const isPass = (a) => a.kind === "pass";
// 套餐叫什么：试用、月付、年付、30 天、1 年
const planName = (a) => t(a.plan === "trial" ? "acct.plan.trial" : isPass(a) ? (a.plan === "yearly" ? "acct.plan.pass365" : "acct.plan.pass30") : a.plan === "yearly" ? "acct.plan.yearly" : "acct.plan.monthly");
// 一句话的套餐状态（设置页账号那一行、弹窗底部）
export function planLine(a) {
  if (!signedIn(a)) return t(a?.signedOut ? "acct.line.signedOut" : "acct.line.out");
  if (!usable(a)) return t("acct.line.none");
  if (a.plan === "trial") return t("acct.line.trial", { date: date(a.periodEnd) });
  if (a.status === "past_due") return t("acct.line.pastDue", { plan: planName(a) });
  if (a.renews) return t("acct.line.renews", { plan: planName(a) });
  return t("acct.line.until", { plan: planName(a), date: date(a.periodEnd) });
}
// 用量占比（试用看今天，会员看本月）
export const usageOf = (a) => (!usable(a) || !a.usage ? null : a.plan === "trial" ? { label: t("acct.usedToday"), v: a.usage.today } : { label: t("acct.usedMonth"), v: a.usage.month ?? a.usage.today });
export const popupLine = (a) => {
  const u = usageOf(a);
  return u ? `${planLine(a)} · ${u.label} ${pct(u.v)}` : planLine(a);
};
// 要用户处理的事（弹窗的提示卡）：[语气, 文字, 按钮…]；按钮 [文字键, 动作, 主要?]。没事返回 null
export function accountAlert(a) {
  const subscribe = ["acct.subscribe", () => openPage("plans"), true], useKey = ["acct.useKey", () => openPage("conn")];
  if (!signedIn(a) && loginPending(a)) return [MUTED_TONE, t("acct.web.waiting"), [["c.cancel", () => run("loginCancel").catch(() => {})]]];
  if (!signedIn(a)) return [WARN_TONE, t(a?.signedOut ? "acct.alert.signedOut" : "acct.alert.out"), [["acct.signIn", () => startWebLogin().then(() => window.close?.(), (e) => toast(errText(e), "err")), true, "acct.busy.opening"]]];
  if (!a.status) return null; // 刚登录、状态还没拉到
  if (!usable(a)) return [WARN_TONE, t(a.lastPlan === "trial" || !a.lastPlan ? "acct.alert.trialEnded" : "acct.alert.memberEnded"), [subscribe, useKey]];
  if (a.status === "past_due") return [BAD_TONE, t("acct.alert.pastDue"), [["acct.manage", () => run("portal").catch((e) => toast(errText(e), "err")), true, "acct.busy.opening"]]];
  if (a.usage?.month != null && a.usage.month >= 1) return [WARN_TONE, t("acct.alert.quotaMonth"), [useKey]];
  if (a.usage?.today >= 1) return [WARN_TONE, t(a.plan === "trial" ? "acct.alert.quotaTrial" : "acct.alert.quotaDay"), a.plan === "trial" ? [subscribe] : []];
  if (a.plan === "trial") return [MUTED_TONE, t("acct.alert.trialLeft", { n: daysLeft(a.periodEnd) }), [subscribe]];
  if (isPass(a) && daysLeft(a.periodEnd) <= (a.plan === "yearly" ? 7 : 3)) return [WARN_TONE, t("acct.alert.endsSoon", { n: daysLeft(a.periodEnd) }), [["acct.renew", () => openPage("plans"), true]]];
  return null;
}
// 会等的按钮（用户 10-25）：点了转圈、换成进行中的字、不能再点；做完恢复。onClick 抛错由调用方处理（这里只管样子）
export function Spinner({ className }) {
  return <svg className={cn("size-4 shrink-0 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity=".25" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>;
}
export function BusyButton({ onClick, busyLabel, children, disabled, ...props }) {
  const [busy, setBusy] = React.useState(false);
  const go = async (e) => {
    if (busy) return;
    setBusy(true);
    try { await onClick?.(e); } finally { setBusy(false); }
  };
  return (
    <Button {...props} disabled={disabled || busy} aria-busy={busy || undefined} onClick={go}>
      {busy ? <><Spinner />{busyLabel ? t(busyLabel) : children}</> : children}
    </Button>
  );
}

export function AlertCard({ alert, id = "acctAlert" }) {
  if (!alert) return null;
  const [tone, text, buttons] = alert;
  return (
    <div className={cn("alert flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl px-3.5 py-2.5 text-sm", tone)} id={id} role="status">
      <p className="min-w-0 flex-[1_1_9rem]">{text}</p>
      {buttons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {buttons.map(([k, fn, primary, busy]) => <BusyButton key={k} size="sm" variant={primary ? "default" : "outline"} className="btn" busyLabel={busy} onClick={fn}>{t(k)}</BusyButton>)}
        </div>
      )}
    </div>
  );
}

// ---------- 用哪种：清流会员 / 自己的密钥（分段控件，样式同 lib.jsx 的 Levels） ----------
export function ModeSwitch({ account, id = "mode" }) {
  const set = (v) => writeSettings({ account: v === "account" }).catch((e) => toast(failText(e), "err"));
  return (
    <RadioGroup id={id} className="seg inline-flex w-fit shrink-0 items-center gap-0.5 rounded-[10px] bg-seg-track p-0.5" aria-label={t("acct.mode")}
      value={account ? "account" : "own"} onValueChange={set}>
      {["account", "own"].map((v) => (
        <Radio.Root key={v} value={v} data-mode={v}
          className="seg-item inline-flex h-7 cursor-pointer items-center justify-center rounded-[8px] px-3.5 text-[13px] whitespace-nowrap text-foreground transition-[background-color,box-shadow] duration-150 ease-out outline-none select-none hover:bg-foreground/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-checked:bg-seg-thumb data-checked:font-medium data-checked:shadow-seg data-checked:hover:bg-seg-thumb">
          {t(v === "account" ? "acct.mode.account" : "acct.mode.own")}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

// ---------- 登录（0.32.0，用户 10-25：不在设置页里填验证码，在官网上登录、和官网打通）----------
// 没登录：一个"登录"（开官网确认页）；等确认时：转圈 + "在打开的网页上完成登录" + 取消；没成（超时、没确认）：一句为什么，再点登录
export function WebLogin({ a, intent, size = "sm", id = "webLogin" }) {
  if (loginPending(a)) return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" id={`${id}Waiting`} role="status">
      <Spinner />{t("acct.web.waiting")}
      <Button size="sm" variant="ghost" className="btn" id={`${id}Cancel`} onClick={() => run("loginCancel").catch(() => {})}>{t("c.cancel")}</Button>
    </span>
  );
  return (
    <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
      {a?.login?.error && <span className="text-xs text-muted-foreground" id={`${id}Err`}>{errText({ code: a.login.error })}</span>}
      <BusyButton size={size} className="btn" id={id} busyLabel="acct.busy.opening" onClick={() => startWebLogin(intent).catch((e) => toast(errText(e), "err"))}>{t("acct.signIn")}</BusyButton>
    </span>
  );
}

// 头像：邮箱首字母；会员（付了费、能用的，试用不算）右下角一个金色的星（用户 10-25：会员和非会员用一个图标区分，官网也一样）
export const isMember = (a) => usable(a) && a.plan !== "trial";
const MemberMark = ({ className }) => (
  <svg viewBox="0 0 16 16" className={cn("size-3.5 rounded-full ring-2 ring-background", className)} role="img" aria-label={t("acct.hero.member")} data-member="">
    <circle cx="8" cy="8" r="8" fill="#F2A60C" /><polygon fill="#fff" points="8.00 3.90 9.12 6.76 12.18 6.94 9.81 8.89 10.59 11.86 8.00 10.20 5.41 11.86 6.19 8.89 3.82 6.94 6.88 6.76" />
  </svg>
);
export function Avatar({ a, className }) {
  return (
    <span className={cn("relative grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary", className)}>
      <span aria-hidden="true">{(a?.email || "?")[0].toUpperCase()}</span>
      {isMember(a) && <MemberMark className="absolute -end-1 -bottom-1" />}
    </span>
  );
}
// 设置页右上角（用户 10-25）：头像 + 邮箱，点开是菜单。不写续费类型，只有一次性的快到期时最上面提醒还剩几天、能续费；
// 会员和设备（跳到"连接和费用"）、在网站上管理账号、退出登录
const IconExternal = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>;
const goHash = (hash) => { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = hash; };
export function AccountMenu({ a }) {
  const left = daysLeft(a.periodEnd), soon = isPass(a) && usable(a) && left <= (a.plan === "yearly" ? 7 : 3);
  const act = (op) => () => run(op).catch((e) => toast(errText(e), "err"));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger id="acctMenu" render={<button type="button" className="flex min-w-0 cursor-pointer items-center gap-2 rounded-full py-1 ps-1 pe-2.5 text-sm shadow-[inset_0_0_0_1px_var(--border)] outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50" />}>
        <Avatar a={a} /><span className="max-w-64 truncate" id="acctEmail">{a.email}</span><span className="text-muted-foreground"><IconCaret /></span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-auto min-w-56">
        {soon && <>
          <DropdownMenuGroup>
            <DropdownMenuLabel id="menuEndsSoon">{planName(a)} · {t("acct.status.daysLeft", { n: left })}</DropdownMenuLabel>
            <DropdownMenuItem id="menuRenew" onClick={() => goHash("#renew")}>{t("acct.renew")}</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
        </>}
        <DropdownMenuItem id="menuConn" onClick={() => goHash("#conn")}>{t("acct.menu.manage")}</DropdownMenuItem>
        <DropdownMenuItem id="menuSite" onClick={act("site")}>{t("acct.menu.site")}<span className="ms-auto text-muted-foreground"><IconExternal /></span></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem id="menuLogout" variant="destructive" onClick={act("logout")}>{t("acct.signOut")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------- 账号和开通，一张（草图 A–C）：上面状态，中间开通（没在自动续费时），下面设备和管理 ----------
const Divider = () => <div className="-mx-5 border-t" aria-hidden="true" />;
const BADGE = { accent: "bg-primary/10 text-primary", good: "bg-success-bg text-success", bad: "bg-destructive/10 text-destructive", muted: "bg-muted text-muted-foreground" };
function status(a) {
  const on = usable(a), trial = a.plan === "trial", days = on ? daysLeft(a.periodEnd) : 0;
  const [badge, tone] = !on ? [t("acct.line.none"), "muted"] : trial ? [t("acct.badge.trial"), "accent"] : a.status === "past_due" ? [t("acct.badge.pastDue"), "bad"]
    : isPass(a) ? [planName(a), "good"] : a.renews ? [t("acct.line.renews", { plan: planName(a) }), "good"] : [t("acct.badge.canceled", { plan: planName(a) }), "muted"];
  const hero = !on ? t("acct.hero.none") : trial ? t("acct.hero.trial", { n: days }) : t("acct.hero.member");
  const when = !on ? t("acct.intro") : a.status === "past_due" ? t("acct.alert.pastDue") : trial || isPass(a) ? t("acct.until", { date: date(a.periodEnd) })
    : a.renews ? t("acct.nextRenewal", { date: date(a.periodEnd) }) : t("acct.endsOn", { date: date(a.periodEnd) });
  return { badge, tone, hero, when };
}
export function MemberPanel({ a }) {
  const st = status(a), u = usageOf(a), c = a.checkout;
  const act = (op, extra, done) => async () => { try { await run(op, extra); if (done) toast(t(done)); } catch (e) { toast(errText(e), "err"); } };
  const canRefund = a.refundableUntil && a.refundableUntil > Date.now();
  const [showDevices, setShowDevices] = React.useState(false);
  const [renewing, setRenewing] = React.useState(false); // 一次性的点了"续费"：下面打开开通那块
  const devices = a.devices || [];
  const member = isMember(a);
  // 订阅取消了、还没到期：恢复自动续费；月付在续费：可以改成年付（0.33.0，用户 10-25：取消以后什么都操作不了、也没法换年付）
  const sub = !isPass(a) ? a.subscription : null;
  // 右上角菜单里的"续费"（一次性的快到期）：#renew 打开下面的套餐
  React.useEffect(() => {
    const f = () => { if (location.hash === "#renew") setRenewing(true); };
    f();
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const deviceList = showDevices && (
    <div className="flex flex-col gap-1" id="acctDeviceList">
      {devices.map((x) => (
        <div key={x.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate">{x.name || t("acct.device")}{x.current && <span className="ms-2 text-xs text-muted-foreground">{t("acct.thisDevice")}</span>}</span>
          {!x.current && <BusyButton size="sm" variant="ghost" className="btn" busyLabel="acct.busy.removing" onClick={act("removeDevice", { id: x.id }, "acct.removed")}>{t("acct.remove")}</BusyButton>}
        </div>
      ))}
    </div>
  );
  return (
    <div className="flex flex-col gap-4 py-4" id="account">
      {/* 邮箱、退出登录在设置页右上角的菜单里（0.32.0，用户 10-25：登录态放在页面最上面） */}
      {member ? (
        <>
          <MemberBox a={a} u={u} devices={devices} showDevices={showDevices} onDevices={() => setShowDevices(!showDevices)}
            actions={<>
              {isPass(a) && <Button size="sm" variant={daysLeft(a.periodEnd) <= (a.plan === "yearly" ? 7 : 3) ? "default" : "outline"} className="btn" id="acctRenew" onClick={() => setRenewing(!renewing)}>{t("acct.renew")}</Button>}
              {sub?.status === "canceled" && <BusyButton size="sm" className="btn" id="acctResume" busyLabel="acct.busy.resuming" onClick={act("resume", undefined, "acct.resumed")}>{t("acct.resume")}</BusyButton>}
              {sub?.status === "active" && sub.plan === "monthly" && <BusyButton size="sm" variant="outline" className="btn" id="acctYearly" busyLabel="acct.busy.opening" onClick={act("checkout", { product: "yearly" })}>{t("acct.toYearly")}</BusyButton>}
              {a.subscription && <BusyButton size="sm" variant="outline" className="btn" id="acctManage" busyLabel="acct.busy.opening" onClick={act("portal")}>{t("acct.manage")}</BusyButton>}
              {canRefund && <RefundButton a={a} onDone={act} />}
            </>} />
          {deviceList}
          {c?.status === "pending" ? <><Divider /><Waiting c={c} /></> : renewing && <><Divider /><Plans a={a} /></>}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5" id="acctStatus">
            <p className="text-[22px] leading-tight font-semibold" id="acctHero">{st.hero}</p>
            <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground"><span id="acctWhen">{st.when}</span>{u && <span id="acctUsage" className="tabular-nums">{u.label} {pct(u.v)}</span>}</div>
            {u && <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: pct(u.v) }} /></div>}
            {a.refund?.status === "requested" && <p className="text-xs text-muted-foreground" id="acctRefundLine">{t("acct.refundLine")}</p>}
          </div>
          {c?.status === "pending" ? <><Divider /><Waiting c={c} /></> : <><Divider /><Plans a={a} /></>}
          <Divider />
          <button type="button" className="w-fit cursor-pointer text-start text-xs text-muted-foreground hover:text-foreground" id="acctDevices" aria-expanded={showDevices} onClick={() => setShowDevices(!showDevices)}>
            {t("acct.devices", { n: devices.length, max: 3 })}{devices.find((x) => x.current) && ` · ${devices.find((x) => x.current).name} · ${t("acct.thisDevice")}`}
          </button>
          {deviceList}
        </>
      )}
    </div>
  );
}
// 会员（月付、年付、30 天、1 年）：一块浅底面板（用户 10-25 改过的草图）——标题就是套餐名，紧跟着一行小字是下次续费或到期（用户 10-25：放在套餐名右边，不另起一行）；
// 右边一个状态点（自动续费中 / 还剩 N 天 / 已取消 / 扣款失败，刚付完两分钟是绿勾"已开通"）；两格：本月已用（细进度条）、设备；最下面是按钮
const DOT = { good: "bg-success", warn: "bg-[#e37400]", bad: "bg-destructive", off: "bg-muted-foreground/60" };
function MemberBox({ a, u, devices, showDevices, onDevices, actions }) {
  const c = a.checkout, left = daysLeft(a.periodEnd);
  const justPaid = c?.status === "paid" && Date.now() - (c.doneAt || c.at) < PAID_SHOW;
  const [tone, label] = a.status === "past_due" ? ["bad", t("acct.badge.pastDue")] : isPass(a) ? [left <= (a.plan === "yearly" ? 7 : 3) ? "warn" : "good", t("acct.status.daysLeft", { n: left })]
    : a.renews ? ["good", t("acct.status.renewing")] : ["off", t("acct.status.canceled")];
  const when = a.status === "past_due" ? t("acct.alert.pastDue") : a.renews ? t("acct.nextRenewal", { date: date(a.periodEnd) }) : t("acct.endsOn", { date: date(a.periodEnd) });
  return (
    <div className="acct-panel flex flex-col gap-3 rounded-2xl bg-muted/70 p-3.5" id="acctMember">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="text-xl leading-tight font-semibold" id="acctHero">{planName(a)}</span>
          <span className="text-sm text-muted-foreground" id="acctWhen">{when}</span>
        </p>
        {justPaid
          ? <span className="flex items-center gap-1.5 text-xs font-medium text-success" id="plansPaid" role="status"><svg className="size-4" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor" /><path d="M4.8 8.3 7 10.4l4.2-4.6" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>{t("acct.status.justPaid")}</span>
          : <span className="flex items-center gap-1.5 text-xs text-muted-foreground" id="acctPlan"><span className={cn("size-2 rounded-full", DOT[tone])} aria-hidden="true" />{label}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="acct-tile rounded-xl bg-background px-3 py-2.5" id="acctUsage">
          <p className="text-xs text-muted-foreground">{u ? u.label : t("acct.usedMonth")}</p>
          <p className="text-base font-medium tabular-nums">{pct(u ? u.v : 0)}</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: pct(u ? u.v : 0) }} /></div>
        </div>
        <button type="button" className="acct-tile group flex cursor-pointer flex-col justify-start rounded-xl bg-background px-3 py-2.5 text-start hover:bg-background/70" id="acctDevices"
          aria-expanded={showDevices} data-panel-open={showDevices ? "" : undefined} onClick={onDevices}>
          <span className="text-xs text-muted-foreground">{t("acct.fact.devices")}</span>
          <span className="flex w-full items-center justify-between gap-2 text-base font-medium tabular-nums">{devices.length} / 3<span className="text-muted-foreground"><IconChevron /></span></span>
        </button>
      </div>
      <div className="flex flex-wrap gap-2 empty:hidden">{actions}</div>
    </div>
  );
}
function RefundButton({ a, onDone }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" variant="outline" className="btn" id="acctRefund" />}>{t("acct.refund")}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("acct.refundTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("acct.refundText", { date: date(a.refundableUntil) })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("c.cancel")}</AlertDialogCancel>
          <BusyButton id="acctRefundGo" busyLabel="acct.busy.refunding" onClick={onDone("refund", {}, "acct.refunded")}>{t("acct.refund")}</BusyButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
// 付款页开着：转圈"等待付款完成…"，能重新打开、取消
function Waiting({ c }) {
  const [msg, setMsg] = React.useState(null);
  return (
    <div className="flex flex-col gap-2.5" id="plansWaiting">
      <div className="flex items-start gap-3"><Spinner className="mt-0.5 size-5 text-primary" />
        <div><p className="text-sm font-medium">{t("acct.plans.waiting")}</p><p className="text-xs text-muted-foreground">{t("acct.plans.waitingNote")}</p></div></div>
      <div className="flex gap-2">
        <BusyButton size="sm" variant="outline" className="btn" busyLabel="acct.busy.opening" onClick={() => run("checkout", { product: c.product }).catch((e) => setMsg(errText(e)))}>{t("acct.plans.reopen")}</BusyButton>
        <Button size="sm" variant="ghost" className="btn" onClick={() => run("checkoutClear").catch(() => {})}>{t("c.cancel")}</Button>
      </div>
      {msg && <p className="text-xs text-destructive" role="status">{msg}</p>}
    </div>
  );
}
// 付完款：卡片照常显示会员状态，顶上一行"会员已开通"，两分钟后不再显示（用户 10-25：以前要点"好"才收起，还拿当前状态拼文案，退款回到试用后显示成"会员已开通：试用到…"）
const PAID_SHOW = 120e3;
// 开通（用户 10-25 选的草图 2B）：四行列表——年付（默认、标"推荐 · 省 31%"）、月付、1 年、30 天，价格靠右；一次性的两行带微信支付标记
// （微信支付只能一次性付，订阅付不了；用户 10-25：只有简体、繁体中文界面才显示）；已经买过一次性的点"续费"时默认选他那一档。按钮"去付款 · 价格"
const PER = { monthly: "acct.plans.perMonth", yearly: "acct.plans.perYear" };
const ROWS = [["yearly", "acct.plans.yearly", "acct.plans.yearlyNote"], ["monthly", "acct.plans.monthly", "acct.plans.monthlyNote"],
  ["pass365", "acct.plans.y1", "acct.plans.onceNote"], ["pass30", "acct.plans.d30", "acct.plans.onceNote"]];
// 微信支付的图标：取自微信支付官网页头的 logo（pay.weixin.qq.com，td.cdn-go.cn/enterprise_payment/v0.1.2/logo.svg）里的绿色气泡，只用来标"能用微信支付付"
const WechatPayMark = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-1.5 py-px text-xs font-normal text-success" data-wechat="">
    <svg viewBox="0 0 38.3 34" className="size-3.5 shrink-0" aria-hidden="true"><path fill="#22AC38" d="M13.99,21.42 C13.81,21.5 13.64,21.55 13.42,21.55 C12.94,21.55 12.54,21.28 12.32,20.89 L12.23,20.71 L8.77,13.11 C8.73,13.03 8.73,12.94 8.73,12.85 C8.73,12.5 8.99,12.23 9.34,12.23 C9.47,12.23 9.6,12.28 9.73,12.36 L13.81,15.28 C14.12,15.45 14.47,15.59 14.86,15.59 C15.08,15.59 15.3,15.54 15.52,15.45 L34.64,6.89 C31.22,2.83 25.56,0.18 19.16,0.18 C8.73,0.18 0.22,7.29 0.22,16.07 C0.22,20.84 2.76,25.17 6.75,28.08 C7.06,28.3 7.28,28.7 7.28,29.1 C7.28,29.23 7.24,29.36 7.19,29.5 C6.88,30.69 6.36,32.63 6.36,32.72 C6.31,32.85 6.27,33.03 6.27,33.21 C6.27,33.56 6.53,33.82 6.88,33.82 C7.02,33.82 7.15,33.78 7.24,33.69 L11.36,31.26 C11.66,31.09 12.01,30.95 12.37,30.95 C12.54,30.95 12.76,31 12.94,31.04 C14.86,31.62 16.97,31.92 19.12,31.92 C29.55,31.92 38.06,24.82 38.06,16.03 C38.06,13.38 37.27,10.86 35.91,8.65 L14.12,21.33 L13.99,21.42 Z" /></svg>
    {t("acct.plans.wechat")}
  </span>
);
// onPay(套餐)：没登录时先去登录（SignedOutPanel），不给就直接开付款页；onTrial：没登录时多一个"先免费试用 7 天"；title：登录前上面已有"清流会员"，不再写标题
export const priceOf = (id) => `${PRICES[id]}${PER[id] ? ` ${t(PER[id])}` : ""}`;
function Plans({ a = {}, onPay, onTrial, title = true }) {
  const [pick, setPick] = React.useState(isPass(a) ? (a.plan === "yearly" ? "pass365" : "pass30") : "yearly");
  const [msg, setMsg] = React.useState(null);
  const pay = async () => { setMsg(null); if (onPay) return onPay(pick); try { await run("checkout", { product: pick }); } catch (e) { setMsg(errText(e)); } };
  const row = ([id, name, note]) => (
    <Radio.Root key={id} value={id} data-plan={id}
      className="plan-row flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-start shadow-[inset_0_0_0_1px_var(--border)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-checked:shadow-[inset_0_0_0_2px_var(--primary)]">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">{t(name)}
          {id === "yearly" && <span className="rounded-full bg-primary px-1.5 py-px text-xs font-medium text-primary-foreground">{t("acct.plans.recommended")}</span>}
          {id.startsWith("pass") && /^zh/.test(I18N.uiLang()) && <WechatPayMark />}
        </span>
        <span className="text-xs text-muted-foreground">{t(note)}</span>
      </span>
      <span className="shrink-0 text-lg leading-tight font-semibold tabular-nums">{PRICES[id]}{PER[id] && <span className="ms-1 text-xs font-normal text-muted-foreground">{t(PER[id])}</span>}</span>
    </Radio.Root>
  );
  const price = priceOf(pick);
  return (
    <div className="flex flex-col gap-3" id="plans">
      <div>
        {title && <p className="text-base font-medium">{t("acct.plans.title")}</p>}
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">{["acct.plans.b1", "acct.plans.b2", "acct.plans.b3"].map((k) => <span key={k}><span className="text-success">✓</span> {t(k)}</span>)}</p>
      </div>
      {(a.checkout?.status === "expired" || a.checkout?.status === "timeout") && <p className="text-xs text-muted-foreground" id="plansExpired">{t("acct.plans.expired")}</p>}
      <RadioGroup className="flex flex-col gap-2" aria-label={t("acct.plans.title")} value={pick} onValueChange={setPick} id="plansPick">{ROWS.map(row)}</RadioGroup>
      <BusyButton className="btn h-10 w-full text-sm" id="plansPay" busyLabel="acct.busy.opening" onClick={pay}>{t("acct.plans.payWith", { price })}</BusyButton>
      {onTrial && <Button variant="outline" className="btn -mt-1 h-10 w-full text-sm" id="plansTrial" onClick={onTrial}>{t("acct.trialCta")}</Button>}
      <p className="-mt-1 text-center text-xs text-muted-foreground">{t("acct.plans.refund")}</p>
      {msg && <p className="text-xs text-destructive" role="status" id="plansMsg">{msg}</p>}
    </div>
  );
}

// ---------- 没登录（用户 10-25 批的草图）：和登录后一样先看到套餐和价格。0.32.0 起登录在官网上：点"去付款"先去官网登录，登录上了接着开付款页；
// 点"先免费试用 7 天"就是登录（第一次在插件里登录就开始试用）。等官网确认时这里换成"在打开的网页上完成登录" ----------
export function SignedOutPanel({ a }) {
  const go = (intent) => startWebLogin(intent).catch((e) => toast(errText(e), "err"));
  if (loginPending(a)) return <div className="flex flex-col gap-2 py-4" id="signedOut"><WebLogin a={a} id="panelLogin" /></div>;
  return (
    <div className="flex flex-col gap-4 py-4" id="signedOut">
      <p className="text-[22px] leading-tight font-semibold">{t("acct.hero.member")}</p>
      {a?.login?.error && <p className="-mt-2 text-xs text-muted-foreground" id="panelLoginErr">{errText({ code: a.login.error })}</p>}
      <Plans title={false} onPay={(product) => go({ pay: product })} onTrial={() => go()} />
    </div>
  );
}
