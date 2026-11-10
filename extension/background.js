const MENU_ID = "call-on-phone";
const CLICK_SCRIPT = "click-to-call";

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

async function sendToPhone(raw) {
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
      body: new URLSearchParams({ number }),
      signal: AbortSignal.timeout(10000),
    });
    return { ok: true, number };
  } catch (e) {
    if (e.name === "TimeoutError") return { ok: false, error: "Home Assistant didn't answer in time" };
    return { ok: false, error: "Couldn't reach Home Assistant. Away from home? Use a remote address in the settings" };
  }
}

async function call(raw) {
  const result = await sendToPhone(raw);
  if (result.ok) flash("✓", "#2e7d32", `Sent ${result.number} to phone`);
  else flash("!", "#c62828", result.error);
  return result;
}

chrome.runtime.onInstalled.addListener(() => {
  // One item for both phone links and selected text: with two, a link whose text is also
  // selected shows both, and Chrome tucks an extension's items into a submenu.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Call on phone",
      contexts: ["link", "selection"],
      targetUrlPatterns: ["tel:*"], // Applies to links only; any selection still shows it.
    });
  });
});

// Show the result on the page. The menu click grants activeTab for this tab, which is
// all the access this needs.
async function showOnPage(tab, frameId, ...args) {
  const target = { tabId: tab.id, frameIds: [frameId ?? 0] };
  try {
    await chrome.scripting.executeScript({ target, files: ["toast.js"] });
    await chrome.scripting.executeScript({
      target,
      func: (kind, result, label) =>
        kind === "pending" ? globalThis.haClickToCall.toast("Sending to your phone…", "pending")
          : globalThis.haClickToCall.showResult(result, label),
      args,
    });
  } catch {} // Pages Chrome doesn't let extensions touch (the Web Store, chrome://); the badge still shows it.
}

async function onMenuClick(info, tab) {
  if (info.menuItemId !== MENU_ID) return;
  const isLink = /^tel:/i.test(info.linkUrl ?? "");
  const raw = isLink ? info.linkUrl.replace(/^tel:/i, "") : info.selectionText;
  if (!raw) return;
  // A selection is shown as the user selected it; a link only has its tel: number.
  const shown = isLink ? "" : raw.replace(/\s+/g, " ").trim();
  const label = /\d{3}/.test(shown) && shown.length <= 30 ? shown : null;
  if (tab?.id >= 0) showOnPage(tab, info.frameId, "pending");
  const result = await call(raw);
  if (tab?.id >= 0) showOnPage(tab, info.frameId, "result", result, label);
}
chrome.contextMenus.onClicked.addListener(onMenuClick);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "call") return;
  call(msg.number).then(sendResponse);
  return true;
});

// Clicking needs access to all sites. If it's taken away (chrome://extensions), stop the
// click script too, so the settings page and the browser agree.
chrome.permissions.onRemoved.addListener(async ({ origins = [] }) => {
  if (!origins.includes("<all_urls>")) return;
  await chrome.scripting.unregisterContentScripts({ ids: [CLICK_SCRIPT] }).catch(() => {});
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

if (typeof module !== "undefined") module.exports = { normalize };
