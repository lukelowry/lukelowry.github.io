# Luke Lowery's website

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner confirmed two audiences have equal priority:

- Research peers and potential collaborators exploring Luke's papers and software tools.
- Academic and industry reviewers assessing Luke's research, experience, and technical background.

Neither audience should have to navigate through an experience designed exclusively for the other.

## Product Purpose

Present Luke Lowery's research, publications, software projects, and professional record in one
credible, accessible personal website. Help visitors understand the work, follow its evidence,
and find the relevant paper, project, CV, or contact information.

The authored introduction connects this work to access to secure, sustainable, affordable energy.
The research areas currently described are large power system stability, graph signal processing,
and engineering education. Preserve the owner's claims and wording unless a task authorizes edits.

## Positioning

The site connects the same researcher's power-systems publications, graph signal processing
software, engineering experience, and interactive network visualization. Its evidence is the actual
research and tools, rather than generic portfolio claims. The network interaction offers a concrete
connection to the work while leaving reading and navigation usable.

## Operating Context

This is an existing Jekyll website based on al-folio, with Liquid templates, SCSS/CSS, JavaScript,
and Latkit WebGPU visualization. The public destination is https://lukelowry.github.io/.
The primary routes are About (`/`), Publications (`/publications/`), Projects (`/projects/`),
and CV (`/cv/`). Visitors can follow publication identifiers, repository/documentation links,
and the downloadable CV without an account.

Local development uses Docker and Node. `npm run preview` serves http://localhost:4180/;
README.md documents the build and verification commands. Local visual review precedes publication.
The current work is local only; installation and initialization do not authorize committing,
pushing, or deploying the website.

Impeccable's local live picker is configured to attach to the generated `_site/**/*.html` pages.
Its injection is temporary and must be renewed after a Jekyll rebuild. Accepted changes belong in
the actual Markdown, Liquid, CSS, or JavaScript source; generated `_site` files are not an editing
source of truth. Live setup does not start an interactive session automatically.

## Capabilities and Constraints

- `_bibliography/papers.bib` is the canonical publication source. The Publications page, selected
  homepage publications, and CV publication section must remain linked to it. CV titles resolve to
  matching publication entries, with DOI links when recorded. Do not maintain another manual list.
- `assets/json/resume.json` owns the other resume sections. The downloadable PDF is generated from
  the built CV and must be refreshed when that page changes.
- The homepage provides interactive network artwork on capable desktop browsers. Effects act on
  the network itself and retain its recognizable shape. Movement should be smooth, local or
  approximately local, and efficient. Resting the pointer must not count as a click.
- Scrolling, resizing, refresh, and reload must preserve predictable framing and usable page flow.
  Avoid a static-image-to-live-embed flash on successful desktop startup. Interaction readiness
  must not unnecessarily delay the first valid network frame.
- Mobile uses still network images to avoid downloading and running the desktop renderer and
  simulation. Devices without WebGPU must retain a usable static fallback.
- Projects has no network embed or associated controls. Do not restore it as decoration.
- Keep appearance and motion settings together behind the accessibility control. The owner rejected
  a prominent pause-effects button, a Clear button, a separate cursor-following overlay, and a
  hovered-bus information box. Do not reintroduce those interactions during routine refinement.
- Project descriptions marked `noindex: true` remain unfinished authored material; do not invent
  missing project copy or remove publication exclusions merely to make the site look complete.

## Brand Commitments

Use the established name, Luke Lowery, and the affiliation recorded in the site's authored content.
Preserve the existing portrait, factual research voice, and the connection between power systems,
mathematics, software, and education. The owner welcomes playful, surprising network interaction
when it is smooth and useful to the experience, and prefers minimal visible controls.

Polish preserves the established identity and content. A new task must explicitly authorize a
redesign or changes to factual claims; an automated design preference is not that authorization.

## Evidence on Hand

- `_pages/about.md`: the owner's introduction, affiliation, and research descriptions.
- `_bibliography/papers.bib`: the publication records and available identifiers.
- `assets/json/resume.json`: professional experience, education, leadership, presentations,
  awards, projects, and contact/profile records.
- `_projects/`: the existing project records, images, repository links, and documentation links.
- `assets/img/prof_pic.jpg`: the existing portrait.
- `assets/grids/` and `assets/js/grids/`: network data, static artwork, and working interactive
  demonstrations. These visual effects are not evidence of physical simulation accuracy.
- `docs/PUBLICATION-MAINTENANCE.md`, `docs/LATKIT-INTEGRATION.md`, and `tools/`: source ownership,
  implementation contracts, and existing checks. Inspect current code when documentation differs.

Do not invent publications, publication status, awards, affiliations, performance results,
project adoption, or testimonials.

## Product Principles

1. Give research exploration and evaluation of Luke's background equal priority.
2. Make evidence easy to reach: papers, tools, experience, and contact information should connect.
3. Keep one authoritative record for each factual content type and derive its presentations from it.
4. Let interaction express the work while protecting reading, performance, and predictable navigation.
5. Prefer focused refinement that respects the owner's content and explicit interaction decisions.

## Accessibility & Inclusion

Preserve keyboard navigation, visible focus, descriptive control names, skip navigation, readable
contrast in both themes, responsive text reflow, and usable CV links. Appearance and animation
preferences persist, and a still or reduced-motion presentation remains available. Content must
remain accessible when JavaScript, WebGPU, or live effects are unavailable. Maintain the existing
browser checks for accessibility, mobile presentation, reload stability, and interaction behavior.

## Open Decisions

No quantitative success metric or recruitment-specific call to action has been agreed. Do not infer
that the owner is actively job-seeking, selling consulting, or targeting one audience above the other.
