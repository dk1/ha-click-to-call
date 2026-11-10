// The extension in Chrome for Testing, against local test pages and a fake webhook.
//   cd dev && npm test
// Each test starts its own Chrome, so the 3-second send limit and settings don't leak between tests.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { launch, realClick, sleep, startServer, toastText } from "./browser.mjs";

let server;
before(async () => (server = await startServer()));
after(() => server.close());

// Adds a test page and returns its URL.
let pageCount = 0;
const testPage = (html) => {
  const path = `/page-${++pageCount}`;
  server.pages[path] = html;
  return server.origin + path;
};
// Webhook posts made after this call.
const postsFrom = () => {
  const start = server.posts.length;
  return () => server.posts.slice(start);
};
const withChrome = async (settings, fn) => {
  const chrome = await launch({ settings: { webhookUrl: server.hook, ...settings } });
  try {
    await fn(chrome);
  } finally {
    await chrome.close();
  }
};

test("clicking a tel: link sends the number as a form, with the number as written", () =>
  withChrome({}, async ({ open }) => {
    const sent = postsFrom();
    const page = await open(testPage(`<a id="t" href="tel:+14165550199">(416) 555-0199</a>`));
    await realClick(page, "#t");
    await sleep(800);
    assert.deepEqual(sent(), [{ type: "application/x-www-form-urlencoded", number: "+14165550199", label: "(416) 555-0199" }]);
    assert.equal(await toastText(page), "📱 Sent (416) 555-0199 to your phone");
  }));

test("a click faked by the page's own script sends nothing", () =>
  withChrome({}, async ({ open }) => {
    const sent = postsFrom();
    // The page cancels its own fake click afterwards, so Chrome doesn't try to open tel: itself.
    const page = await open(testPage(`<a id="t" href="tel:4165550199">(416) 555-0199</a>
      <script>t.addEventListener("click", (e) => e.preventDefault());</script>`));
    await page.evaluate(() => document.getElementById("t").click());
    await sleep(800);
    assert.deepEqual(sent(), []);
  }));

test("a second number within 3 seconds is refused", () =>
  withChrome({}, async ({ open }) => {
    const sent = postsFrom();
    const page = await open(testPage(`<a id="t" href="tel:4165550199">(416) 555-0199</a>`));
    await realClick(page, "#t");
    await sleep(500);
    await realClick(page, "#t");
    await sleep(800);
    assert.equal(sent().length, 1);
    assert.match(await toastText(page), /Wait a few seconds/);
  }));

