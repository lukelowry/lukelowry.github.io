document.querySelectorAll("[data-bib-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const opening = button.getAttribute("aria-expanded") !== "true";
    button
      .closest(".links")
      .querySelectorAll("[data-bib-toggle]")
      .forEach((other) => {
        const panel = document.getElementById(other.getAttribute("aria-controls"));
        if (!panel) return;
        const expanded = other === button && opening;
        other.setAttribute("aria-expanded", String(expanded));
        panel.hidden = !expanded;
        panel.classList.toggle("open", expanded);
      });
  });
});
const backToTop = document.getElementById("back-to-top");
if (backToTop) {
  const updateBackToTop = () => {
    backToTop.hidden = window.scrollY < 600;
  };
  window.addEventListener("scroll", updateBackToTop, { passive: true });
  backToTop.addEventListener("click", () => {
    document.getElementById("main-content").focus({ preventScroll: true });
    const reduced = document.documentElement.dataset.animation !== "full" || matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
  });
  updateBackToTop();
}

for (const table of document.querySelectorAll("table")) {
  if (!table.closest(".news, .card, .archive, pre")) table.classList.add("table-hover");
}
const toc = document.querySelector("#toc-sidebar");
if (toc) {
  document.querySelectorAll(".publications h2").forEach((heading) => heading.setAttribute("data-toc-skip", ""));
  window.jQuery(() => window.jQuery("body").scrollspy({ target: "#toc-sidebar", offset: 100 }));
}
window.jQuery('[data-toggle="popover"]').popover({ trigger: "hover focus" });
