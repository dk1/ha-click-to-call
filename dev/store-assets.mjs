// Builds the store listing images in store/images from docs/screenshots, and the
// upload zip in store/dist.
//   cd dev && npm run store
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const DEV = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(DEV, "..");
const SHOTS = join(ROOT, "docs", "screenshots");
const OUT = join(ROOT, "store", "images");
const DIST = join(ROOT, "store", "dist");
const CHROME = execFileSync("find", [join(DEV, ".chrome"), "-name", "Google Chrome for Testing", "-type", "f", "-path", "*MacOS*"])
  .toString().trim().split("\n")[0];

const img = (name) => `data:image/png;base64,${readFileSync(join(SHOTS, `${name}.png`)).toString("base64")}`;
const icon = `data:image/svg+xml;base64,${readFileSync(join(ROOT, "extension", "icons", "icon.svg")).toString("base64")}`;

const css = `
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 800px; overflow: hidden; background: #eef2f7; color: #1d2330;
         font: 18px/1.4 system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; }
  h1 { font-size: 40px; font-weight: 650; letter-spacing: -.01em; }
  .sub { color: #5b6475; font-size: 21px; margin-top: 8px; }
  .head { padding: 48px 64px 0; }
  .stage { flex: 1; display: flex; align-items: center; justify-content: center; gap: 40px; padding: 28px 64px 48px; min-height: 0; }
  .stage img { max-height: 100%; min-width: 0; border-radius: 12px; box-shadow: 0 8px 30px rgba(20, 30, 50, .18); background: #fff; }
  .arrow { font-size: 44px; color: #185fa5; flex: none; }
`;

// 1280×800: what every store accepts.
const screens = {
  "1-click-to-dial": {
    title: "Click a number. Your phone dials it.",
    sub: "Any phone number on a web page goes to your Android phone through Home Assistant.",
    body: `<img src="${img("page-sent")}" style="max-width:820px"><span class="arrow">→</span>
           <img src="${img("phone-dialer")}" style="height:100%">`,
  },
  "2-any-number": {
    title: "Works on any page",
    sub: "Phone links work right away. Turn on one setting to make numbers that are only text clickable too.",
    body: `<img src="${img("page-number")}" style="max-width:1000px">`,
  },
  "3-blueprint": {
    title: "Set up with a Home Assistant blueprint",
    sub: "Select your phone, paste the webhook ID from the extension, and save.",
    body: `<img src="${img("settings-step2")}" style="max-width:1100px">`,
  },
  "4-connect": {
    title: "No passwords or tokens",
    sub: "The extension only knows your webhook address. It works at home and away with Nabu Casa.",
    body: `<img src="${img("settings-step3")}" style="max-width:900px">`,
  },
  "5-phone": {
    title: "Set up your phone once",
    sub: "Allow the Home Assistant app to display over other apps, so it can open the dialer for you.",
    body: `<img src="${img("phone-overlay-setting")}" style="max-width:900px;box-shadow:none;background:none">`,
  },
};

const browser = await puppeteer.launch({ executablePath: CHROME });
const page = await browser.newPage();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

await page.setViewport({ width: 1280, height: 800 });
for (const [name, s] of Object.entries(screens)) {
  await page.setContent(`<style>${css}</style>
    <div class="head"><h1>${s.title}</h1><p class="sub">${s.sub}</p></div>
    <div class="stage">${s.body}</div>`, { waitUntil: "load" });
  await page.screenshot({ path: join(OUT, `screenshot-${name}.png`) });
}

// Chrome Web Store small promo tile: the store asks for little text, so just the icon and name.
await page.setViewport({ width: 440, height: 280 });
await page.setContent(`<style>
    * { margin: 0; } body { width: 440px; height: 280px; display: flex; align-items: center; justify-content: center; gap: 20px; white-space: nowrap;
      background: linear-gradient(135deg, #185fa5, #0f3f70); color: #fff; font: 650 28px system-ui, sans-serif; }
    h1 { font: inherit; }
    img { width: 88px; height: 88px; flex: none; filter: drop-shadow(0 4px 10px rgba(0, 0, 0, .35)); }
  </style><img src="${icon}"><h1>HA Click-to-Call</h1>`,
  { waitUntil: "load" });
await page.screenshot({ path: join(OUT, "promo-small-440x280.png") });

// The 128px icon is also the store icon, which wants 96px artwork with 16px of transparent padding.
await page.setViewport({ width: 128, height: 128 });
await page.setContent(`<style>* { margin: 0; } body { background: transparent; }</style>
  <img src="${icon}" style="display:block;width:96px;height:96px;margin:16px">`, { waitUntil: "load" });
await page.screenshot({ path: join(ROOT, "extension", "icons", "icon-128.png"), omitBackground: true });
await browser.close();

// The zip to upload to the Chrome Web Store.
rmSync(DIST, { recursive: true, force: true });
execFileSync("npx", ["--yes", "web-ext", "build", "--source-dir", join(ROOT, "extension"), "--artifacts-dir", DIST, "--overwrite-dest"],
  { stdio: "inherit" });
console.log(`Images in ${OUT}, zip in ${DIST}`);
