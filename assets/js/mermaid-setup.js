const diagrams = [...document.querySelectorAll("pre > code.language-mermaid")].map((code) => {
  const output = document.createElement("div");
  output.className = "mermaid";
  code.parentElement.after(output);
  return { source: code.textContent, fallback: code.parentElement, output };
});
let rendering = false,
  again = false;
async function renderDiagrams() {
  if (rendering) {
    again = true;
    return;
  }
  rendering = true;
  try {
    mermaid.initialize({ startOnLoad: false, theme: document.documentElement.dataset.theme === "dark" ? "dark" : "default" });
    for (const diagram of diagrams) {
      diagram.output.removeAttribute("data-processed");
      diagram.output.textContent = diagram.source;
    }
    await mermaid.run({ nodes: diagrams.map((d) => d.output) });
    for (const diagram of diagrams) diagram.fallback.hidden = true;
    if (typeof d3 !== "undefined")
      d3.selectAll(".mermaid svg").each(function () {
        const svg = d3.select(this),
          content = svg.select("g");
        svg.call(d3.zoom().on("zoom", (event) => content.attr("transform", event.transform)));
      });
  } catch {
    for (const diagram of diagrams) {
      diagram.fallback.hidden = false;
      diagram.output.replaceChildren();
    }
  } finally {
    rendering = false;
    if (again) {
      again = false;
      renderDiagrams();
    }
  }
}
renderDiagrams();
document.addEventListener("themechange", renderDiagrams);
