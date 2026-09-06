# Luke Lowery's website

Jekyll site for About, Publications, Projects, and CV. Based on
[al-folio](https://github.com/alshedivat/al-folio); the original MIT license is retained.

## Preview

Requires Docker Desktop and Node 24.

```sh
npm ci
npm run preview
```

Open http://localhost:4180. Stop with `npm run preview:stop`.
Preview builds the npm runtime before starting Jekyll. The devcontainer does this at initialization.
After changing Latkit dependencies, run `npm run build:js` again.
The preview disables analytics and indexing. Logs: `docker compose -f compose.local.yml logs -f`.

## Verify

After Jekyll finishes building:

```sh
npm run format:check
npm run check:grids
npm run build:css
npm run assets:cv
npm run check:site
npm run check:browser
```

Browser/PDF tools need `npx playwright install chromium`, or installed Chrome with
`SITE_BROWSER_CHANNEL=chrome`. `SITE_ROOT` selects a build other than `_site`.
The CV PDF is generated from `assets/json/resume.json` and preserved during preview rebuilds.
Checks and screenshots write to ignored `output/`.

## Editing

- Prose: `_pages/` and `_projects/`. Homepage sections are explicit Markdown-enabled HTML containers.
- Publications: `_bibliography/papers.bib`. CV: `assets/json/resume.json`.
- Project cards: `img`, optional `img_alt`/`image_fit: contain`, `github`, `readthedocs`, and `marketplace` front matter.
  Remove `noindex: true` and `sitemap: false` when a project outline is ready to index.
- Styles: `assets/css/site.css` for shared UI, `grids.css` for network pages, `_sass/` for theme foundations.
- Optional page features include `math: true`, `code: true`, diagrams, and `toc: { sidebar: right }`.
  SEO, sitemap, themes, responsive images, searchable publications, and CV rendering remain enabled.

Luke owns the authored text and records. Retired authored posts and CV sources remain excluded;
stock template media and documentation have been removed. Deployment is handled by `.github/workflows/deploy.yml`.

[Latkit integration](docs/LATKIT-INTEGRATION.md) documents the npm dependency and the remaining site-specific policies.
[Publication maintenance](docs/PUBLICATION-MAINTENANCE.md) covers the read-only comparison tool.
Before publishing, finish project copy and review the UI with a physical touch device and screen reader.
