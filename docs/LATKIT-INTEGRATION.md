# Latkit integration

`@latkit/embed` 0.8.0 and `@latkit/network` 0.9.0 are exact npm dependencies;
`package-lock.json` pins the full dependency graph. `npm run build:js` bundles registration,
`parseNetwork`, and the native `spotlight` preset into ignored `assets/generated/latkit.js`,
with license notices and version metadata. Preview and CI build it before Jekyll.
No Latkit implementation is maintained in this repository or fetched at browser runtime from a CDN.

## Website code

`assets/js/grids/index.mjs` loads only the scene the page uses:

- `home.mjs`: lazy loading, named fields, native paint readiness, lighting, and section reveals.
- `inspection.mjs`: pinned readout, accessible exposed bus/branch browsing, and touch cancellation.
- `framing.mjs`: north-up, oversized USA/Europe compositions (2.10/2.15 zoom).
- `data.mjs` / `voltage.mjs`: cached input, native parsing, bus IDs, visibility, and voltage colors.
- `wave.mjs` / `signal.mjs`: the separate Projects animation and its controls.

Each case is assigned once. Latkit owns the canvas, picking, overlap cycling, touch scrolling,
backing-store resize, and the render loop. Resizing retains the canvas, data, selection, and GPU buffers.
A 120 ms settled adjustment restores our custom subset fit and asymmetric alignment with one fit
and at most two corrections. Whole-topology fit padding cannot express these oversized compositions.
The western USA and eastern Europe intentionally extend offscreen; visible coastline checks protect Maine and Florida.

Pointer lighting changes native shade uniforms, without per-bus processing or channel uploads.
A 220 px soft light follows mouse/pen input with a 90 ms easing constant and settles to idle.
Reduced motion disables it. Touch retains native tap selection and page gestures.
Offscreen and hidden-tab scenes pause. Shade failure leaves the basic network usable;
missing WebGPU or a failed scene leaves its static poster.

## Small host policies to revisit upstream

These are verified against network 0.9.0; remove them when upstream behavior covers them:

- Native arrows do not account for hidden vertices, clipped canvas regions, or overlaid page content,
  and do not browse branches. Host keys browse exposed buses/branches with `keyboard: false`.
- A second touch does not cancel the native pending tap. The host temporarily disables inspection
  until all page-wide touch contacts end; it does not intercept normal taps, drags, or scrolling.
- `setPointer(null)` does not always wake a settled shade over blank space. The host clears the pointer
  and resumes the existing native loop once on leave. No additional animation loop is created.
- `painted` is per attachment, not per data revision. Await `ready`, attachment, and paint, then allow
  the configured fields and final composition two frame opportunities before hiding the poster.
- Native shader CSS coordinates use one minimum backing/CSS ratio for both axes. Quantized asymmetric
  resize can shift the light slightly. Fix this in Latkit; do not copy its shader into this website.

## Verification

Run the README checks. Browser coverage includes coastline geometry, hover/selection/cycling,
keyboard access, touch scrolling/cancellation, resize retention, themes, reduced motion, and fallback.
Target 16.7 ms frames on a 60 Hz display; performance is hardware-dependent. A physical touch-device
and screen-reader review remains appropriate before publishing.

Grid exports remain reproducible with `tools/export-grids.py`; their manifest records source hashes
and counts. Cross-voltage branches, unknown voltage, and resulting isolated vertices are hidden.
Europe line bends are retained. Authored prose and project descriptions are separate from these fixtures.
