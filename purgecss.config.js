module.exports = {
  content: ["_site/**/*.html", "_site/**/*.js", "_site/**/*.mjs"],
  dynamicAttributes: ["data-theme", "data-theme-setting", "data-animation", "data-contrast"],
  safelist: { greedy: [/grid-/, /home-/] },
  css: ["_site/assets/css/*.css"],
  output: "_site/assets/css/",
  skippedContentGlobs: ["_site/assets/**/*.html"],
};
