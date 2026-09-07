// Lightweight startup shared by the entry point and desktop scenes.
let runtime;
const payloads = new Map();

export function loadRuntime(root) {
  if (!navigator.gpu) return Promise.reject(new Error("WebGPU unavailable"));
  // Latkit owns adapter/device acquisition; downloading its code need not wait.
  return (runtime ??= import(root.dataset.runtime));
}

function fetchGridJSON(root, name) {
  const key = `${root.dataset.assets}${name}`;
  if (!payloads.has(key))
    payloads.set(
      key,
      (async () => {
        const compressed = "DecompressionStream" in window;
        const response = await fetch(`${key}.json${compressed ? ".gz" : ""}`);
        if (!response.ok) throw new Error(`Grid request failed: ${response.status}`);
        return compressed ? new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).json() : response.json();
      })()
    );
  return payloads.get(key);
}

export function preloadGrid(root, name = root.dataset.case || "USA") {
  if (!["USA", "EuropeA"].includes(name)) return Promise.reject(new Error("Unknown grid case"));
  if (!navigator.gpu) return Promise.reject(new Error("WebGPU unavailable"));
  return Promise.all([loadRuntime(root), fetchGridJSON(root, name)]);
}

// Once decoded, retain the model rather than its large base64 JSON source too.
export function releaseGridPayload(root, name) {
  payloads.delete(`${root.dataset.assets}${name}`);
}
