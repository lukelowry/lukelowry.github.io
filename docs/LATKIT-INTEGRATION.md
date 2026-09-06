# Latkit integration

`@latkit/embed` 0.8.0 and `@latkit/network` 0.9.0 are exact npm dependencies;
`package-lock.json` pins the full dependency graph. `npm run build:js` bundles registration,
`parseNetwork` into ignored `assets/generated/latkit.js`,
with license notices and version metadata. Preview and CI build it before Jekyll.
No Latkit implementation is maintained in this repository or fetched at browser runtime from a CDN.

## Website code

`assets/js/grids/index.mjs` loads only the scene the page uses:

- `home.mjs`: lazy loading, named fields, native paint readiness, lighting, and section reveals.
- `inspection.mjs`: pinned readout, accessible exposed bus/branch browsing, and touch cancellation.
- `electricity.mjs` / `pulse.mjs`: a custom native fragment shade, pointer wake, and visible-graph pulses.
- `vertex-ripple.mjs`: native vertex radii, local pressure, sweep waves, and connected rebound.
- `effect-preference.mjs`: shared site-level motion choice, persisted in local storage.
- `framing.mjs`: north-up, oversized USA/Europe compositions (2.10/2.15 zoom).
- `data.mjs` / `voltage.mjs`: cached input, native parsing, bus IDs, visibility, and voltage colors.
- `wave.mjs` / `signal.mjs`: the separate Projects animation and its controls.

Each case is assigned once. Latkit owns the canvas, picking, overlap cycling, touch scrolling,
backing-store resize, and the render loop. Resizing retains the canvas, data, selection, and GPU buffers.
A 120 ms settled adjustment restores our custom subset fit and asymmetric alignment with one fit
and at most two corrections. Whole-topology fit padding cannot express these oversized compositions.
The western USA and eastern Europe intentionally extend offscreen; visible coastline checks protect Maine and Florida.

The custom `Shade` uses Latkit's existing render loop and its 64-float uniform block. A 190 px
light follows mouse/pen input with 70 ms easing; fast movement leaves a 680 ms wake on the wires.
The network itself responds through `vertexSize`: a 115 px pressure field enlarges nearby buses
by up to 65%; fast sweeps emit bounded, 900 ms expanding size waves. A slight contraction follows
the crest. There is no cursor overlay. Visual pointer tracking extends
across page content without changing native picking. After a
680 ms dwell near an exposed bus, one pulse branches through visible connections. Selecting a
bus or branch (including by keyboard or touch) launches a stronger pulse. These are illustrative
hop-distance signals, not electrical simulations.

`pulse.mjs` builds visible adjacency once, then computes at most 18 hops when a pulse starts.
It uploads `vertexShade` and `edgeShade` once each per pulse. The GPU advances the light from
those fixed distances; vertex radii follow the same hop front with a small rebound. All size
contributions are clamped to 0.85-1.85 times the resting radius. The source voltage colors,
positions, heights, edge widths, camera pose, and selection remain independent.

`vertex-ripple.mjs` caches native projected positions in spatial buckets after each settled fit.
Only nearby buckets are visited for pointer waves; the reusable full size buffer is uploaded through
`vertexSize` when it changes. Matching `sizeRange` and channel domains preserve a radius of exactly
1 at rest. Cancellation or complete decay clears the channel. Native picking follows these same
radii. No extra animation loop is installed; size changes share the shade tick.
The light, wake, and pulse settle to idle. Scroll, blur, resize, and page hiding cancel animation;
the pointer-driven network effects start enabled, including when the browser requests reduced
motion. The caption offers "Pause effects" / "Enable effects". Only a deliberate site-level pause
disables them; the choice persists across reloads. A fresh public-site visit works without importing
any localhost preference. Local preview links support `?effects=on`, `off`, or `default`. Touch retains
native tap selection and page gestures.
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
  resize can shift the light slightly. That coordinate conversion remains owned by Latkit.

## Verification

Run the README checks. Browser coverage includes coastline geometry, hover/selection/cycling,
keyboard access, touch scrolling/cancellation, resize retention, themes, reduced motion, and fallback.
Browser checks require real vertex-size channel changes, restored radii, idle rendering, no cursor
overlay, and visible network shader output, including a fresh origin with no saved choice
while the browser still reports reduced motion. This covers the actual Windows/Chrome
configuration that disabled the initial implementation despite ordinary motion-enabled tests passing.
Headless Linux runners may expose `navigator.gpu` without an available adapter. In that case the
preference check verifies the visible static poster and hidden interaction controls, and explicitly
reports that live GPU coverage was skipped. A fallback with an available adapter still fails the
check. Keep the Chrome run on a GPU-capable machine for shader, geometry, and motion verification.
Grid checks also cover pulse forks, cycles, hidden connections, disconnected components, dwell
rearming, wake decay, local pressure, outward waves, size bounds, rebound, cancellation, and return to idle.
Target 16.7 ms frames on a 60 Hz display; performance is hardware-dependent. A physical touch-device
and screen-reader review remains appropriate before publishing.

Grid exports remain reproducible with `tools/export-grids.py`; their manifest records source hashes
and counts. Cross-voltage branches, unknown voltage, and resulting isolated vertices are hidden.
Europe line bends are retained. Authored prose and project descriptions are separate from these fixtures.
