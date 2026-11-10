// Helpers for the browser tests: Chrome for Testing with the extension loaded, a local
// server for test pages, and a fake Home Assistant webhook that records what it's sent.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const DEV = fileURLToPath(new URL("..", import.meta.url));
export const EXTENSION = join(DEV, "..", "extension");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// CHROME_PATH, or the Chrome for Testing that `npx @puppeteer/browsers install chrome@stable
// --path .chrome` put in dev/.chrome (macOS or Linux).
function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const found = execFileSync("find", [join(DEV, ".chrome"), "-type", "f", "(",
    "-path", "*MacOS/Google Chrome for Testing", "-o", "-path", "*chrome-linux64/chrome", ")"]).toString().trim().split("\n")[0];
  if (!found) throw new Error("No Chrome for Testing: run `npx @puppeteer/browsers install chrome@stable --path .chrome` in dev/");
  return found;
}

// Serves test pages by path (pages["/x"] = html) and records POSTs to /api/webhook/*.
export async function startServer(pages = {}) {
  const posts = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.method === "POST") {
        posts.push({ type: (req.headers["content-type"] ?? "").split(";")[0], ...Object.fromEntries(new URLSearchParams(body)) });
        return res.end("ok");
      }
      res.setHeader("content-type", "text/html");
      res.end(`<!doctype html><meta charset="utf-8"><body>${pages[decodeURIComponent(req.url)] ?? ""}</body>`);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, posts, pages, hook: `${origin}/api/webhook/test-id-123456`, close: () => server.close() };
}

// A copy of the extension, optionally with manifest changes (e.g. extra permissions a test
// can't get from Chrome's prompt). Copies keep the original untouched while tests run.
export function extensionCopy(manifestChanges = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ha-c2c-ext-"));
  cpSync(EXTENSION, dir, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ ...manifest, ...manifestChanges }));
  return dir;
}

// Chrome with the extension, its settings set, and every page error collected.
export async function launch({ extension = extensionCopy(), settings = {} } = {}) {
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    pipe: true,
    enableExtensions: [extension],
    // GitHub's Ubuntu runners don't allow Chrome's sandbox.
    args: process.env.CI ? ["--no-sandbox"] : [],
  });
  const worker = await (await browser.waitForTarget((t) => t.type() === "service_worker")).worker();
  await worker.evaluate((s) => chrome.storage.local.set(s), settings);
  const errors = [];
  return {
    browser,
    worker,
    errors,
    extId: new URL(worker.url()).host,
    async open(url) {
      const page = await browser.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url);
      await page.bringToFront();
      await sleep(300);
      return page;
    },
    close: () => browser.close(),
  };
}

// A real mouse click in the middle of an element, which pages see as isTrusted.
export async function realClick(page, selector, { alt = false } = {}) {
  const box = await (await page.$(selector)).boundingBox();
  if (alt) await page.keyboard.down("Alt");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  if (alt) await page.keyboard.up("Alt");
}

// The text of the extension's "Sent to your phone" message, if one is showing.
export const toastText = (page) => page.evaluate(() => {
  const host = [...document.documentElement.children].find((el) => el.shadowRoot);
  return host?.shadowRoot.querySelector("div")?.textContent ?? null;
});
