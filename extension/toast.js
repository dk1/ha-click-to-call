// The "Sent to your phone" message. Injected into a page after a right-click menu call,
// and loaded with content.js when clicking is turned on; both share the extension's
// isolated world, so a second injection reuses the first.
// Wrapped in a function: content scripts share one global scope, so only haClickToCall leaks.
globalThis.haClickToCall ??= (() => {
  // Small status toast, in a shadow root so page CSS can't touch it. Kept by reference
  // rather than looked up by ID, so an element the page makes can't stand in for it.
  let toastTimer;
  let toastHost;
  let toastEl;
  function toast(text, kind) {
    if (!toastHost) {
      toastHost = document.createElement("div");
      toastHost.attachShadow({ mode: "open" }).innerHTML = `
        <style>
          div { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
                z-index: 2147483647; padding: 10px 16px; border-radius: 8px;
                font: 14px/1.3 system-ui, sans-serif; color: #fff; background: #333;
                box-shadow: 0 4px 16px rgba(0,0,0,.25); transition: opacity .2s; }
          .ok { background: #2e7d32; }
          .error { background: #c62828; }
          .hidden { opacity: 0; pointer-events: none; }
        </style>
        <div class="hidden" role="status"></div>`;
      toastEl = toastHost.shadowRoot.querySelector("div");
    }
    if (!toastHost.isConnected) document.documentElement.append(toastHost);
    const el = toastEl;
    el.textContent = text;
    el.className = kind;
    clearTimeout(toastTimer);
    if (kind !== "pending") toastTimer = setTimeout(() => (el.className = "hidden"), kind === "error" ? 5000 : 2500);
  }

  // `label` is the number as the page showed it, e.g. "(905) 555 0142".
  function showResult(r, label) {
    if (r?.ok) toast(`📱 Sent ${label || r.number} to your phone`, "ok");
    else toast(`Couldn't send: ${r?.error || "unknown error"}`, "error");
  }

  return { toast, showResult };
})();
