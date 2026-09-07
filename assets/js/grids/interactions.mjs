import { mountInspection } from "./inspection.mjs";
import { mountNetworkEffects } from "./network-effects.mjs";

// This entire module is loaded only after the resting scene has rendered.
export function mountInteractions(root, model) {
  const motion = mountNetworkEffects(root);
  motion.attach(model);
  const inspection = mountInspection(root, { motion, onSelect: (item) => motion.select(item) });
  inspection.attach(model);
  return { motion, inspection };
}
