const MENU_ID = "ha-click-to-call";

// Keep a leading + and digits; drop formatting, "tel:" params (;ext=…) and whitespace.
function normalize(raw) {
  let s = String(raw || "");
  try {
    s = decodeURIComponent(s);
  } catch {}
  s = s.split(/[;?]/)[0].trim();
  const plus = s.startsWith("+");
  s = s.replace(/\D/g, "");
  return s.length >= 3 && s.length <= 15 ? (plus ? "+" : "") + s : null;
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

async function sendToPhone(raw) {
  const number = normalize(raw);
  if (!number) return { ok: false, error: `"${raw}" doesn't look like a phone number` };

  const { webhookUrl } = await chrome.storage.local.get("webhookUrl");
  if (!webhookUrl) {
    chrome.runtime.openOptionsPage();
    return { ok: false, error: "Finish setting up the extension first" };
  }

  // HA answers 200 for any webhook ID, so success here means "reached Home Assistant".
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number }),
    });
    if (!res.ok) return { ok: false, error: `Home Assistant replied with an error (${res.status})` };
    return { ok: true, number };
  } catch {
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
  toTab({ type: "toast", result: await call(info.selectionText), label: label.length <= 30 ? label : null });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Show the cleaned-up number in the menu, and hide it when the selection has none.
  if (msg?.type === "selection") {
    const number = normalize(msg.text);
    chrome.contextMenus.update(MENU_ID, {
      visible: !!number,
      title: number ? `Call ${number} on phone` : "Call on phone",
    });
    return;
  }
  if (msg?.type !== "call") return;
  call(msg.number).then(sendResponse);
  return true;
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

if (typeof module !== "undefined") module.exports = { normalize };
