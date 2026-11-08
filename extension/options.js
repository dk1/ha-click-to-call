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

// Home Assistant serves its app manifest without signing in, so it shows the address is right.
async function isHomeAssistant(origin) {
  try {
    const res = await fetch(`${origin}/manifest.json`, { signal: AbortSignal.timeout(5000) });
    return res.ok && /home assistant/i.test((await res.json()).name);
  } catch {
    return false;
  }
}

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
    return { error: "That doesn't look like an address, for example http://homeassistant.local:8123." };
  if (url.username || url.password) return { error: "Leave out the user name and password." };
  const path = url.pathname.replace(/\/+$/, "");
  const hook = path.match(/^(.*)\/api\/webhook\/([^/]+)$/);
  if (hook) {
    // Split a pasted full URL into its fields once editing is done, not mid-typing.
    if (split) {
      $("webhookId").value = decodeURIComponent(hook[2]);
      $("haAddress").value = url.origin + hook[1];
    }
    return { url: url.origin + path, origin: url.origin };
  }
  if (url.hostname.endsWith("hooks.nabu.casa")) {
    $("webhookId").disabled = true;
    return { url: url.origin + path, origin: url.origin, custom: true };
  }
  const id = $("webhookId").value.trim();
  if (!/^[\w-]{8,}$/.test(id)) return { error: "The webhook ID needs at least 8 letters, numbers, - or _." };
  return { url: `${url.origin}${path}/api/webhook/${id}`, origin: url.origin };
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
  $("linkify").checked = s.linkify ?? true;
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
  // Must run inside the click handler so the browser shows the permission prompt.
  const granted = await chrome.permissions.request({ origins: [`${r.origin}/*`] });
  if (!granted) return status("saveStatus", `Permission to reach ${r.origin} was denied.`, false);
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
  if (await isHomeAssistant(r.origin)) status("saveStatus", "Saved. Home Assistant answered.");
  else status("saveStatus", `Saved, but Home Assistant didn't answer at ${r.origin}. Check the address, or try again from home if it's a home address.`, false);
});

$("test").addEventListener("click", async () => {
  status("testStatus", "Sending…");
  const r = await chrome.runtime.sendMessage({ type: "call", number: $("testNumber").value });
  if (r?.ok) status("testStatus", `Sent. Your phone should buzz and open the dialer.`);
  else status("testStatus", r?.error || "Failed.", false);
});

$("linkify").addEventListener("change", () => chrome.storage.local.set({ linkify: $("linkify").checked }));
