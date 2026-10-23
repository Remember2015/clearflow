// 弹窗、设置页共用的：文字（FFI18n，i18n.js 放在全局）、读写插件存储、发消息给后台，和几个控件。
// 0.19 起控件用 shadcn/ui 的 maia 风格（components/ui，底层 Base UI），样式是 Tailwind 的 class（src/app.css 编成 ui/ui.css）。
// 测试认的 class 名留着（help、help-pop、switch、seg、seg-item、btn、toast、toast-title），开关上标 data-switch。
import * as React from "react";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Toast } from "@base-ui/react/toast";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LOGOS } from "./logos.js";

export { cn };
export const I18N = globalThis.FFI18n;
export const SETTINGS = globalThis.FFSettings;
export const t = (key, vars) => I18N.t(key, vars);
export const PRICE = 0.042 / 1e6; // Jev 每 token 的价钱（和 background.js 一样）
export const DAY = 864e5;
export const day = (d) => d.toLocaleDateString("sv-SE");
// 一条只要几十万分之一美元，固定四位小数会显示成 $0.0000：小于 1 美元的保留两位有效数字
export const usd = (v) => (v >= 1 ? `$${v.toFixed(2)}` : `$${v.toLocaleString("en-US", { minimumSignificantDigits: 2, maximumSignificantDigits: 2 })}`);
// 几句话连在一起：中文、日文句子之间不加空格
export const joinSentences = (parts) => parts.filter(Boolean).join(/^(zh|ja)/.test(I18N.uiLang()) ? "" : " ");

export async function send(msg) {
  const r = await chrome.runtime.sendMessage(msg);
  if (!r || r.error || r.ok === false) throw Object.assign(new Error(r ? I18N.errText(r) : t("c.notDone")), { code: r?.code }); // code：引导页分得清"密钥无效"和别的错
  return r;
}
// "失败：{msg}。请重试。"：原因自己结尾的句号去掉，不然是"……整数。。请重试。"
export const failText = (e) => t("c.failed", { msg: String((e && e.message) || e).replace(/[。．.!！]+$/u, "") });

