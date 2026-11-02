// Regenerates docs/screenshots/*.png (and the two the settings page shows, in
// extension/screenshots) against the throwaway Home Assistant from
// docker-compose.yml and the Android emulator.
//   cd dev && npm run ha:up        # start and onboard the demo Home Assistant (port 8125)
//   npm run screenshots            # needs the emulator running with the Companion app signed in
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const DEV = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(DEV, "..");
const EXT = join(ROOT, "extension");
const OUT = join(ROOT, "docs", "screenshots");
// Shown on the settings page, so they ship inside the extension too.
const SHIPPED = ["ha-automation", "phone-overlay-setting"];
const CREDS = JSON.parse(readFileSync(join(DEV, ".credentials"), "utf8"));
const HA = CREDS.url;
const WEBHOOK_ID = "click-to-call-demo-0123456789abcdef";
const BLUEPRINT_URL = "https://github.com/dk1/ha-click-to-call/blob/main/blueprints/ha_click_to_call.yaml";
const ADB = join(homedir(), "Library/Android/sdk/platform-tools/adb");
const CHROME = execFileSync("find", [join(DEV, ".chrome"), "-name", "Google Chrome for Testing", "-type", "f", "-path", "*MacOS*"])
  .toString().trim().split("\n")[0];
const only = process.argv.slice(2); // e.g. `node screenshots.mjs phone` to redo one group

mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (group) => !only.length || only.includes(group);

// A copy of the extension that may reach the demo Home Assistant without the
// permission prompt, which a script can't click.
function buildExtension() {
  const dir = join(DEV, ".build", "extension");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(EXT, dir, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf8"));
  manifest.host_permissions = [`${HA}/*`];
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return dir;
}

// Orange outline around the elements a step talks about (searches shadow DOM too).
async function highlight(page, selectors) {
  await page.evaluate((selectors) => {
    const find = (sel, root = document) => {
      const hit = root.querySelector(sel);
      if (hit) return hit;
      for (const el of root.querySelectorAll("*")) if (el.shadowRoot) { const h = find(sel, el.shadowRoot); if (h) return h; }
    };
    for (const el of window.__highlighted ?? []) el.style.outline = el.style.outlineOffset = "";
    window.__highlighted = selectors.map((sel) => {
      const el = find(sel);
      if (!el) throw new Error(`highlight target not found: ${sel}`);
      Object.assign(el.style, { outline: "3px solid #e8590c", outlineOffset: "3px" });
      return el;
    });
  }, selectors);
}

async function shot(page, name, clip) {
  await page.screenshot({ path: join(OUT, `${name}.png`), ...(clip && { clip }) });
  console.log("wrote", name);
}

function ship() {
  for (const name of SHIPPED) cpSync(join(OUT, `${name}.png`), join(EXT, "screenshots", `${name}.png`));
}

async function desktop() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    pipe: true,
    enableExtensions: [buildExtension()],
    defaultViewport: { width: 1100, height: 900, deviceScaleFactor: 2 },
  });
  const worker = await (await browser.waitForTarget((t) => t.type() === "service_worker")).worker();
  const extId = new URL(worker.url()).host;
  // The settings page shows a typical Nabu Casa setup; the web page further down
  // really sends to the demo Home Assistant.
  const settings = (url) => worker.evaluate((s) => chrome.storage.local.set(s), {
    webhookUrl: `${url}/api/webhook/${WEBHOOK_ID}`,
    haAddress: url,
    webhookId: WEBHOOK_ID,
    linkify: true,
  });
  await settings("https://abcd1234.ui.nabu.casa");

  // Settings page, one shot per section.
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extId}/options.html`);
  await page.evaluate(() => document.getElementById("haAddress").dispatchEvent(new Event("change")));
  const sections = await page.$$("section");
  await highlight(page, ["#copyId"]);
  await shot(page, "settings-step2", await sections[1].boundingBox());
  await highlight(page, ["#haAddress", "#save"]);
  await shot(page, "settings-step4", await sections[3].boundingBox());
  await settings(HA);

  // A web page with a detected number, then the "Sent" message after clicking it.
  const server = createServer((req, res) => res.end(readFileSync(join(DEV, "demo-page.html")))).listen(0);
  const demo = await browser.newPage();
  await demo.setViewport({ width: 900, height: 560, deviceScaleFactor: 2 });
  await demo.goto(`http://localhost:${server.address().port}/`);
  await demo.waitForSelector('#front-desk a[href^="tel:"]');
  await demo.hover("#front-desk a");
  await sleep(300);
  await shot(demo, "page-number");
  await demo.click("#front-desk a");
  await demo.waitForFunction(() =>
    document.getElementById("ha-click-to-call-toast")?.shadowRoot.querySelector("div").className === "ok", { timeout: 10000 });
  await shot(demo, "page-sent");
  server.close();
  await browser.close();
}

