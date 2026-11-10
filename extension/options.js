const BLUEPRINT_URL = "https://github.com/dk1/ha-click-to-call/blob/main/blueprints/ha_click_to_call.yaml";

const $ = (id) => document.getElementById(id);
const status = (id, msg, ok = true) => {
  $(id).textContent = msg;
  $(id).className = `status ${msg ? (ok ? "ok" : "err") : ""}`;
};
const newId = () =>
  "click-to-call-" + [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");

$("importBlueprint").href =
  "https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=" + encodeURIComponent(BLUEPRINT_URL);

// A DNS name (labels of letters, digits and inner hyphens), an IPv4 address, or a bracketed IPv6 address.
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*|\[[0-9a-f:.]+\])$/i;

// Without access to the address the reply can't be read, so this only shows something answers there.
async function isReachable(origin) {
  try {
    await fetch(`${origin}/manifest.json`, { mode: "no-cors", signal: AbortSignal.timeout(5000) });
    return true;
  } catch {
    return false;
  }
}

// A stray % in a pasted address would otherwise throw.
const safeDecode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

let savedUrl = "";
// "Try it" only works once a webhook URL is saved.
const setSaved = (url) => {
  savedUrl = url;
  $("testNumber").disabled = $("test").disabled = !url;
};

// Work out the webhook URL from the address field. Accepts a plain HA address, a full
// .../api/webhook/<id> URL (its ID is copied into the ID field), or a Nabu Casa
// hooks.nabu.casa URL, which is used as-is.
function resolve(split) {
  const raw = $("haAddress").value.trim();
  $("webhookId").disabled = false;
  if (!raw) return { error: "Enter your Home Assistant address." };
  let url;
  try {
    url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) throw new Error();
  } catch {
    return { error: "Start the address with http:// or https://." };
  }
  // URL() quietly turns spaces and other stray characters in the host into %20 and friends.
  if (/\s/.test(raw) || !HOST.test(url.hostname))
    return { error: "That doesn't look like an address. For example: http://homeassistant.local:8123" };
  if (url.username || url.password) return { error: "Leave out the user name and password." };
  const path = url.pathname.replace(/\/+$/, "");
  if (url.hostname.endsWith("hooks.nabu.casa")) {
    $("webhookId").disabled = true;
    return { url: url.origin + path, origin: url.origin, custom: true };
  }
  // Home Assistant always serves from the root, so a pasted page address such as
  // .../lovelace/0 keeps only its origin. A full .../api/webhook/<id> fills in the ID.
  const hook = path.match(/\/api\/webhook\/([^/]+)$/);
  if (split && (hook || path)) {
    if (hook) $("webhookId").value = safeDecode(hook[1]);
    $("haAddress").value = url.origin;
  }
  const id = hook && !split ? safeDecode(hook[1]) : $("webhookId").value.trim();
  if (!/^[\w-]{8,}$/.test(id)) return { error: "The webhook ID needs at least 8 letters, numbers, - or _." };
  return { url: `${url.origin}/api/webhook/${id}`, origin: url.origin };
}

function refresh(split = false) {
  const r = resolve(split);
  const preview = $("urlPreview");
  preview.hidden = !$("haAddress").value.trim();
  preview.textContent = r.error
    ? r.error
    : (r.custom ? "Using your Nabu Casa webhook URL: " : "Sends to ") + r.url;
  preview.style.color = r.error ? "var(--err)" : "";
  if (!r.error && r.url !== savedUrl) status("saveStatus", savedUrl ? "Unsaved changes" : "", false);
  else if (!r.error) status("saveStatus", "Saved");
  return r;
}

chrome.storage.local.get(["webhookUrl", "haAddress", "webhookId", "linkify"]).then((s) => {
  setSaved(s.webhookUrl || "");
  let id = s.webhookId;
  let address = s.haAddress;
  // Settings saved before the ID/address split only have the full URL.
  if (savedUrl && (!id || !address)) {
    const m = savedUrl.match(/^(.*)\/api\/webhook\/([^/]+)$/);
    id ||= m?.[2];
    address ||= m ? m[1] : savedUrl;
  }
  $("webhookId").value = id || newId();
  $("haAddress").value = address || "";
  $("linkify").checked = s.linkify ?? false;
  showLinkifyExample();
  if ($("haAddress").value) refresh(true);
});

$("haAddress").addEventListener("input", () => refresh());
$("haAddress").addEventListener("change", () => refresh(true));
$("webhookId").addEventListener("input", () => refresh());

$("copyId").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("webhookId").value);
  $("copyId").textContent = "Copied";
  setTimeout(() => ($("copyId").textContent = "Copy"), 1500);
});

$("newId").addEventListener("click", () => {
  $("webhookId").value = newId();
  if ($("haAddress").value.trim()) refresh();
  status("saveStatus", "New ID made. Paste it into the automation, then click Save.", false);
});

$("save").addEventListener("click", async () => {
  const r = refresh(true);
  if (r.error) return status("saveStatus", r.error, false);
  await chrome.storage.local.set({
    webhookUrl: r.url,
    haAddress: $("haAddress").value.trim(),
    webhookId: $("webhookId").value.trim(),
  });
  // Drop settings from the earlier token-based version.
  await chrome.storage.local.remove(["haUrl", "token", "service", "action"]);
  setSaved(r.url);
  if (r.custom) return status("saveStatus", "Saved");
  status("saveStatus", "Saved. Checking the address…");
  if (await isReachable(r.origin)) status("saveStatus", `Saved. ${r.origin} is reachable.`);
  else status("saveStatus", `Saved, but nothing answered at ${r.origin}. Check the address, or try again from home if it's a home address.`, false);
});

$("test").addEventListener("click", async () => {
  status("testStatus", "Sending…");
  const r = await chrome.runtime.sendMessage({ type: "call", number: $("testNumber").value, label: $("testNumber").value });
  if (r?.ok) status("testStatus", `Sent. Your phone should buzz and open the dialer.`);
  else status("testStatus", r?.error || "Failed.", false);
});

// The examples under the setting show what it changes; they don't send anything.
function showLinkifyExample() {
  const on = $("linkify").checked;
  $("plainExample").classList.toggle("on", on);
  $("plainExampleNote").textContent = on ? "clickable, with a dotted underline" : "not clickable";
}
document.querySelectorAll("a.example").forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));

$("linkify").addEventListener("change", () => {
  chrome.storage.local.set({ linkify: $("linkify").checked });
  showLinkifyExample();
});
