import { visibleVoltageNetwork } from "./voltage.mjs";

let runtime;
const models = new Map();

// Latkit owns topology/field decoding. Bus IDs are site metadata, outside NetworkJSON.
function busNumbers(slot) {
  const bytes = Uint8Array.from(atob(slot.base64), (char) => char.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  return Uint32Array.from({ length: bytes.byteLength / 4 }, (_, i) => view.getUint32(i * 4, true));
}

export function loadRuntime(root) {
  runtime ??= (async () => {
    if (!navigator.gpu || !(await navigator.gpu.requestAdapter())) throw new Error("WebGPU unavailable");
    return import(root.dataset.runtime);
  })();
  return runtime;
}

// Each case is fetched once per page; signal frames are still generated locally.
export async function loadGrid(root, name = root.dataset.case || "USA") {
  if (!["USA", "EuropeA"].includes(name)) throw new Error("Unknown grid case");
  const { parseNetwork } = await loadRuntime(root);
  const key = `${root.dataset.assets}${name}`;
  if (!models.has(key))
    models.set(
      key,
      (async () => {
        const compressed = "DecompressionStream" in window;
        const response = await fetch(`${key}.json${compressed ? ".gz" : ""}`);
        if (!response.ok) throw new Error(`Grid request failed: ${response.status}`);
        const json = await (compressed ? new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).json() : response.json());
        const { topology, fields } = parseNetwork(json);
        const field = (id) => {
          const entry = fields?.find((value) => value.id === id);
          if (!entry) throw new Error(`Missing grid field: ${id}`);
          return entry.values;
        };
        const kv = field("kv");
        const branchKV = field("branch_kv");
        const layers = visibleVoltageNetwork(kv, topology.edges);
        return {
          topology,
          kv,
          branchKV,
          voltageColors: json.voltageColors,
          ...layers,
          numbers: busNumbers(json.busNumbers),
        };
      })()
    );
  return models.get(key);
}

export const loadUSA = (root) => loadGrid(root, "USA");

export const isDark = () => document.documentElement.dataset.theme === "dark";

export function surfaceColor() {
  // Read the target theme token, not an in-between body color during its transition.
  const token = getComputedStyle(document.documentElement).getPropertyValue("--global-bg-color").trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(token)) {
    const hex = token.length === 4 ? "#" + [...token.slice(1)].map((char) => char + char).join("") : token;
    return [...rgb(hex), 1];
  }
  const value = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g);
  return value ? [...value.slice(0, 3).map((n) => Number(n) / 255), 1] : [1, 1, 1, 1];
}

export function rgb(hex) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

export function ramp(stops) {
  const colors = stops.map(rgb);
  return (t) => {
    const position = Math.max(0, Math.min(1, t)) * (colors.length - 1);
    const index = Math.min(colors.length - 2, Math.floor(position));
    return colors[index].map((value, i) => value + (colors[index + 1][i] - value) * (position - index));
  };
}

// Data readiness, attachment, and first submitted frame are distinct native states.
function whenState(element, state) {
  if (element.network[state]) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      element.removeEventListener(state, changed);
      element.removeEventListener("error", failed);
      element.removeEventListener("pipelineError", failed);
    };
    const changed = () => {
      if (!element.network[state]) return;
      cleanup();
      resolve();
    };
    const failed = (event) => {
      cleanup();
      reject(event?.detail?.error ?? new Error(`Grid ${state} unavailable`));
    };
    const timeout = setTimeout(failed, 12000);
    element.addEventListener(state, changed);
    element.addEventListener("error", failed);
    element.addEventListener("pipelineError", failed);
  });
}
export const whenAttached = (element) => whenState(element, "attached");
export const whenPainted = (element) => whenState(element, "painted");
