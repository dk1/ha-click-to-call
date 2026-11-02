// Prints a short-lived access token for the demo Home Assistant (from dev/.credentials).
import { readFileSync } from "node:fs";
const c = JSON.parse(readFileSync(new URL(".credentials", import.meta.url), "utf8"));
const res = await fetch(`${c.url}/auth/token`, {
  method: "POST",
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: c.refresh_token, client_id: `${c.url}/` }),
});
process.stdout.write((await res.json()).access_token);
