// Accessible platform tabs and explicit before/after controls.
(() => {
  for (const demo of document.querySelectorAll(".demo")) {
    const tabs = [...demo.querySelectorAll('[role="tab"]')];
    const select = (tab, focus) => {
      for (const t of tabs) {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
      }
      for (const p of demo.querySelectorAll(".scene")) p.hidden = p.dataset.scene !== tab.dataset.scene;
      if (focus) tab.focus();
      tab.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
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
  }
  const show = (cmp, which) => {
    cmp.dataset.show = which;
    for (const b of cmp.querySelectorAll(".flip button")) b.setAttribute("aria-pressed", String(b.dataset.show === which));
  };
  for (const cmp of document.querySelectorAll(".cmp")) {
    for (const b of cmp.querySelectorAll(".flip button")) b.addEventListener("click", () => { show(cmp, b.dataset.show); });
  }
})();
