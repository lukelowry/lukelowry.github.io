import { highlightSearchTerm } from "./highlight-search-term.js";

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("bibsearch");
  const publications = document.getElementById("publication-results");
  if (!input || !publications) return;

  const items = Array.from(publications.querySelectorAll("ol.bibliography > li"));
  const status = document.getElementById("bibsearch-status");
  const empty = document.getElementById("bibsearch-empty");
  let timeoutId;

  const filterItems = (value) => {
    const searchTerm = value.trim().toLowerCase();
    // Match the same citation text in every browser, including its BibTeX key.
    for (const item of items) {
      const text = item.textContent.replace(/\s+/g, " ").toLowerCase();
      item.classList.toggle("unloaded", !text.includes(searchTerm));
    }
    highlightSearchTerm({ search: searchTerm, selector: "#publication-results ol.bibliography > li" });

    for (const heading of publications.querySelectorAll("h2.bibliography")) {
      let sibling = heading.nextElementSibling;
      let hasMatches = false;
      while (sibling && sibling.tagName !== "H2") {
        if (sibling.tagName === "OL") {
          const visible = !!sibling.querySelector("li:not(.unloaded)");
          sibling.classList.toggle("unloaded", !visible);
          if (sibling.previousElementSibling?.tagName === "H3") {
            sibling.previousElementSibling.classList.toggle("unloaded", !visible);
          }
          hasMatches ||= visible;
        }
        sibling = sibling.nextElementSibling;
      }
      heading.classList.toggle("unloaded", !hasMatches);
    }

    const count = items.filter((item) => !item.classList.contains("unloaded")).length;
    status.textContent = `${count} ${count === 1 ? "publication" : "publications"}`;
    empty.hidden = count !== 0;
    publications.classList.toggle("has-no-results", count === 0);
  };

  const updateFromHash = () => {
    clearTimeout(timeoutId);
    let value = window.location.hash.slice(1);
    try {
      value = decodeURIComponent(value);
    } catch {
      // A malformed fragment can still be searched as literal text.
    }
    const target = value ? document.getElementById(value) : null;
    const isCitation = target && publications.contains(target);
    input.value = isCitation ? "" : value;
    filterItems(input.value);
    // Preserve links from the CV to individual papers without treating them as searches.
    if (isCitation) requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  };

  input.addEventListener("input", () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => filterItems(input.value), 150);
  });
  document.getElementById("bibsearch-reset").addEventListener("click", () => {
    clearTimeout(timeoutId);
    input.value = "";
    filterItems("");
    input.focus();
  });
  window.addEventListener("hashchange", updateFromHash);
  updateFromHash();
  document.querySelector(".publication-search").hidden = false;
});
