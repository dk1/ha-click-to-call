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
    sub: "Phone links work right away. Numbers that are only text get a dotted underline you can click.",
    body: `<img src="${img("page-number")}" style="max-width:1000px">`,
  },
  "3-blueprint": {
    title: "Set up with a Home Assistant blueprint",
    sub: "Pick your phone, paste the webhook ID from the extension, and save.",
    body: `<img src="${img("settings-step2")}" style="max-width:1100px">`,
  },
  "4-connect": {
    title: "No passwords or tokens",
    sub: "The extension only knows your webhook address. It works at home and away with Nabu Casa.",
    body: `<img src="${img("settings-step3")}" style="max-width:900px">`,
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

// Chrome Web Store small promo tile.
await page.setViewport({ width: 440, height: 280 });
await page.setContent(`<style>
    * { margin: 0; } body { width: 440px; height: 280px; display: flex; align-items: center; gap: 22px; padding: 0 36px;
      box-sizing: border-box; background: linear-gradient(135deg, #185fa5, #0f3f70); color: #fff; font: 16px/1.35 system-ui, sans-serif; }
    img { width: 96px; height: 96px; flex: none; } h1 { font-size: 27px; font-weight: 650; } p { opacity: .85; margin-top: 6px; }
  </style><img src="${icon}"><div><h1>HA Click-to-Call</h1><p>Dial a number on your phone from your browser.</p></div>`,
  { waitUntil: "load" });
await page.screenshot({ path: join(OUT, "promo-small-440x280.png") });
await browser.close();

// Same zip for Chrome, Edge and Firefox.
rmSync(DIST, { recursive: true, force: true });
execFileSync("npx", ["--yes", "web-ext", "build", "--source-dir", join(ROOT, "extension"), "--artifacts-dir", DIST, "--overwrite-dest"],
  { stdio: "inherit" });
console.log(`Images in ${OUT}, zip in ${DIST}`);
