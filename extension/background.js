const MENU_ID = "ha-click-to-call";

// Keep a leading + and digits; drop formatting, "tel:" params (;ext=…) and whitespace.
// At least 7 digits, so emergency and short codes (911, 112, 611) are never sent.
function normalize(raw) {
  let s = String(raw || "");
  try {
    s = decodeURIComponent(s);
  } catch {}
  s = s.split(/[;?]/)[0].trim();
  const plus = s.startsWith("+");
  s = s.replace(/\D/g, "");
  return s.length >= 7 && s.length <= 15 ? (plus ? "+" : "") + s : null;
}

function flash(text, color, title) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  chrome.action.setTitle({ title });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setTitle({ title: "HA Click-to-Call" });
  }, 4000);
}

// One number at a time, so nothing can flood the phone.
const MIN_GAP_MS = 3000;
let lastSent = 0;

// The number as the page wrote it, e.g. "(905) 555-0142", for the phone's notification.
// Only short, number-like text is passed on; the automation checks it again.
const cleanLabel = (label) => {
  const s = String(label ?? "").replace(/\s+/g, " ").trim();
  return /^[\d\s()+.\-‐‑‒–]{7,30}$/.test(s) ? s : "";
};

async function sendToPhone(raw, label) {
  const number = normalize(raw);
  if (!number) return { ok: false, error: `"${raw}" doesn't look like a phone number` };
  if (Date.now() - lastSent < MIN_GAP_MS) return { ok: false, error: "Wait a few seconds before sending another number" };
  lastSent = Date.now();

  const { webhookUrl } = await chrome.storage.local.get("webhookUrl");
  if (!webhookUrl) {
    chrome.runtime.openOptionsPage();
    return { ok: false, error: "Finish setting up the extension first" };
  }

  // A plain form POST needs no access to the Home Assistant address (no host permission),
  // but the reply can't be read, so success means "the request reached the address".
  // Home Assistant hands form fields to the automation as trigger.data.
  try {
    await fetch(webhookUrl, {
      method: "POST",
      mode: "no-cors",
      body: new URLSearchParams({ number, ...(cleanLabel(label) && { label: cleanLabel(label) }) }),
      signal: AbortSignal.timeout(10000),
    });
    return { ok: true, number };
  } catch (e) {
    if (e.name === "TimeoutError") return { ok: false, error: "Home Assistant didn't answer in time" };
    return { ok: false, error: "Couldn't reach Home Assistant. Away from home? Use a remote address in the settings" };
  }
}

async function call(raw, label) {
  const result = await sendToPhone(raw, label);
  if (result.ok) flash("✓", "#2e7d32", `Sent ${result.number} to phone`);
  else flash("!", "#c62828", result.error);
  return result;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Call on phone",
    contexts: ["selection"],
    visible: false,
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const toTab = (msg) => tab?.id >= 0 && chrome.tabs.sendMessage(tab.id, msg, info.frameId != null ? { frameId: info.frameId } : {}).catch(() => {});
  toTab({ type: "toast", pending: true });
  const label = info.selectionText.replace(/\s+/g, " ").trim();
  toTab({ type: "toast", result: await call(info.selectionText, label), label: label.length <= 30 ? label : null });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Show the cleaned-up number in the menu, and hide it when the selection has none.
  // Show the number as the page writes it, e.g. "(905) 555-0142", which is easier to read
  // than the digits that are sent; fall back to the digits for long selections.
  if (msg?.type === "selection") {
    const number = normalize(msg.text);
    const shown = String(msg.text).replace(/\s+/g, " ").trim();
    chrome.contextMenus.update(MENU_ID, {
      visible: !!number,
      title: number ? `Call ${shown.length <= 30 ? shown : number} on phone` : "Call on phone",
    });
    return;
  }
  if (msg?.type !== "call") return;
  call(msg.number, msg.label).then(sendResponse);
  return true;
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

if (typeof module !== "undefined") module.exports = { normalize };
