// 清流会员（0.30.0；服务端和付费设计不公开）：登录（0.32.0 起在官网上登录，见下面「登录」）、令牌、套餐状态、开通付款。只在后台用。
// 刷新令牌（90 天，每用一次换新）和 API 密钥一样存在插件自己的 IndexedDB（keys.js，名字 "cf"），网页读不到；访问令牌（1 小时）只在内存里。
// 界面要看的（邮箱、套餐、到期、用量占比、设备）放 storage.local 的 ff_account，里面没有令牌。
import * as keyStore from "./keys.js";

// 清流的服务器：正式环境（0.31.0 起；以前连测试环境 api-staging.clearflow.ohmyai.app）
export const API = "https://api.clearflow.ohmyai.app";
export const SITE = "https://clearflow.ohmyai.app"; // 官网：登录确认页、账号页
let base = API;
export const setApiForTest = (url) => { base = url; };

export class CloudError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.name = "CloudError";
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const REFRESH = "cf";
export const STATE = "ff_account";
let access = null, accessExp = 0, refreshing = null;

async function deviceId() {
  const { ff_device } = await chrome.storage.local.get("ff_device");
  if (typeof ff_device === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(ff_device)) return ff_device;
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  await chrome.storage.local.set({ ff_device: id });
  return id;
}
// 设备名：浏览器和系统（账号页、设备满了让用户挑一台移除时看的）
function deviceName() {
  const ua = navigator.userAgent || "", brands = (navigator.userAgentData?.brands || []).map((b) => b.brand).join(" ");
  const browser = /Edg\//.test(ua) ? "Edge" : /Brave/.test(brands) ? "Brave" : /OPR\//.test(ua) ? "Opera" : "Chrome";
  const os = /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } };
const version = () => { try { return chrome.runtime.getManifest().version; } catch { return ""; } };

async function send(path, { method = "POST", body, token, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  let r;
  try { r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal }); }
  catch (e) { if (e?.name === "AbortError") throw e; throw new CloudError(0, "network"); }
  return r;
}
async function fail(r) {
  const d = await r.json().catch(() => ({}));
  const { error, message, ...extra } = d || {};
  const retryAfter = Number(r.headers.get("retry-after")) || 0;
  return new CloudError(r.status, error || `http_${r.status}`, { ...extra, retryAfter });
}

