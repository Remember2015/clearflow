// Accessible platform tabs and explicit before/after controls.
(() => {
  // "View full size": the screenshot opens over the page (a dialog: Esc, the close button or a click outside it closes it, focus goes
  // back to the link) instead of leaving the page for the bare image file. Without scripts the link still opens the image.
  const box = document.querySelector("dialog.lightbox");
  if (box && typeof box.showModal === "function") {
    const shot = box.querySelector("img"), cap = box.querySelector(".lightbox-cap");
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a.enlarge");
      if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      shot.src = a.href;
      shot.alt = a.getAttribute("aria-label") || "";
      if (cap) cap.textContent = a.dataset.label || ""; // "Before" / "After"
      box.showModal();
      box.scrollTop = 0;
    });
    box.addEventListener("click", (e) => { if (e.target === box || e.target.closest(".lightbox-close")) box.close(); });
    box.addEventListener("close", () => { shot.removeAttribute("src"); });
  }
  // Wide screens: the cleaning examples also show the whole page cleaned (the comparison under the cases starts open); narrow ones keep it folded.
  if (typeof matchMedia === "function" && matchMedia("(min-width: 900px)").matches) document.querySelectorAll("#clean details.full-view").forEach((d) => { d.open = true; });
  // Static-host/local preview fallback. Production redirects these entry URLs in worker.js.
  const entry = document.querySelector("[data-language-entry]");
  if (entry) {
    const links = [...entry.querySelectorAll("a[hreflang]")];
    const choices = navigator.languages?.length ? navigator.languages : [navigator.language];
    let target;
    for (const language of choices) {
      const tag = language.toLowerCase();
      target = links.find((a) => a.hreflang.toLowerCase() === tag)
        || links.find((a) => a.hreflang.toLowerCase().split("-")[0] === tag.split("-")[0]);
      if (target) break;
    }
    target ||= links.find((a) => a.hreflang === "en");
    if (target) location.replace(target.pathname + location.search + location.hash);
  }
  const notFound = [...document.querySelectorAll("[data-not-found-copy]")];
  if (notFound.length) {
    const route = location.pathname.split("/")[1];
    const preferences = [route, ...(navigator.languages || [navigator.language])].map((tag) => tag.toLowerCase().split("-")[0]);
    const language = preferences.find((tag) => notFound.some((node) => node.dataset.notFoundCopy === tag)) || "en";
    for (const node of notFound) node.hidden = node.dataset.notFoundCopy !== language;
    document.documentElement.lang = notFound.find((node) => !node.hidden).lang;
  }
  for (const picker of document.querySelectorAll(".langs")) {
    const summary = picker.querySelector("summary");
    for (const link of picker.querySelectorAll("a")) {
      const url = new URL(link.href);
      url.search = location.search;
      url.hash = location.hash;
      link.href = url.href;
    }
    picker.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && picker.open) {
        picker.open = false;
        summary.focus();
        event.preventDefault();
      }
    });
    document.addEventListener("click", (event) => {
      if (!picker.contains(event.target)) picker.open = false;
    });
    picker.addEventListener("focusout", (event) => {
      if (!picker.contains(event.relatedTarget)) picker.open = false;
    });
  }

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
