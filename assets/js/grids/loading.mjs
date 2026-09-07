// Lightweight startup shared by the entry point and desktop scenes.
let runtime;
const payloads = new Map();

export function loadRuntime(root) {
  if (!navigator.gpu) return Promise.reject(new Error("WebGPU unavailable"));
  // Latkit owns adapter/device acquisition; downloading its code need not wait.
  return (runtime ??= import(root.dataset.runtime));
}

export function gridKey(root, name) {
  return root.dataset.homePayload && name === root.dataset.case ? root.dataset.homePayload : `${root.dataset.assets}${name}`;
}

function fetchGridPayload(root, name) {
  const key = gridKey(root, name);
  if (!payloads.has(key))
    payloads.set(
      key,
      (async () => {
        const compressed = "DecompressionStream" in window;
        const binary = Boolean(root.dataset.homePayload && name === root.dataset.case);
        const url = binary ? (compressed ? root.dataset.homePayloadGzip : key) : `${key}.json${compressed ? ".gz" : ""}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Grid request failed: ${response.status}`);
        const decoded = compressed ? new Response(response.body.pipeThrough(new DecompressionStream("gzip"))) : response;
        return binary ? decoded.arrayBuffer() : decoded.json();
      })()
    );
  return payloads.get(key);
}

export function preloadGrid(root, name = root.dataset.case || "USA") {
  if (!["USA", "EuropeA"].includes(name)) return Promise.reject(new Error("Unknown grid case"));
  if (!navigator.gpu) return Promise.reject(new Error("WebGPU unavailable"));
  return Promise.all([loadRuntime(root), fetchGridPayload(root, name)]);
}

// Once decoded, retain the model rather than its large base64 JSON source too.
export function releaseGridPayload(root, name) {
  payloads.delete(gridKey(root, name));
}
