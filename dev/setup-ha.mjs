// Finish first-run onboarding on the throwaway Home Assistant from docker-compose.yml
// and save a demo login to dev/.credentials (git-ignored).
//   node dev/setup-ha.mjs
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const HA = "http://localhost:8125";
const CLIENT_ID = `${HA}/`;
const CREDS = new URL(".credentials", import.meta.url);

async function api(path, { token, form, json } = {}) {
  const res = await fetch(HA + path, {
    method: "POST",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(json && { "Content-Type": "application/json" }),
    },
    body: form ? new URLSearchParams(form) : JSON.stringify(json ?? {}),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const status = await fetch(`${HA}/api/onboarding`).then((r) => r.json());
const done = new Set(status.filter((s) => s.done).map((s) => s.step));
if (done.has("user") && existsSync(CREDS)) {
  console.log("Already onboarded; login is in dev/.credentials");
  process.exit(0);
}

const password = randomBytes(12).toString("base64url");
const { auth_code } = await api("/api/onboarding/users", {
  json: { client_id: CLIENT_ID, name: "Demo", username: "demo", password, language: "en" },
});
const { access_token, refresh_token } = await api("/auth/token", {
  form: { grant_type: "authorization_code", code: auth_code, client_id: CLIENT_ID },
});
await api("/api/onboarding/core_config", { token: access_token, json: {} });
await api("/api/onboarding/analytics", { token: access_token, json: {} });
await api("/api/onboarding/integration", { token: access_token, json: { client_id: CLIENT_ID, redirect_uri: `${HA}/` } });

writeFileSync(CREDS, JSON.stringify({ url: HA, username: "demo", password, refresh_token }, null, 2) + "\n", { mode: 0o600 });
console.log("Onboarded. Login saved to dev/.credentials");
