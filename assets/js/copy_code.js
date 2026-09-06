for (const block of document.querySelectorAll("pre")) {
  const code = block.querySelector("pre:not(.lineno), code:not(.language-mermaid)");
  if (!code || block.closest(".code-display-wrapper") || block.parentElement.closest("pre")) continue;
  const button = document.createElement("button");
  button.className = "copy";
  button.type = "button";
  button.textContent = "Copy";
  button.setAttribute("aria-label", "Copy code to clipboard");
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.innerText);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy failed";
    }
    setTimeout(() => {
      button.textContent = "Copy";
    }, 2500);
  });
  const wrapper = document.createElement("div");
  wrapper.className = "code-display-wrapper";
  block.before(wrapper);
  wrapper.append(block, button);
}