test("short codes like 911 are refused", () =>
  withChrome({}, async ({ open }) => {
    const sent = postsFrom();
    const page = await open(testPage(`<a id="t" href="tel:911">911</a>`));
    await realClick(page, "#t");
    await sleep(800);
    assert.deepEqual(sent(), []);
    assert.match(await toastText(page), /doesn't look like a phone number/);
  }));

test("Alt-click leaves a tel: link to the browser", () =>
  withChrome({}, async ({ open }) => {
    const sent = postsFrom();
    // The page stops the browser from opening tel: so the test doesn't hang on Chrome's prompt.
    const page = await open(testPage(`<a id="t" href="tel:4165550199">(416) 555-0199</a>
      <script>addEventListener("click", (e) => e.preventDefault());</script>`));
    await realClick(page, "#t", { alt: true });
    await sleep(800);
    assert.deepEqual(sent(), []);
  }));

test("a page that handles clicks first can't take a tel: link click", () =>
  withChrome({}, async ({ open }) => {
    const sent = postsFrom();
    const page = await open(testPage(`<a id="t" href="tel:9059874466">(905) 987-4466</a>
      <script>window.pageGotIt = false;
        addEventListener("click", (e) => { e.preventDefault(); window.pageGotIt = true; }, true);</script>`));
    await realClick(page, "#t");
    await sleep(800);
    assert.equal(sent().length, 1);
    assert.equal(await page.evaluate(() => window.pageGotIt), false);
  }));

test("underlining text-only numbers is on by default, and can be turned off", async () => {
  const html = testPage(`<p id="t">Front desk (905) 555 0142, fax 905-555-0143, order 12345678</p>`);
  await withChrome({ linkify: false }, async ({ open }) => {
    const page = await open(html);
    assert.equal(await page.$$eval("#t a", (a) => a.length), 0);
  });
  await withChrome({}, async ({ open }) => {
    const sent = postsFrom();
    const page = await open(html);
    assert.deepEqual(await page.$$eval("#t a", (a) => a.map((x) => x.getAttribute("href"))), ["tel:9055550142", "tel:9055550143"]);
    await realClick(page, "#t a");
    await sleep(800);
    assert.equal(sent()[0]?.number, "9055550142");
  });
});

test("Google Maps' phone button sends; Alt-click leaves it to Maps", () =>
  withChrome({}, async ({ open }) => {
    const sent = postsFrom();
    const page = await open(testPage(`<button id="t" aria-label="Phone: (416) 868-6937 " data-item-id="phone:tel:+14168686937">
      <span>icon</span><div>(416) 868-6937</div></button>
      <script>window.copied = 0; t.addEventListener("click", () => window.copied++);</script>`));
    await realClick(page, "#t");
    await sleep(800);
    assert.deepEqual(sent().map((p) => [p.number, p.label]), [["+14168686937", "(416) 868-6937"]]);
    assert.equal(await page.evaluate(() => window.copied), 0);
    await realClick(page, "#t", { alt: true });
    await sleep(500);
    assert.equal(await page.evaluate(() => window.copied), 1);
  }));

// Pages that open the dialer from their own code, like Google Search's business panel.
const opens = (url, extra = "") =>
  `<script>t.addEventListener("click", (e) => { e.preventDefault(); ${extra || `location.href = "${url}";`} });</script>`;
for (const [name, html, want] of [
  ["Google-style link opening the shown number",
    `<a id="t" href="#"><span aria-label="Call Phone Number (905) 987-4466">(905) 987-4466</span></a>${opens("tel:9059874466")}`,
    ["9059874466", "(905) 987-4466"]],
  ["the same with +1 in front", `<a id="t" href="#">(905) 987-4466</a>${opens("tel:+19059874466")}`, ["+19059874466", "(905) 987-4466"]],
  ["a hidden tel: link clicked from code", `<button id="t">Call (905) 987-4466</button>
    ${opens("", `const a = document.createElement("a"); a.href = "tel:9059874466"; a.click();`)}`, ["9059874466", "(905) 987-4466"]],
  ["a button that shows no number", `<button id="t">Subscribe</button>${opens("tel:+19005550000")}`, null],
  ["a link showing one number and opening another", `<a id="t" href="#">(905) 987-4466</a>${opens("tel:4165550199")}`, null],
  ["a number opened 2 seconds after the click", `<a id="t" href="#">(905) 987-4466</a>
    ${opens("", `setTimeout(() => (location.href = "tel:9059874466"), 2000);`)}`, null],
]) {
  test(`page opens tel: from its own code: ${name} → ${want ? "sent" : "ignored"}`, () =>
    withChrome({}, async ({ open }) => {
      const sent = postsFrom();
      const page = await open(testPage(html));
      await realClick(page, "#t");
      await sleep(name.includes("2 seconds") ? 2600 : 800);
      assert.deepEqual(sent().map((p) => [p.number, p.label]), want ? [want] : []);
    }));
}

test("a page opening tel: with no click is ignored", () =>
  withChrome({}, async ({ open }) => {
    const sent = postsFrom();
    await open(testPage(`<p>(905) 987-4466</p><script>setTimeout(() => (location.href = "tel:9059874466"), 200);</script>`));
    await sleep(800);
    assert.deepEqual(sent(), []);
  }));

test("the right-click item shows the number as written, and hides for other text", () =>
  withChrome({}, async ({ worker, open, extId }) => {
    // Record what the background script asks the menu to show.
    await worker.evaluate(() => {
      const update = chrome.contextMenus.update.bind(chrome.contextMenus);
      globalThis.menuUpdates = [];
      chrome.contextMenus.update = (id, props, ...rest) => (globalThis.menuUpdates.push(props), update(id, props, ...rest));
    });
    const page = await open(`chrome-extension://${extId}/options.html`);
    const titles = [];
    for (const text of ["(905) 987-4466", "  416\n555-0199 ", "restaurants", "Call our front desk any time at (905) 987-4466 please"]) {
      await page.evaluate((text) => chrome.runtime.sendMessage({ type: "selection", text }), text);
      await sleep(150);
      const last = (await worker.evaluate(() => globalThis.menuUpdates)).at(-1);
      titles.push(last.visible ? last.title : null);
    }
    assert.deepEqual(titles, ["Call (905) 987-4466 on phone", "Call 416 555-0199 on phone", null, "Call 9059874466 on phone"]);
  }));

test("a right-click call sends the selection as written, and shows the message on the page", () =>
  withChrome({}, async ({ worker, open }) => {
    const sent = postsFrom();
    const page = await open(testPage(`<p>Call (905) 987-4466</p>`));
    // The extension can't read tab addresses, so take the tab in front, which open() just made.
    const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].id);
    await worker.evaluate((tabId) => onMenuClick({ menuItemId: MENU_ID, selectionText: "(905) 987-4466", frameId: 0 }, { id: tabId }), tabId);
    await sleep(800);
    assert.deepEqual(sent().map((p) => [p.number, p.label]), [["9059874466", "(905) 987-4466"]]);
    assert.equal(await toastText(page), "📱 Sent (905) 987-4466 to your phone");
  }));

