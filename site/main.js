// Home page: the scene tabs of the before/after comparison (arrow keys move between them), the phone-width switch between the two
// sides (switches to "after" once, a moment after a comparison first comes into view; not with reduced motion or once touched),
// and sections fading up as they come into view.
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const demo = document.querySelector(".demo");
  if (demo) {
    const tabs = [...demo.querySelectorAll('[role="tab"]')];
    let touched = false;
    const select = (tab, focus) => {
      for (const t of tabs) {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
      }
      for (const p of demo.querySelectorAll(".scene")) p.hidden = p.dataset.scene !== tab.dataset.scene;
      for (const im of demo.querySelectorAll(`.scene[data-scene="${tab.dataset.scene}"] img`)) im.loading = "eager";
      if (focus) tab.focus();
      tab.scrollIntoView({ block: "nearest", inline: "nearest", behavior: still ? "auto" : "smooth" });
    };
    for (const t of tabs) {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const i = tabs.indexOf(t);
        const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        select(tabs[(next + tabs.length) % tabs.length], true);
      });
    }
    const show = (cmp, which) => {
      cmp.dataset.show = which;
      for (const b of cmp.querySelectorAll(".flip button")) b.setAttribute("aria-pressed", String(b.dataset.show === which));
    };
    for (const cmp of demo.querySelectorAll(".cmp")) {
      for (const b of cmp.querySelectorAll(".flip button")) b.addEventListener("click", () => { touched = true; show(cmp, b.dataset.show); });
    }
    // only matters at phone width, where one side is shown at a time
    if (!still && "IntersectionObserver" in window && matchMedia("(max-width: 759px)").matches) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          setTimeout(() => { if (!touched) show(e.target, "after"); }, 1600);
        }
      }, { threshold: 0.4 });
      for (const cmp of demo.querySelectorAll(".cmp")) io.observe(cmp);
    }
  }

  if (still || !("IntersectionObserver" in window)) return;
  const items = document.querySelectorAll(".feat, .step, .pv, .spot-grid > *, .cost-grid > *, .qas");
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  for (const el of items) {
    if (el.getBoundingClientRect().top < innerHeight) continue; // already on screen: leave it be
    el.classList.add("reveal");
    io.observe(el);
  }
})();