// Home Assistant pages, signed in by handing the frontend a token from dev/.credentials.
async function homeAssistant() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1280, height: 860, deviceScaleFactor: 2 } });
  const page = await browser.newPage();
  const tokens = await fetch(`${HA}/auth/token`, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: CREDS.refresh_token, client_id: `${HA}/` }),
  }).then((r) => r.json());
  await page.goto(`${HA}/auth/authorize`);
  await page.evaluate((t, ha) => localStorage.setItem("hassTokens", JSON.stringify({
    ...t, refresh_token: t.refresh_token, hassUrl: ha, clientId: `${ha}/`, expires: Date.now() + t.expires_in * 1000,
  })), { ...tokens, refresh_token: CREDS.refresh_token }, HA);

  // The blueprint list, which has the import button.
  await page.goto(`${HA}/config/blueprint/dashboard`, { waitUntil: "networkidle0" });
  await page.locator("::-p-text(HA Click-to-Call)").wait();
  await sleep(500);

  // Import dialog with the blueprint URL typed in.
  await page.mouse.click(1179, 819); // the floating "Import blueprint" button, bottom right
  await sleep(1200);
  await page.evaluate(() => {
    const deep = (root, sel) => {
      const hit = root.querySelector(sel);
      if (hit) return hit;
      for (const el of root.querySelectorAll("*")) if (el.shadowRoot) { const h = deep(el.shadowRoot, sel); if (h) return h; }
    };
    deep(deep(document, "ha-dialog-import-blueprint").shadowRoot, "input").focus();
  });
  await page.keyboard.type(BLUEPRINT_URL);
  await sleep(500);
  await shot(page, "ha-import");
  await page.keyboard.press("Escape");

  // The automation's phone and webhook fields, at a narrow width so they stack and
  // stay readable beside step 2 on the settings page.
  await page.setViewport({ width: 620, height: 1400, deviceScaleFactor: 2 });
  await page.goto(`${HA}/config/automation/edit/click_to_call_demo`, { waitUntil: "networkidle0" });
  await page.locator("::-p-text(Webhook ID)").wait();
  await sleep(800);
  await shot(page, "ha-automation", { x: 22, y: 365, width: 576, height: 540 });
  await browser.close();
}

async function phone() {
  const adb = (...args) => execFileSync(ADB, ["-s", "emulator-5554", ...args], { maxBuffer: 64 << 20 });
  const cap = (name) => { writeFileSync(join(OUT, `${name}.png`), adb("exec-out", "screencap", "-p")); console.log("wrote", name); };
  adb("shell", "input", "keyevent", "KEYCODE_WAKEUP");
  adb("shell", "input", "keyevent", "KEYCODE_HOME");
  await sleep(1000);
  await fetch(`${HA}/api/webhook/${WEBHOOK_ID}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number: "9055550142" }),
  });
  await sleep(3500); // notification, then the dialer opening behind it
  // Keep the old picture if the phone didn't get the push (e.g. app signed out).
  if (/dialer/i.test(adb("shell", "dumpsys", "window").toString().match(/mCurrentFocus=.*/)?.[0])) cap("phone-dialer");
  else console.warn("dialer didn't open; kept the old phone-dialer.png");
  await overlaySetting(adb);
}

// Where to find "Display over other apps": the app's App info page, then the toggle.
// Both screens are put side by side in one image with the rows to tap outlined.
async function overlaySetting(adb) {
  const bounds = (text) => {
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
    const xml = adb("shell", "cat", "/sdcard/ui.xml").toString();
    const m = xml.match(new RegExp(`text="${text}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
    if (!m) throw new Error(`not on screen: ${text}`);
    return m.slice(1).map(Number);
  };
  const png = () => adb("exec-out", "screencap", "-p").toString("base64");
  adb("shell", "am", "force-stop", "com.android.settings");
  adb("shell", "am", "start", "-W", "-a", "android.settings.APPLICATION_DETAILS_SETTINGS", "-d", "package:io.homeassistant.companion.android");
  await sleep(2500);
  for (let i = 0; i < 2; i++) { adb("shell", "input", "swipe", "540", "1800", "540", "700", "400"); await sleep(1000); }
  // Scroll the row to just under the "Advanced" heading, about 1000px down.
  let row = bounds("Display over other apps");
  if (row[1] > 1050) {
    adb("shell", "input", "swipe", "540", "1800", "540", String(1800 - (row[1] - 1000)), "1500");
    await sleep(1000);
    row = bounds("Display over other apps");
  }
  const info = png();
  adb("shell", "input", "tap", String((row[0] + row[2]) / 2), String((row[1] + row[3]) / 2));
  await sleep(2000);
  const toggle = bounds("Allow display over other apps");
  const allow = png();
  adb("shell", "input", "keyevent", "KEYCODE_HOME");

  // Phone pixels to image pixels: 1080 wide screens shown 300 wide, top 1450px only.
  const k = 300 / 1080;
  // Outline the whole row; the App info row has a second line ("Not allowed") under it.
  const box = ([, y1, , y2], extra) =>
    `left:${42 * k}px;top:${(y1 - 34) * k}px;width:${996 * k}px;height:${(y2 - y1 + 68 + extra) * k}px`;
  const screen = (img, b, extra) => `<div class="screen"><img src="data:image/png;base64,${img}"><i style="${box(b, extra)}"></i></div>`;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 720, height: 420, deviceScaleFactor: 2 } });
  const page = await browser.newPage();
  await page.setContent(`<style>
    body { margin: 0; display: flex; align-items: center; gap: 20px; padding: 16px; width: fit-content; background: #fff; font: 28px system-ui; color: #888; }
    .screen { position: relative; width: 300px; height: ${1450 * k}px; overflow: hidden; border: 1px solid #dde1e8; border-radius: 12px; }
    .screen img { width: 300px; display: block; }
    .screen i { position: absolute; border: 3px solid #e8590c; border-radius: 10px; box-sizing: border-box; }
  </style>${screen(info, row, 50)}<span>→</span>${screen(allow, toggle, 0)}`);
  const body = await page.$("body");
  await body.screenshot({ path: join(OUT, "phone-overlay-setting.png") });
  console.log("wrote phone-overlay-setting");
  await browser.close();
}

if (want("desktop")) await desktop();
if (want("ha")) await homeAssistant();
if (want("phone")) await phone();
ship();