test("reloading the extension leaves no errors on open pages, and a click there says to reload", async () => {
  const chrome = await launch({ settings: { webhookUrl: server.hook } });
  try {
    const page = await chrome.open(testPage(`<p id="p">Call (416) 555-0199 today</p><a id="t" href="tel:4165550199">(416) 555-0199</a>`));
    await chrome.worker.evaluate(() => chrome.runtime.reload()).catch(() => {});
    await sleep(1500);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const r = document.createRange();
        r.selectNodeContents(document.getElementById("p"));
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      });
      await sleep(250);
    }
    await realClick(page, "#t");
    await sleep(800);
    assert.deepEqual(chrome.errors, []);
    assert.match(await toastText(page), /extension was updated. Reload this page/);
  } finally {
    await chrome.close();
  }
});

test("settings page: no permission prompt, Save checks the address, Try it is prefilled", () =>
  withChrome({ webhookUrl: undefined }, async ({ open, extId }) => {
    const page = await open(`chrome-extension://${extId}/options.html`);
    const type = (value) => page.$eval("#haAddress", (el, v) => { el.value = v; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); }, value);
    const preview = () => page.$eval("#urlPreview", (el) => el.textContent);

    assert.equal(await page.$eval("#testNumber", (el) => el.value), "(555) 555-1234");
    assert.equal(await page.$eval("#linkify", (el) => el.checked), true, "underlining is on by default");
    assert.equal(await page.$eval("#test", (el) => el.disabled), true, "Try it waits for a saved address");

    await type("https:// not an address");
    assert.match(await preview(), /doesn't look like an address/);
    await type("homeassistant.local:8123");
    assert.match(await preview(), /Start the address with http/);
    await type("https://abcd1234.ui.nabu.casa/lovelace/0");
    assert.equal(await page.$eval("#haAddress", (el) => el.value), "https://abcd1234.ui.nabu.casa", "a dashboard address keeps only the server");

    await type(server.origin);
    assert.equal(await page.$eval("#save", (el) => el.textContent), "Save");
    await page.click("#save");
    await page.waitForFunction(() => !/Checking/.test(document.getElementById("saveStatus").textContent), { timeout: 10000 });
    assert.equal(await page.$eval("#saveStatus", (el) => el.textContent), `Saved. ${server.origin} is reachable.`);
    assert.equal(await page.$eval("#test", (el) => el.disabled), false);
  }));

test("the extension asks for no host permissions beyond its content script", () =>
  withChrome({}, async ({ worker }) => {
    const { origins, permissions } = await worker.evaluate(() => chrome.permissions.getAll());
    assert.deepEqual(origins, ["<all_urls>"]);
    assert.deepEqual(permissions.sort(), ["contextMenus", "storage"]);
  }));
