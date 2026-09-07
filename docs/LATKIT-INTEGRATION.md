# Latkit integration

`@latkit/embed` 0.9.0 and `@latkit/network` 0.10.0 are exact npm dependencies;
`package-lock.json` pins the full dependency graph. `npm run build:js` bundles registration,
`parseNetwork` into ignored `assets/generated/latkit.js`,
with license notices and version metadata. Preview and CI build it before Jekyll.
No Latkit implementation is copied into this repository or fetched at browser runtime from a CDN.
The current preview requires the adjacent network source for the unreleased `whenRendered()` API:
`npm run build:js -- --latkit-network-source ../latkit/packages/network/src/index.ts`.
The default npm build deliberately fails its API check until the dependency is updated to a release
containing that contract. Do not deploy this preview against the currently pinned network release.

## Homepage render payload

`tools/build-home-grids.mjs` derives `assets/grids/{USA,EuropeA}.home.bin` and `.bin.gz`
from the full NetworkJSON exports. It runs during `build:js` and `assets:grids`, uses deterministic
gzip, and writes only changed bytes. Both variants have content-busted URLs in the homepage markup.
Projects and JSON downloads continue to use the complete electrical topology and bus IDs.

The homepage stores only visible vertices and same-voltage edges, in their original relative order.
Coordinates and European polyline bends remain Float32-exact; no geographic quantization is used.
Branch kV is derived from its first endpoint only after the exporter verifies exact equality.
Visibility and straight-edge route offsets are generated with filled arrays at decode.
Voltage-layer indices, rendered heights, and per-layer framing hulls are computed at build time.
The exporter rejects changed topology bounds, and records the ratio of the original and compact
Float32 characteristic lengths so native vertex radii, edge widths, and height amplitude stay stable.
This ratio depends on Latkit's current native sizing contract; recheck it when updating Latkit.

The versioned `GHM1` binary has a 12-byte little-endian prefix (magic, JSON header byte count,
complete file byte count), UTF-8 metadata padded to four bytes, then contiguous 32-bit arrays.
`HOME_SECTIONS` in `home-payload.mjs` defines the ordered array types. Metadata includes each array
length, voltage palette and levels, geometry scale, and framing bounds/hulls. The decoder checks
version and section lengths, then uses typed views into the response buffer on little-endian hosts.
No base64 geometry decoding or copying is needed. Large-array changes require a new format version.
The raw variant supports browsers without `DecompressionStream`; invalid payloads use the terminal
scene fallback. `check-home-payload.mjs` compares every visible item to the full source and verifies
reproducibility, framing, colors, geometry, and malformed-input rejection.

The generated bootstrap is self-contained. Desktop scene imports, runtime import, and first data
fetch start together. The bootstrap passes its loading service into the homepage scene, so both
consume the same request; the decoded model replaces the cached payload. Scene URLs and optional
chunks carry content hashes. Mobile stops before those desktop requests. Europe still loads only
when its section approaches. Interaction code and shader setup begin after the final base frame;
font loading and interaction readiness do not gate that frame. Successful live startup uses no poster.

## Website code

`assets/js/grids/index.mjs` chooses the presentation before importing a scene. Viewports at or
below 767px, and devices with a coarse primary pointer and no hover (including rotated phones),
use static images. Fresh mobile visits load no Latkit runtime, topology, picking, shader, or
simulation modules. Width changes on a desktop can mount the live view once or suspend it;
shrinking the window stops network rendering and scroll coordination without losing desktop state.

`presentation.mjs` supplies the shared media preference and sets responsive image sources for the
saved light/dark theme. Keep its media query in sync with `grids.css` and the picture sources in
`grid-backdrop.liquid`, `grid-showcase.liquid`, and `grid-still.liquid`. The mobile homepage places
USA and Europe artwork directly before their reading sections; no fixed layers, masks, captions,
or viewport-height spacers are used. The Projects demo uses a static preview and hides playback
controls. Full animation never overrides the mobile image presentation.

`tools/build-grid-stills.py` derives transparent 640px and 960px WebP variants from the existing
posters, trimming empty margins and preserving the whole network. It runs with `npm run assets:grids`
and can also run separately without rebuilding topology. Only the active theme loads; the second
home illustration and Projects preview use lazy image loading. Picture sources prevent the hidden
desktop posters from downloading on mobile. A no-JavaScript mobile visit gets the light stills.

Desktop scene modules:

- `home.mjs`: lazy loading, named fields, native paint readiness, lighting, and section reveals.
- `inspection.mjs`: exposed bus/branch keyboard interaction and touch cancellation, without a readout.
- `electricity.mjs` / `pulse.mjs`: a custom native fragment shade, pointer wake, and visible-graph pulses.
- `vertex-ripple.mjs`: native vertex radii, local pressure, sweep waves, and connected rebound.
- `effect-preference.mjs`: shared site-level motion choice, persisted in local storage.
- `framing.mjs`: north-up, oversized USA/Europe compositions (2.10/2.15 zoom).
- `data.mjs` / `voltage.mjs`: cached input, native parsing, bus IDs, visibility, and voltage colors.
- `wave.mjs` / `signal.mjs`: the separate Projects animation and its controls.

On desktop, each case is assigned once. Latkit owns the canvas, picking, overlap cycling, touch scrolling,
backing-store resize, and the render loop. Resizing retains the canvas, data, selection, and GPU buffers.
A 120 ms settled adjustment restores our custom subset fit and asymmetric alignment with one fit
and at most two corrections. Whole-topology fit padding cannot express these oversized compositions.
The western USA and eastern Europe intentionally extend offscreen; visible coastline checks protect Maine and Florida.

The custom `Shade` uses Latkit's existing render loop and its 64-float uniform block. A 190 px
light follows mouse/pen input with 70 ms easing; fast movement leaves a 680 ms wake on the wires.
The network itself responds through `vertexSize`: a 115 px pressure field enlarges nearby buses
by up to 65%; fast sweeps emit bounded, 900 ms expanding size waves. A slight contraction follows
the crest. There is no cursor overlay. Visual pointer tracking extends
across page content without changing native picking. Resting the pointer never activates a pulse
or selection. Only deliberate bus/branch selection by click, tap, or keyboard launches a pulse. These are illustrative
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
motion. The accessibility icon at the far-right edge of the header opens theme, animation, and contrast
settings. Full keeps the pointer light, wake, and vertex-radius waves. Reduced uses an immediate,
steady hover light with no trails, pulses, size changes, or continued animation frames.
Off removes the decorative shade while preserving native picking and selection.
The background networks have no captions, hover readouts, or bus information panels.
Escape or blank-space clicks/taps clear a selection. Keyboard instructions remain in the canvas
accessibility description. Touch retains native selection and page gestures.

`theme.js` applies and persists preferences before first paint. Theme defaults to System, animation
to Full, and contrast to Standard. An earlier explicit `grid-effects=off` choice is retained until
an animation option is chosen. A fresh public-site visit needs no saved opt-in. The shared animation
preference also prevents demo autoplay in Reduced/Off; the demo's own Play button remains available
for deliberate playback. Reduced/Off disable site transitions and smooth Back to top scrolling.
Settings work in memory when storage is blocked and synchronize between tabs when storage is available.
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
- `painted` is per attachment, not per data revision. Await `ready`, attachment, then
  `whenRendered()` after configured fields and camera placement before revealing the live canvas.
- Native shader CSS coordinates use one minimum backing/CSS ratio for both axes. Quantized asymmetric
  resize can shift the light slightly. That coordinate conversion remains owned by Latkit.

## Verification

Run the README checks. Browser coverage includes coastline geometry, hover/selection/cycling,
keyboard access, desktop resize retention, themes, reduced motion, and fallback.
Mobile checks cover both themes, 320px and 390px phones, landscape, tablets, native touch scrolling,
zero renderer/topology/desktop-poster requests, no-JavaScript images, and GPU suspension when a
desktop window becomes narrow.
The header panel is checked for keyboard navigation and focus return, cross-page persistence,
light/dark and high contrast accessibility, and fit at 320px. Reduced is checked for visible steady
highlighting with no vertex-size or pulse uploads.
Browser checks require real vertex-size channel changes, restored radii, idle rendering, no cursor
overlay, and visible network shader output, including a fresh origin with no saved choice
while the browser still reports reduced motion. This covers the actual Windows/Chrome
configuration that disabled the initial implementation despite ordinary motion-enabled tests passing.
Headless Linux runners may expose `navigator.gpu` without an available adapter. In that case the
preference check verifies the visible static poster and hidden interaction controls, and explicitly
reports that live GPU coverage was skipped. A fallback with an available adapter still fails the
check. Keep the Chrome run on a GPU-capable machine for shader, geometry, and motion verification.
Grid checks also cover pulse forks, cycles, hidden connections, disconnected components, no hover activation,
wake decay, local pressure, outward waves, size bounds, rebound, cancellation, and return to idle.
Target 16.7 ms frames on a 60 Hz display; performance is hardware-dependent. A physical touch-device
and screen-reader review remains appropriate before publishing.

Grid exports remain reproducible with `tools/export-grids.py`; their manifest records source hashes
and counts. Cross-voltage branches, unknown voltage, and resulting isolated vertices are hidden.
Europe line bends are retained. Authored prose and project descriptions are separate from these fixtures.