// 读一组存储项，存储变了（别的页面、后台改的）跟着重读
export function useStorage(keys) {
  const [data, setData] = React.useState(null);
  const load = React.useCallback(async () => setData(await chrome.storage.local.get(keys)), []);
  React.useEffect(() => {
    load();
    const onChanged = (ch, area) => { if (area === "local" && keys.some((k) => k in ch)) load(); };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [load]);
  return [data, load];
}

// 改设置：一次一个补丁，排队写，写之前读最新的（弹窗和设置页可能同时开着），校验不过就报错、不写
let writes = Promise.resolve();
export function writeSettings(patch) {
  const next = writes.catch(() => {}).then(async () => {
    const { ff_settings } = await chrome.storage.local.get("ff_settings");
    const { settings, error } = SETTINGS.validate({ ...SETTINGS.normalize(ff_settings), ...patch });
    if (error) throw new Error(error);
    await chrome.storage.local.set({ ff_settings: settings });
    return settings;
  });
  writes = next;
  return next;
}

// 改某个网站（0.20）：patch 里的项写进 ff_settings.sites[网站]。值是 null 的删掉（恢复默认）；规则项改成和默认一样的、
// 三个开关（总开关 on、清理 fold、翻译 translate）改回开的，也删掉——只存和默认不一样的
export function writeSite(site, patch) {
  const next = writes.catch(() => {}).then(async () => {
    const { ff_settings } = await chrome.storage.local.get("ff_settings");
    const cur = SETTINGS.normalize(ff_settings);
    const o = { ...(cur.sites[site] || {}) };
    for (const [k, v] of Object.entries(patch)) {
      const isSwitch = k === "on" || k === "fold" || k === "translate";
      if (v === null || (isSwitch ? v === true : cur[k] === v)) delete o[k]; else o[k] = v;
    }
    const sites = { ...cur.sites };
    if (Object.keys(o).length) sites[site] = o; else delete sites[site];
    const { settings, error } = SETTINGS.validate({ ...cur, sites });
    if (error) throw new Error(error);
    await chrome.storage.local.set({ ff_settings: settings });
    return settings;
  });
  writes = next;
  return next;
}
// 网站的名字：都是专名、不翻，小红书在别的语言里叫 RedNote
const SITE_NAMES = { x: "X", reddit: "Reddit", yt: "YouTube", hn: "Hacker News" };
export const siteName = (id) => SITE_NAMES[id] || t(`site.${id}`);
// 网站的 logo（0.20.1）：照各家自己的图标原样画（logos.js），读屏念网站名
export function SiteLogo({ id, size = 18, className }) {
  const parts = LOGOS[id];
  if (!parts) return null;
  return (
    <span role="img" aria-label={siteName(id)} title={siteName(id)} data-site={id} className={cn("site-logo inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
        {parts.map(([Tag, attrs], i) => <Tag key={i} {...attrs} />)}
      </svg>
    </span>
  );
}

// ---------- 图标（线条 2，跟 maia 用的图标库一样粗；跟着文字颜色，大小由按钮定）。路径取自 Lucide（ISC License，Copyright (c) Lucide Contributors） ----------
const svg = (children, props = {}) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" {...props}>{children}</svg>
);
export const IconHelp = (props) => svg(<><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></>, props);
// 展开 / 收起的箭头：放在 class 带 group 的触发按钮里，按钮上有 data-panel-open 时转 90°（从右往左的语言箭头朝左、往回转）
export const IconChevron = () => svg(<path d="m9 18 6-6-6-6" />, {
  className: "size-3.5 transition-[rotate] duration-150 ease-out rtl:-scale-x-100 group-data-panel-open:rotate-90 rtl:group-data-panel-open:-rotate-90",
});
export const IconCaret = () => svg(<path d="m6 9 6 6 6-6" />);
// 返回：箭头朝左（从右往左的语言朝右），设置页网站页左上角的圆形按钮里（0.21，照 Chrome 设置的子页）
export const IconArrowLeft = () => svg(<><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>, { className: "size-5 rtl:-scale-x-100" });
export const IconCheck = (props) => svg(<path d="M20 6 9 17l-5-5" />, props);
export const IconLock = (props) => svg(<><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>, props);

// ---------- 问号说明：悬停就打开（Base UI 建议这类"看说明"的图标用 Popover + openOnHover，点一下、触屏、读屏也能打开） ----------
export function Help({ children, label }) {
  return (
    <Popover>
      <PopoverTrigger openOnHover delay={120} closeDelay={120} aria-label={label || t("c.help")}
        render={<Button variant="ghost" size="icon-xs" className="help cursor-help text-muted-foreground hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground" />}>
        <IconHelp className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="bottom" sideOffset={6} collisionPadding={12}
        className="help-pop max-w-[calc(100vw-1.5rem)] gap-2 p-3.5 text-[13px] leading-relaxed text-pretty">
        {children}
      </PopoverContent>
    </Popover>
  );
}

// ---------- 开关 ----------
// 开关上标 data-switch="设置名"（Base UI 把 id 交给藏着的 <input> 关联 label，看得见的开关自己的 id 是自动生成的）
export function Toggle({ id, checked, onChange, label, disabled }) {
  return <Switch data-switch={id} className="switch" checked={!!checked} disabled={!!disabled} aria-label={label} onCheckedChange={(v) => onChange(v)} />;
}

// ---------- 宽松 / 标准 / 严格：三选一（不在三档上的自定义值，三个都不亮） ----------
// 0.19.2 起照苹果的分段控件（用户：原来那个"有点奇怪、有点丑，配色也不对"，批了草图）：灰色的槽，选中那一格是浮起来的白块
// （深色是灰块），字都是正文色、选中的加粗一点；圆角是连续圆角（app.css），槽的半径 = 白块的半径 + 中间 2px 的留白。
// 用 RadioGroup 不用 ToggleGroup：三选一的语义（aria-checked），读屏念"单选，3 个中的第 2 个"
const LEVELS = ["less", "default", "more"];
// 一个值是哪一档（网站页上"默认：标准"用）；不在三档上的照数字写
export const levelName = (v, levels) => { const i = levels.findIndex((x) => Math.abs(x - v) < 1e-9); return i >= 0 ? t(`opt.level.${LEVELS[i]}`) : String(v); };
export function Levels({ value, levels, onChange, label, disabled }) {
  const cur = levels.find((v) => Math.abs(v - value) < 1e-9);
  return (
    <RadioGroup className="seg inline-flex w-fit shrink-0 items-center gap-0.5 rounded-[10px] bg-seg-track p-0.5 data-disabled:opacity-50" aria-label={label}
      value={cur == null ? "" : String(cur)} disabled={!!disabled} onValueChange={(v) => { if (v !== "" && Number(v) !== cur) onChange(Number(v)); }}>
      {levels.map((v, i) => (
        <Radio.Root key={v} value={String(v)}
          className="seg-item inline-flex h-7 cursor-pointer items-center justify-center rounded-[8px] px-3.5 text-[13px] whitespace-nowrap text-foreground transition-[background-color,box-shadow] duration-150 ease-out outline-none select-none hover:bg-foreground/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-checked:bg-seg-thumb data-checked:font-medium data-checked:shadow-seg data-checked:hover:bg-seg-thumb data-disabled:cursor-default data-disabled:hover:bg-transparent">
          {t(`opt.level.${LEVELS[i]}`)}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

export const TipProvider = ({ children }) => <TooltipProvider delay={300}>{children}</TooltipProvider>;

// ---------- 页面底部的一行提示（已保存、出错了），一次只留一条：被新的顶掉的（data-limited）立刻不显示 ----------
export const toastManager = Toast.createToastManager();
export const toast = (title, type = "ok") => toastManager.add({ title, type });
function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((x) => (
    <Toast.Root key={x.id} toast={x}
      className={cn("toast pointer-events-auto max-w-[min(30rem,calc(100vw-2rem))] rounded-2xl px-4 py-2.5 text-sm shadow-lg transition-[opacity,translate] duration-150 ease-out",
        "data-limited:hidden data-starting-style:translate-y-1.5 data-starting-style:opacity-0 data-ending-style:translate-y-1.5 data-ending-style:opacity-0",
        x.type === "err" ? "bg-destructive text-white" : "bg-foreground text-background")}>
      <Toast.Content><Toast.Title className="toast-title" /></Toast.Content>
    </Toast.Root>
  ));
}
export function Toasts({ children }) {
  return (
    <Toast.Provider toastManager={toastManager} timeout={2200} limit={1}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="toasts pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center"><ToastList /></Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

// ---------- 小标签的颜色：清理的三类（和页面上提示条的标签同一个色系）、连接出问题、提醒 ----------
// 深色下（0.20.1，用户：看着不舒服）：以前是很深的红、棕、紫实底，发闷；换成苹果深色系统色的淡底（半透明）、亮一点的字
export const CAT_TONE = {
  spam: "bg-red-100 text-red-800 dark:bg-[rgb(255_69_58/0.16)] dark:text-[#ff9a90]",
  abuse: "bg-amber-100 text-amber-800 dark:bg-[rgb(255_159_10/0.16)] dark:text-[#ffc46b]",
  sexual: "bg-violet-100 text-violet-800 dark:bg-[rgb(191_90_242/0.18)] dark:text-[#dcaaff]",
  // 「赞」「mark」这类（0.22）：不是坏东西，不用警示色，比没有时的灰深一点
  filler: "bg-zinc-200 text-zinc-800 dark:bg-white/[0.12] dark:text-zinc-200",
};
export const WARN_TONE = "bg-amber-100 text-amber-900 dark:bg-[rgb(255_159_10/0.16)] dark:text-[#ffc46b]";
export const BAD_TONE = "bg-destructive/10 text-destructive dark:bg-destructive/20";
export const MUTED_TONE = "bg-muted text-muted-foreground";
