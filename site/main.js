// The before/after demo on the home page: site tabs (arrow keys move between them), the before/after switch, and one automatic
// switch to "after" a moment after the demo first comes into view (not with reduced motion, not once the visitor has touched it).
(() => {
  const demo = document.querySelector(".demo");
  if (!demo) return;
  const tabs = [...demo.querySelectorAll('[role="tab"]')];
  const segs = [...demo.querySelectorAll(".seg button")];
  let touched = false;

  const setState = (state) => {
    demo.dataset.state = state;
    for (const b of segs) b.setAttribute("aria-pressed", String(b.dataset.state === state));
  };
  const select = (tab, focus) => {
    const site = tab.dataset.site;
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    }
    for (const p of demo.querySelectorAll(".pane")) p.hidden = p.dataset.site !== site;
    for (const c of demo.querySelectorAll(".cap")) c.hidden = c.dataset.site !== site;
    for (const im of demo.querySelectorAll(`.pane[data-site="${site}"] img`)) im.loading = "eager";
    if (focus) tab.focus();
  };

  for (const b of segs) b.addEventListener("click", () => { touched = true; setState(b.dataset.state); });
  for (const t of tabs) {
    t.addEventListener("click", () => { touched = true; select(t); });
    t.addEventListener("keydown", (e) => {
      const i = tabs.indexOf(t);
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      touched = true;
      select(tabs[(next + tabs.length) % tabs.length], true);
    });
  }

  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    setTimeout(() => { if (!touched) setState("after"); }, 1400);
  }, { threshold: 0.45 });
  io.observe(demo.querySelector(".win"));
})();
