import { createElectricShade } from "./electricity.mjs";
import { createVertexRipple } from "./vertex-ripple.mjs";
import { createSpringWave, springWGSL } from "./spring-wave.mjs";

// Presets supply geometry + a shade; the shared host handles input and lifecycle.
// Each geometry implementation restores only the native channels it owns.
const presets = {
  electric: ({ model, upload }) => createVertexRipple(model.topology.vertexCount, model.visibleVertices, (values) => upload("vertexSize", values)),
  spring: ({ model, upload }) => createSpringWave(model, upload),
};
export function createNetworkEffect(name, context) {
  const geometry = (presets[name] || presets.spring)(context);
  const shade = createElectricShade(context.onDwell, (host, time) => geometry.paint(host, time));
  if (name !== "electric") shade.wgsl = springWGSL;
  return { ...geometry, shade };
}
