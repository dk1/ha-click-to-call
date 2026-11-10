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

// `label` is the number as the page showed it, e.g. "(905) 786 0234".
function showResult(r, label) {
  if (r?.ok) toast(`📱 Sent ${label || r.number} to your phone`, "ok");
  else toast(`Couldn't send: ${r?.error || "unknown error"}`, "error");
}

// Phone links, plus Google Maps' "Copy phone number" button, which copies rather than
// opening the dialer and holds the number in data-item-id="phone:tel:+1…". Pages that open
// the dialer from their own code (Google Search, for one) are caught further down.
const PHONE_TARGET = 'a[href^="tel:" i], [data-item-id^="phone:tel:"]';
const numberOf = (el) =>
  el.matches("a") ? el.getAttribute("href").slice(4) : el.getAttribute("data-item-id").slice("phone:tel:".length);

// `label` is the number as the page showed it, when that's all the text is.
const labelOf = (text) => {
  const shown = String(text ?? "").replace(/\s+/g, " ").trim();
  return /\d{3}/.test(shown) && shown.length <= 30 ? shown : null;
};

async function send(number, label) {
  toast("Sending to your phone…", "pending");
  let result;
  try {
    result = await chrome.runtime.sendMessage({ type: "call", number, label });
  } catch {
    // Pages opened before the extension was updated or reloaded lose their connection to it.
    result = { ok: false, error: "the extension was updated. Reload this page and try again" };
  }
  showResult(result, label);
}

// The text of what the user last clicked, to check that a page opening the dialer is
// opening the number the user clicked on (see below).
let lastClick = { time: 0, text: "" };

// Intercept clicks on phone links and hand the number to the background script.
// Alt/Option-click falls through to the page's own handling (the tel: handler, or Maps' copy).
// On the window, in the capture phase, from document_start: that runs before any listener the
// page adds, so a page can't open the tel: link itself first.
window.addEventListener(
  "click",
  (e) => {
    // isTrusted: only a real click by the user, never one a page script fakes with a.click().
    if (!e.isTrusted || e.button !== 0 || e.altKey) return;
    if (e.target instanceof Element) {
      const el = e.target.closest("a, button, [role=button], [role=link]") ?? e.target;
      const labels = [el, ...el.querySelectorAll("[aria-label]")].map((n) => n.getAttribute("aria-label") ?? "");
      lastClick = { time: Date.now(), text: `${el.textContent} ${labels.join(" ")}`.slice(0, 500) };
    }
    const link = e.target instanceof Element && e.target.closest(PHONE_TARGET);
    if (!link) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    // Maps' button also holds an icon, so its aria-label ("Phone: (416) 868-6937") is cleaner.
    send(numberOf(link), labelOf(link.matches("a") ? link.textContent : (link.getAttribute("aria-label") ?? "").replace(/^[^:]*:/, "")));
  },
  true
);

// Pages that open the dialer from their own code, e.g. Google Search's business panel, a
// link to "#" whose click handler sets location.href to tel:. Chrome reports that as a
// navigation, which can be cancelled. Only taken over right after a real click on something
// that shows the same number, so a page can't turn a click into sending a different number.
globalThis.navigation?.addEventListener("navigate", (e) => {
  const url = e.destination.url;
  if (!/^tel:/i.test(url) || !e.cancelable || !navigator.userActivation?.isActive) return;
  if (Date.now() - lastClick.time > 1000) return;
  const number = decodeURIComponent(url.slice(4)).split(/[;?]/)[0];
  const digits = number.replace(/\D/g, "");
  // The last 10 digits, so "+1 905…" opened from "(905) …" still matches.
  const tail = digits.length > 10 ? digits.slice(-10) : digits;
  if (tail.length < 7 || !lastClick.text.replace(/\D/g, "").includes(tail)) return;
  e.preventDefault();
  const shown = lastClick.text.match(/[+(]?\d[\d\s().‐‑‒–-]{5,}\d/g)?.find((m) => m.replace(/\D/g, "").endsWith(tail));
  send(number, labelOf(shown));
});

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

// Off unless turned on in the settings: changing page text can upset some sites.
chrome.storage.local.get("linkify").then(({ linkify = true }) => {
  if (!linkify) return;
  if (document.body) startLinkifying();
  else document.addEventListener("DOMContentLoaded", startLinkifying, { once: true });
});

// Keep the right-click menu item in sync with the current selection.
// After the extension is reloaded or updated, this copy of the script stays on open pages
// but can no longer reach it: chrome.runtime.id goes away and sendMessage throws at once
// (not as a rejected promise), so check first and stop listening.
let selectionTimer;
function syncSelection() {
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => {
    if (!chrome.runtime?.id) return document.removeEventListener("selectionchange", syncSelection);
    const text = String(document.getSelection() || "").slice(0, 100);
    try {
      chrome.runtime.sendMessage({ type: "selection", text }).catch(() => {});
    } catch {}
  }, 100);
}
document.addEventListener("selectionchange", syncSelection);
