// Account page and payment result page (copy.account.mjs; built into /account.js). Data comes from <script type="application/json" id="ffData">:
// {page: "paid" | "account", api, lang, A (this page's copy), html (language tag)}. Everything is built with textContent (nothing from the
// API is parsed as HTML). The API is on another host of the same site, so the sign-in cookie (HttpOnly, SameSite=Lax) goes along with
// credentials: "include"; the API only allows this site's origin with credentials.
// 10-25 (approved sketch): centered sign-in card with a 6-box code and a resend countdown; two-column account page (membership and plans
// on the left, devices and help on the right, delete as one line at the bottom); every button that waits shows a spinner and what it's doing.
// The header's sign-in link (main.js) reads localStorage ff_acct, which this page keeps up to date (the cookie itself can't be read here).
// 0.32.0 (user 10-25): the extension signs in here too — /<lang>/activate/?code=… (page "activate"): sign in if needed, then confirm the
// device (device authorization on the API; full device list → remove one first); the extension picks up its tokens and closes the tab.
// Members (paid, not trial) get a small gold star on the avatar, here, in the header and in the extension.
(function () {
  const el = document.getElementById("ffData");
  if (!el) return;
  const D = JSON.parse(el.textContent), A = D.A;
  const $ = (id) => document.getElementById(id);
  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => (v && v[k] != null ? v[k] : ""));
  const h = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v; else if (k === "on") for (const [ev, f] of Object.entries(v)) n.addEventListener(ev, f); else if (v != null && v !== false) n.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return n;
  };
  async function api(path, { method = "GET", body } = {}) {
    let r;
    try {
      r = await fetch(D.api + path, { method, credentials: "include", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    } catch { throw Object.assign(new Error("network"), { code: "network" }); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || "other"), { code: data.error || "other", status: r.status, data });
    return data;
  }
  // 问装着的清流插件（0.34.0，用户 10-25：少登录几次）：只有这个网站能和插件说话（插件 manifest 的 externally_connectable），没装、没回就当没有
  const askExt = (msg) => new Promise((done) => {
    const rt = globalThis.chrome?.runtime;
    if (!rt?.sendMessage || !Array.isArray(D.ext)) { done(null); return; }
    let left = D.ext.length, over = false;
    const finish = (r) => { if (!over && (r?.code || --left <= 0)) { over = true; done(r?.code ? r : null); } };
    setTimeout(() => { if (!over) { over = true; done(null); } }, 2500);
    for (const id of D.ext) { try { rt.sendMessage(id, msg, (r) => { void rt.lastError; finish(r); }); } catch { finish(null); } }
  });
  // 官网没登录、插件登录着：拿插件给的一次性码换登录状态。官网上点过退出登录的不自动登（ff_noauto），除非是从插件点过来的（?from=ext）
  const fromExt = new URLSearchParams(location.search).get("from") === "ext";
  if (fromExt) { try { localStorage.removeItem("ff_noauto"); } catch { /* 存不了就算了 */ } history.replaceState(null, "", location.pathname + location.search.replace(/[?&]from=ext/, "").replace(/^&/, "?")); }
  const noAuto = () => { try { return localStorage.getItem("ff_noauto") === "1"; } catch { return false; } };
  const setNoAuto = (on) => { try { if (on) localStorage.setItem("ff_noauto", "1"); else localStorage.removeItem("ff_noauto"); } catch { /* 存不了就算了 */ } };
  async function autoSignIn() {
    if (noAuto()) return false;
    const r = await askExt({ type: "cfHandoff" });
    if (!r?.code) return false;
    try { await api("/v1/auth/web/redeem", { method: "POST", body: { code: r.code } }); return true; } catch { return false; }
  }
  const date = (ts) => new Date(ts).toLocaleDateString(D.html, { ...(new Date(ts).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}), month: "short", day: "numeric" });

  // ---------- 付款结果 ----------
  if (D.page === "paid") {
    const P = A, title = $("paidTitle"), text = $("paidText"), actions = $("paidActions");
    const co = new URLSearchParams(location.search).get("co") || "";
    const show = (t, p, link) => {
      title.textContent = t; text.textContent = p;
      actions.replaceChildren(...(link ? [h("a", { class: "btn ghost", href: `/${D.lang}/account/` }, P.toAccount)] : []));
      document.body.dataset.state = link === "paid" ? "paid" : "";
    };
    if (!/^co_[0-9a-f-]{36}$/.test(co)) { show(P.noneTitle, P.noneText, true); return; }
    const t0 = Date.now();
    const check = async () => {
      let r;
      try { r = await api(`/v1/billing/checkout/${co}`); }
      catch (e) { if (e.status === 404) { show(P.noneTitle, P.noneText, true); return; } show(P.slowTitle, P.errorText, true); setTimeout(check, 5000); return; }
      if (r.status === "paid") { show(P.paidTitle, P.paidText, "paid"); return; }
      if (r.status === "expired") { show(P.noneTitle, P.noneText, true); return; }
      // 还没收到 Waffo 的通知：前两分钟每 3 秒问一次，之后说"还在确认"、每 15 秒问一次（取消付款的人回到这里也是这样，所以不说"失败"）
      if (Date.now() - t0 > 120e3) show(P.slowTitle, P.slowText, true);
      setTimeout(check, Date.now() - t0 > 120e3 ? 15000 : 3000);
    };
    check();
    return;
  }

  // ---------- 账号 ----------
  const root = $("account"), msg = $("accountMsg");
  const say = (text, bad = true) => { msg.textContent = text || ""; msg.className = bad ? "acct-msg bad" : "acct-msg"; };
  const errText = (e) => A.err[e.code] || A.err.other;
  // 头部的登录入口（main.js）看这个：登录着存邮箱，退出、过期就删
  const remember = (email, member = false) => {
    try { if (email) localStorage.setItem("ff_acct", JSON.stringify({ email, member })); else localStorage.removeItem("ff_acct"); } catch { /* 存不了就不显示头像 */ }
    globalThis.FFNavAccount?.();
  };
  const spinner = () => h("span", { class: "spin", "aria-hidden": "true" });
  // 会等的按钮：点了转圈、换成进行中的字、不能再点；做完恢复（出错在上面那行说）
  const button = (label, cls, busyLabel, onClick, id) => {
    const b = h("button", { type: "button", class: `btn ${cls}`, id });
    b.append(...[].concat(label));
    b.addEventListener("click", async () => {
      if (b.disabled) return;
      const kids = [...b.childNodes];
      b.disabled = true; b.setAttribute("aria-busy", "true"); say("");
      if (busyLabel) b.replaceChildren(spinner(), busyLabel);
      try { await onClick(); } catch (err) { say(errText(err)); }
      finally { if (b.isConnected) { b.replaceChildren(...kids); b.disabled = false; b.removeAttribute("aria-busy"); } }
    });
    return b;
  };
  const initial = (email) => (String(email || "?").trim()[0] || "?").toUpperCase();
  const usable = (a) => ["trialing", "active", "canceled", "past_due"].includes(a.status);
  const isMember = (a) => usable(a) && a.plan !== "trial";
  // 头像：首字母；会员右下角一个金色的星（和插件、头部一样）
  const SVG = "http://www.w3.org/2000/svg";
  const star = () => {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("class", "member-star"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", A.heroMember);
    const c = document.createElementNS(SVG, "circle"); c.setAttribute("cx", "8"); c.setAttribute("cy", "8"); c.setAttribute("r", "8"); c.setAttribute("fill", "#F2A60C");
    const p = document.createElementNS(SVG, "polygon"); p.setAttribute("fill", "#fff");
    p.setAttribute("points", "8.00 3.90 9.12 6.76 12.18 6.94 9.81 8.89 10.59 11.86 8.00 10.20 5.41 11.86 6.19 8.89 3.82 6.94 6.88 6.76");
    svg.append(c, p);
    return svg;
  };
  const avatar = (a, cls = "acct-avatar") => h("span", { class: cls }, h("span", { "aria-hidden": "true" }, initial(a.email)), isMember(a) && star());

  // ---------- 登录：邮箱 → 6 格验证码（能粘贴、填满就登录），60 秒后能重新发送 ----------
  function signIn(done = load, title = A.signInTitle, sub = A.signInSub) {
    let email = "", timer = null;
    const card = h("section", { class: "card auth-card", id: "signin" });
    const head = (title, sub) => [h("h1", { class: "auth-title" }, title), sub]; // 牌子在页面左上角，卡片里不再重复（用户 10-25：登录页太重）
    const send = async () => {
      const input = $("acctEmail");
      if (input) email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say(A.err.invalid_email); return; }
      await api("/v1/auth/email/start", { method: "POST", body: { email, lang: D.html } });
      step2();
    };
    const step1 = () => {
      clearInterval(timer);
      const input = h("input", { type: "email", id: "acctEmail", autocomplete: "email", placeholder: "you@example.com", value: email });
      const go = button(A.sendCode, "primary full", A.busy.sending, send, "acctSend");
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
      card.replaceChildren(...head(title, h("p", { class: "auth-sub" }, sub)),
        h("label", { class: "auth-label", for: "acctEmail" }, A.email), input, go);
      input.focus();
    };
    const step2 = () => {
      const boxes = [...Array(6)].map((_, i) => h("input", { class: "otp-box", inputmode: "numeric", autocomplete: i ? "off" : "one-time-code", maxlength: "1", "aria-label": `${A.code} ${i + 1}` }));
      const code = () => boxes.map((b) => b.value).join("");
      const login = button(A.signIn, "primary full", A.busy.signingIn, async () => {
        if (!/^\d{6}$/.test(code())) { say(A.err.code_invalid); return; }
        await api("/v1/auth/email/verify", { method: "POST", body: { email, code: code() } });
        setNoAuto(false);
        clearInterval(timer);
        done();
      }, "acctGo");
      const put = (i, digits) => { for (const d of digits) { if (i > 5) break; boxes[i++].value = d; } boxes[Math.min(i, 5)].focus(); if (code().length === 6) login.click(); };
      boxes.forEach((b, i) => {
        b.addEventListener("input", () => { const d = b.value.replace(/\D/g, ""); b.value = ""; if (d) put(i, d); });
        b.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !b.value && i) { boxes[i - 1].value = ""; boxes[i - 1].focus(); } if (e.key === "Enter") login.click(); });
        b.addEventListener("paste", (e) => { const d = (e.clipboardData?.getData("text") || "").replace(/\D/g, ""); if (d) { e.preventDefault(); put(0, d); } });
      });
      const resend = h("span", {});
      let left = 60;
      const tick = () => {
        if (left > 0) { resend.replaceChildren(fill(A.resendIn, { n: left })); left--; return; }
        clearInterval(timer);
        resend.replaceChildren(button(A.resend, "textbtn", A.busy.sending, async () => { await send(); }, "acctResend"));
      };
      clearInterval(timer); tick(); timer = setInterval(tick, 1000);
      // 下面一行：重新发送（倒计时）· 换个邮箱
      const foot = h("p", { class: "auth-resend" }, resend, h("span", { "aria-hidden": "true" }, "·"), h("button", { type: "button", class: "textbtn", id: "acctChange", on: { click: step1 } }, A.changeEmail));
      card.replaceChildren(...head(A.codeTitle, h("p", { class: "auth-sub", id: "acctSent" }, fill(A.codeSentTo, { email }))),
        h("div", { class: "otp", id: "acctCode" }, boxes), login, foot);
      boxes[0].focus();
    };
    step1();
    return h("div", { class: "auth" }, card);
  }

  // ---------- 账号 ----------
  const planName = (a) => A.plan[a.plan === "trial" ? "trial" : a.kind === "pass" ? (a.plan === "yearly" ? "pass365" : "pass30") : a.plan] || "";
  const pct = (x) => `${Math.round(Math.min(1, x || 0) * 100)}%`;
  const bar = (w) => { const i = document.createElement("i"); i.style.width = w; return h("div", { class: "acct-bar" }, i); }; // 宽度用 CSSOM（CSP 不许 style 属性）
  function membership(a) {
    const on = usable(a), trial = a.plan === "trial", days = Math.max(0, Math.ceil((a.period_end - Date.now()) / 864e5));
    const [badge, tone] = !on ? [A.badge.none, "muted"] : trial ? [A.badge.trial, "accent"] : a.status === "past_due" ? [A.badge.pastDue, "bad"]
      : a.kind === "pass" ? [fill(A.badge.pass, { plan: planName(a) }), "good"] : a.renews ? [fill(A.badge.renews, { plan: planName(a) }), "good"] : [fill(A.badge.canceled, { plan: planName(a) }), "muted"];
    const hero = !on ? A.heroNone : trial ? (days === 1 ? A.heroTrialOne : fill(A.heroTrial, { n: days })) : A.heroMember;
    const when = !on ? A.noneSub : a.status === "past_due" ? A.pastDueSub : trial || a.kind === "pass" ? fill(A.until, { date: date(a.period_end) })
      : a.renews ? fill(A.nextRenewal, { date: date(a.period_end) }) : fill(A.endsOn, { date: date(a.period_end) });
    const use = on && a.usage ? (trial ? fill(A.usedToday, { pct: pct(a.usage.today) }) : fill(A.usedMonth, { pct: pct(a.usage.month ?? a.usage.today) })) : null;
    const canRefund = a.billing?.refundable_until && a.billing.refundable_until > Date.now();
    // 0.33.0（用户 10-25）：订阅取消了、还没到期——恢复自动续费；月付在续费——改成年付（Waffo 的换套餐页，差价它算）
    const sub = a.kind === "pass" ? null : a.billing?.subscription;
    const actions = [
      sub?.status === "canceled" && button(A.resume, "primary", A.busy.resuming, async () => { await api("/v1/billing/resume", { method: "POST", body: {} }); say(A.resumed, false); load(); }, "acctResume"),
      sub?.status === "active" && sub.plan === "monthly" && button(A.toYearly, "ghost", A.busy.opening, async () => {
        const r = await api("/v1/billing/checkout", { method: "POST", body: { product: "yearly", language: D.html } });
        if (r.checkout_url) location.href = r.checkout_url; else load();
      }, "acctYearly"),
      a.billing?.subscription && button(A.manage, "ghost", A.busy.opening, async () => { const r = await api("/v1/billing/portal", { method: "POST", body: {} }); location.href = r.url; }, "acctManage"),
      canRefund && button(fill(A.refund, { date: date(a.billing.refundable_until) }), "ghost", A.busy.refunding, async () => {
        if (!confirm(A.refundConfirm)) return;
        await api("/v1/billing/refund", { method: "POST", body: {} }); say(A.refunded, false); load();
      }, "acctRefund"),
    ].filter(Boolean);
    return h("section", { class: "card acct-card", id: "acctMain" },
      h("div", { class: "acct-row between" }, h("span", { class: "acct-kicker" }, A.member), h("span", { class: `acct-badge ${tone}`, id: "acctPlan" }, badge)),
      h("p", { class: "acct-hero" }, hero),
      h("div", { class: "acct-row between acct-sub" }, h("span", {}, when), use && h("span", { id: "acctUsage" }, use)),
      a.billing?.refund?.status === "requested" && h("p", { class: "acct-sub", id: "acctRefundLine" }, A.refundLine),
      use && bar(pct(trial ? a.usage.today : a.usage.month ?? a.usage.today)),
      actions.length > 0 && h("div", { class: "acct-row acct-wrap acct-actions" }, actions));
  }
  // 开通（没在自动续费时；用户 10-25 选的 2B，和插件一样）：四行列表——年付（默认，标"推荐 · 省 31%"）、月付、1 年、30 天，价格靠右；
  // 一次性的两行带微信支付标记（微信支付只能一次性付；用户 10-25：只在中文页显示）；已经买过一次性的默认选他那一档。去付款按钮带上选中的价格
  function plans(a) {
    const opts = { monthly: ["$2.90", A.perMonth], yearly: ["$24", A.perYear], pass30: ["$3.90", ""], pass365: ["$39", ""] };
    let pick = a.kind === "pass" ? (a.plan === "yearly" ? "pass365" : "pass30") : "yearly";
    const pay = button("", "primary full", A.busy.opening, async () => {
      const r = await api("/v1/billing/checkout", { method: "POST", body: { product: pick, language: D.html } });
      location.href = r.checkout_url;
    }, "acctPay");
    const all = [];
    const choose = (id) => { pick = id; for (const x of all) x.setAttribute("aria-pressed", String(x.dataset.plan === id)); pay.replaceChildren(fill(A.pay, { price: `${opts[id][0]}${opts[id][1] ? " " + opts[id][1] : ""}` })); };
    const row = (id, name, note) => {
      const b = h("button", { type: "button", class: "plan-row", "data-plan": id, on: { click: () => choose(id) } },
        h("span", { class: "plan-main" },
          h("span", { class: "plan-name" }, name, id === "yearly" && h("span", { class: "plan-tag" }, A.recommended),
            id.startsWith("pass") && /^zh/.test(D.html) && h("span", { class: "wxpay" }, h("img", { src: "/assets/logos/wechat-pay.svg", width: "14", height: "14", alt: "" }), A.wechat)),
          h("span", { class: "plan-note" }, note)),
        h("span", { class: "plan-price" }, opts[id][0], opts[id][1] && h("small", {}, ` ${opts[id][1]}`)));
      all.push(b); return b;
    };
    const sec = h("section", { class: "card acct-card", id: "acctPlans" },
      h("h2", {}, A.plansTitle), h("p", { class: "acct-benefits" }, A.benefits.map((x) => h("span", {}, x))),
      h("div", { class: "plan-list" }, row("yearly", A.yearly, A.yearlyNote), row("monthly", A.monthly, A.monthlyNote),
        row("pass365", A.y1, A.onceNote), row("pass30", A.d30, A.onceNote)),
      pay, h("p", { class: "acct-sub center" }, A.refundNote));
    choose(pick);
    return sec;
  }
  function devices(a) {
    const list = a.devices || [];
    return h("section", { class: "card acct-card", id: "acctDevices" },
      h("h2", {}, A.devices, h("span", { class: "acct-count" }, ` ${list.length} / 3`)),
      list.length ? list.map((d) => h("div", { class: "acct-row between acct-device" }, h("span", {}, d.name || "—", h("span", { class: "acct-sub" }, ` · ${date(d.last_seen_at)}`)),
        button(A.remove, "ghost sm", A.busy.removing, async () => { await api(`/v1/devices/${d.id}`, { method: "DELETE" }); load(); })))
        : h("p", { class: "acct-sub" }, A.noDevices));
  }
  const help = () => h("section", { class: "card acct-card", id: "acctHelp" }, h("h2", {}, A.helpTitle),
    h("ul", { class: "acct-help" }, h("li", {}, A.helpExt), h("li", {}, A.helpRefund), h("li", {}, A.helpWaffo),
      h("li", {}, h("a", { href: `/${D.lang}/terms/` }, A.terms), " · ", h("a", { href: "mailto:developer@ohmyai.app" }, "developer@ohmyai.app"))));

  function view(a) {
    remember(a.email, isMember(a));
    const top = h("div", { class: "acct-top" },
      h("div", { class: "acct-row" }, avatar(a),
        h("div", {}, h("h1", { class: "acct-email", id: "acctEmail" }, a.email), h("p", { class: "acct-sub" }, A.accountLabel))),
      button(A.signOut, "ghost", A.busy.signingOut, async () => { await api("/v1/auth/web/logout", { method: "POST", body: {} }); setNoAuto(true); remember(null); load(); }, "acctSignOut"));
    const del = h("p", { class: "acct-delete" }, A.deletePrompt, " ", button(A.deleteLink, "textbtn danger", A.busy.deleting, async () => {
      if (!confirm(A.deleteConfirm)) return;
      await api("/v1/account", { method: "DELETE" }); remember(null); say(A.deleted, false); load();
    }, "acctDeleteGo"), " ", h("span", { class: "acct-sub" }, A.deleteNote));
    return [top, h("div", { class: "acct-grid" }, h("div", { class: "acct-col" }, membership(a), !a.renews && a.billing?.subscription?.status !== "canceled" && plans(a)), h("div", { class: "acct-col" }, devices(a), help())), del];
  }

  async function load() {
    root.replaceChildren(h("p", { class: "acct-sub center acct-loading" }, spinner(), A.loading));
    try { root.replaceChildren(...view(await api("/v1/account"))); }
    catch (e) {
      if (e.status === 401) { if (await autoSignIn()) { load(); return; } remember(null); root.replaceChildren(signIn()); }
      else { root.replaceChildren(); say(errText(e)); }
    }
  }
  // ---------- 插件登录确认（/<语言>/activate/?code=核对码）----------
  async function activate() {
    const T = A.activate;
    const code = (new URLSearchParams(location.search).get("code") || "").trim().toUpperCase().slice(0, 16);
    const card = (...kids) => h("div", { class: "auth" }, h("section", { class: "card auth-card", id: "activate" }, ...kids));
    const bad = () => root.replaceChildren(card(h("h1", { class: "auth-title", id: "actBad" }, T.badTitle), h("p", { class: "auth-sub" }, T.badText)));
    if (!/^[A-Z0-9-]{4,16}$/.test(code)) { bad(); return; }
    root.replaceChildren(h("p", { class: "acct-sub center acct-loading" }, spinner(), A.loading));
    let dev, me;
    try { [dev, me] = await Promise.all([api(`/v1/auth/device/lookup?user_code=${encodeURIComponent(code)}`), api("/v1/account")]); }
    catch (e) {
      if (e.status === 401) { if (await autoSignIn()) { activate(); return; } remember(null); root.replaceChildren(signIn(activate, T.heading, T.signInSub)); return; }
      if (e.code === "code_not_found") { bad(); return; }
      root.replaceChildren(); say(errText(e)); return;
    }
    remember(me.email, isMember(me));
    const done = () => root.replaceChildren(card(h("h1", { class: "auth-title act-done", id: "actDone" }, T.doneTitle), h("p", { class: "auth-sub" }, T.doneText)));
    const approve = async () => {
      try { await api("/v1/auth/device/approve", { method: "POST", body: { user_code: code, approve: true } }); }
      catch (e) {
        if (e.code === "device_limit") { limit(e.data?.devices || []); return; }
        if (e.code === "code_not_found") { bad(); return; }
        throw e;
      }
      done();
    };
    // 设备满了（3 台）：挑一台移除，移除后接着确认
    const limit = (list) => root.replaceChildren(card(h("h1", { class: "auth-title" }, T.limitTitle), h("p", { class: "auth-sub" }, T.limitText),
      h("div", { class: "act-devices", id: "actDevices" }, list.map((d) => h("div", { class: "acct-row between acct-device" },
        h("span", {}, d.name || "—", h("span", { class: "acct-sub" }, ` · ${date(d.last_seen_at)}`)),
        button(A.remove, "ghost sm", A.busy.removing, async () => { await api(`/v1/devices/${d.id}`, { method: "DELETE" }); await approve(); }))))));
    // 核对码是这个浏览器里的清流插件发起的：直接确认，不用再点（别人发来的链接问不出这个码，照旧要用户自己点）
    const mine = await askExt({ type: "cfPending" });
    if (mine?.code === code) {
      root.replaceChildren(h("p", { class: "acct-sub center acct-loading" }, spinner(), T.confirming));
      try { await approve(); return; } catch (e) { say(errText(e)); }
    }
    const [before, after] = T.check.split("{code}");
    root.replaceChildren(card(
      h("h1", { class: "auth-title" }, T.heading),
      h("div", { class: "act-who" }, avatar(me, "acct-avatar sm"), h("span", { id: "actEmail" }, me.email)),
      h("p", { class: "auth-sub", id: "actDevice" }, fill(T.device, { device: dev.device_name || "—" })),
      h("p", { class: "act-code" }, before, h("b", { id: "actCode" }, code), after || ""),
      button(T.confirm, "primary full", T.confirming, approve, "actGo"),
      h("p", { class: "auth-resend" }, button(T.switchAccount, "textbtn", A.busy.signingOut, async () => {
        await api("/v1/auth/web/logout", { method: "POST", body: {} }); setNoAuto(true); remember(null); activate();
      }, "actSwitch"))));
  }
  if (D.page === "activate") activate(); else load();
})();