// ---------- 令牌 ----------
export const signedIn = async () => !!(await keyStore.getKey(REFRESH).catch(() => ""));
async function saveTokens(t) {
  await keyStore.setKey(REFRESH, t.refresh_token);
  access = t.access_token;
  accessExp = Date.now() + (Number(t.expires_in) || 3600) * 1000 - 60e3; // 提前一分钟换
}
// 刷新令牌用不了了（过期、被移除、被盗用整串作废）：退出登录，界面提示重新登录
async function dropTokens(reason) {
  access = null; accessExp = 0;
  await keyStore.setKey(REFRESH, "");
  const { ff_account } = await chrome.storage.local.get(STATE);
  await chrome.storage.local.set({ [STATE]: { signedOut: reason, email: ff_account?.email || null, at: Date.now() } });
}
async function token(force = false) {
  if (!force && access && Date.now() < accessExp) return access;
  if (!refreshing) refreshing = (async () => {
    const rt = await keyStore.getKey(REFRESH).catch(() => "");
    if (!rt) throw new CloudError(401, "signed_out");
    const r = await send("/v1/auth/refresh", { body: { refresh_token: rt } });
    if (r.ok) { await saveTokens(await r.json()); return access; }
    const e = await fail(r);
    if (r.status === 401) await dropTokens(e.code);
    throw e.status === 401 ? new CloudError(401, "signed_out") : e;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

// 带令牌的请求：401 换一次令牌再试；别的错误抛 CloudError（status、code、extra.retryAfter）
async function authed(path, { method = "POST", body, signal } = {}) {
  let r = await send(path, { method, body, token: await token(), signal });
  if (r.status === 401) r = await send(path, { method, body, token: await token(true), signal });
  if (!r.ok) throw await fail(r);
  return r;
}
export const post = async (path, body, opts = {}) => (await authed(path, { body, signal: opts.signal })).json();
export const get = async (path, opts = {}) => (await authed(path, { method: "GET", signal: opts.signal })).json();

// SSE（补翻、字幕逐条推）：onEvent(事件名, 数据)；服务器中途出错发 error 事件
export async function stream(path, body, onEvent, { signal } = {}) {
  const r = await authed(path, { body: { ...body, stream: true }, signal });
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = /^event: (.*)$/m.exec(chunk)?.[1], data = /^data: (.*)$/m.exec(chunk)?.[1];
      if (!ev || data == null) continue;
      let d;
      try { d = JSON.parse(data); } catch { continue; }
      if (ev === "error") throw new CloudError(502, d?.error || "upstream_error");
      onEvent(ev, d);
    }
  }
}

// ---------- 登录（0.32.0，用户 10-25：登录不放在设置页里、要和官网打通）----------
// 设备授权：插件要一个设备码（device_code，只在后台、不给界面）和一个核对码（user_code），在官网开 /<语言>/activate/?code=核对码；
// 官网上没登录先登录，再点"登录插件"确认（设备满了在官网挑一台移除）；插件按 interval 秒问一次，确认了就拿到这台设备的令牌。
// 官网已经登录着就只要点一下，登录完官网也是登录着的
export async function deviceStart() {
  const r = await send("/v1/auth/device/start", { body: { device_id: await deviceId(), device_name: deviceName(), ext_version: version(), tz: tz() } });
  if (!r.ok) throw await fail(r);
  const d = await r.json();
  return { deviceCode: d.device_code, userCode: d.user_code, interval: Math.max(2, Number(d.interval) || 3), expiresIn: Number(d.expires_in) || 600 };
}
// 问一次：还没确认 {pending}；确认了存令牌、拉一次套餐状态 {ok}；拒绝了、过期了抛 CloudError（access_denied / expired_token）
export async function devicePoll(deviceCode) {
  const r = await send("/v1/auth/device/token", { body: { device_code: deviceCode } });
  if (!r.ok) {
    const e = await fail(r);
    if (e.code === "authorization_pending" || e.code === "slow_down") return { pending: true, slow: e.code === "slow_down" };
    throw e;
  }
  await saveTokens(await r.json());
  await refreshMe();
  return { ok: true };
}
export async function logout() {
  const rt = await keyStore.getKey(REFRESH).catch(() => "");
  if (rt) await send("/v1/auth/logout", { body: { refresh_token: rt } }).catch(() => {});
  access = null; accessExp = 0;
  await keyStore.setKey(REFRESH, "");
  await chrome.storage.local.remove(STATE);
}

// ---------- 套餐状态（/v1/me） ----------
export async function refreshMe() {
  const me = await get("/v1/me");
  const out = {
    email: me.email, plan: me.plan, status: me.status, kind: me.kind, renews: !!me.renews, periodEnd: me.period_end ?? null,
    usage: me.usage || null, devices: me.devices || [], refundableUntil: me.billing?.refundable_until ?? null,
    subscription: me.billing?.subscription || null, refund: me.billing?.refund || null, at: Date.now(),
  };
  const { ff_account: before } = await chrome.storage.local.get(STATE);
  // 留着：开通中的那次结账（checkout）、网页里提示过什么（notice）、上一次有的套餐（lastPlan：到期后提示说"试用结束"还是"会员到期"）。
  // 又能用了：到期、退出这类提示清掉（以后再出事再提示一次）；当天、当月额度用完的照旧一天、一个月只提示一次
  const next = { ...(before || {}), ...out, lastPlan: out.plan || before?.lastPlan || null };
  delete next.signedOut;
  // 结完的账（付了、过期、超时）过两分钟就清掉：别让旧的"已付款"留着（用户 10-25：退款后还显示"会员已开通"）
  if (next.checkout && next.checkout.status !== "pending" && Date.now() - (next.checkout.doneAt || next.checkout.at || 0) > 120e3) delete next.checkout;
  if (active(out)) next.notice = Object.fromEntries(Object.entries(before?.notice || {}).filter(([k]) => k.startsWith("quota_")));
  await chrome.storage.local.set({ [STATE]: next });
  return next;
}
// 能不能用：试用中、会员（含取消了还在当期、扣款失败的宽限期）
export const active = (a) => !!a && !a.signedOut && ["trialing", "active", "canceled", "past_due"].includes(a.status);

// ---------- 开通 ----------
export const checkout = (product, language) => post("/v1/billing/checkout", { product, language });
export async function checkoutStatus(id) {
  const r = await send(`/v1/billing/checkout/${encodeURIComponent(id)}`, { method: "GET" });
  if (!r.ok) throw await fail(r);
  return r.json();
}
export const portal = () => post("/v1/billing/portal", {});
export const cancel = () => post("/v1/billing/cancel", {});
export const refund = () => post("/v1/billing/refund", {});
export const resume = () => post("/v1/billing/resume", {}); // 取消了、还没到期：恢复自动续费（0.33.0）
export const webHandoff = () => post("/v1/auth/web/handoff", {}); // 官网免登录的一次性码（0.34.0）
export const removeDevice = async (id) => (await authed(`/v1/devices/${encodeURIComponent(id)}`, { method: "DELETE" })).json();
