// Small status toast, in a shadow root so page CSS can't touch it.
let toastTimer;
function toast(text, kind) {
  let host = document.getElementById("ha-click-to-call-toast");
  if (!host) {
    host = document.createElement("div");
    host.id = "ha-click-to-call-toast";
    host.attachShadow({ mode: "open" }).innerHTML = `
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
    document.documentElement.append(host);
  }
  const el = host.shadowRoot.querySelector("div");
  el.textContent = text;
  el.className = kind;
  clearTimeout(toastTimer);
  if (kind !== "pending") toastTimer = setTimeout(() => (el.className = "hidden"), kind === "error" ? 5000 : 2500);
}

// `label` is the number as the page showed it, e.g. "(905) 786 0234".
function showResult(r, label) {
  if (r?.ok) toast(`📱 Sent ${label || r.number} to your phone`, "ok");
  else toast(`Couldn't send: ${r?.error || "unknown error"}`, "error");
}

// Intercept clicks on tel: links and hand the number to the background script.
// Alt/Option-click falls through to the browser's normal tel: handler.
document.addEventListener(
  "click",
  async (e) => {
    if (e.button !== 0 || e.altKey || e.defaultPrevented) return;
    const link = e.target instanceof Element && e.target.closest('a[href^="tel:" i]');
    if (!link) return;
    e.preventDefault();
    e.stopPropagation();
    toast("Sending to your phone…", "pending");
    // Use the link text only when it is the number itself, not e.g. "Call reception".
    const shown = link.textContent.replace(/\s+/g, " ").trim();
    const label = /\d{3}/.test(shown) && shown.length <= 30 ? shown : null;
    showResult(await chrome.runtime.sendMessage({ type: "call", number: link.getAttribute("href").slice(4) }), label);
  },
  true
);

// Right-click menu calls are made by the background script, which reports back here.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "toast") msg.pending ? toast("Sending to your phone…", "pending") : showResult(msg.result, msg.label);
});

// Turn plain-text phone numbers into tel: links so the click handler above picks them up.
// North American numbers need separators or a bracketed area code ("416-555-0199",
// "(905) 7860234") so bare IDs and order numbers are left alone; anything else needs a leading "+".
// Separators include non-breaking spaces and Unicode hyphens/dashes (‐ ‑ ‒ –), which sites often use.
const PHONE_RE =
  /(?<![\w+])(?:(?:\+?1[\s.‐-–-]?)?(?:\(\d{3}\)\s?\d{3}[\s.‐-–-]?\d{4}|\d{3}[\s.‐-–-]\d{3}[\s.‐-–-]\d{4})|\+\d{1,3}(?:[\s.‐-–-]?\(?\d{1,5}\)?){1,5})(?![\w‐-–-])/g;
const SKIP = "a, script, style, noscript, textarea, input, select, option, button, code, pre, svg, [contenteditable]";

function linkify(textNode) {
  const text = textNode.nodeValue;
  const parent = textNode.parentElement;
  if (!parent || parent.closest(SKIP)) return;
  let last = 0;
  let frag;
  for (const m of text.matchAll(PHONE_RE)) {
    // "+49 (0)30 …": the (0) is only dialled domestically.
    const number = m[0].replace(/\(0\)/g, "").replace(/[^\d+]/g, "");
    const digits = number.replace(/\D/g, "").length;
    if (digits < 7 || digits > 15) continue;
    frag ??= document.createDocumentFragment();
    frag.append(text.slice(last, m.index));
    const a = document.createElement("a");
    a.href = `tel:${number}`;
    a.textContent = m[0];
    a.title = "Call on phone (HA Click-to-Call)";
    a.style.cssText = "color: inherit; text-decoration: underline dotted; cursor: pointer;";
    frag.append(a);
    last = m.index + m[0].length;
  }
  if (!frag) return;
  frag.append(text.slice(last));
  textNode.replaceWith(frag);
}

function scan(root) {
  if (root.nodeType === Node.TEXT_NODE) return linkify(root);
  if (root.nodeType !== Node.ELEMENT_NODE || root.closest(SKIP)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (/\d{3}/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(linkify);
}

function startLinkifying() {
  scan(document.body);
  // Pages that render later (SPAs, infinite scroll): batch new nodes and scan them together.
  let pending = new Set();
  let timer;
  new MutationObserver((mutations) => {
    for (const m of mutations) m.addedNodes.forEach((n) => pending.add(n));
    clearTimeout(timer);
    timer = setTimeout(() => {
      const nodes = pending;
      pending = new Set();
      nodes.forEach((n) => n.isConnected && scan(n));
    }, 300);
  }).observe(document.body, { childList: true, subtree: true });
}

chrome.storage.local.get("linkify").then(({ linkify = true }) => {
  if (!linkify) return;
  if (document.body) startLinkifying();
  else document.addEventListener("DOMContentLoaded", startLinkifying, { once: true });
});

// Keep the right-click menu item in sync with the current selection.
let selectionTimer;
document.addEventListener("selectionchange", () => {
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => {
    const text = String(document.getSelection() || "").slice(0, 100);
    chrome.runtime.sendMessage({ type: "selection", text }).catch(() => {});
  }, 100);
});
