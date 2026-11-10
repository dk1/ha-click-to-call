// Number clean-up in the background script, without a browser.
//   cd dev && node --test test/unit.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

// Run background.js with a stand-in `chrome` that accepts any call, and take its exports.
function loadBackground() {
  const anything = new Proxy(function () {}, { get: () => anything, apply: () => anything });
  const module = { exports: {} };
  vm.runInNewContext(readFileSync(new URL("../../extension/background.js", import.meta.url), "utf8"), {
    chrome: anything, module, URLSearchParams, AbortSignal, setTimeout, fetch: () => Promise.resolve(),
  });
  return module.exports;
}
const { normalize, cleanLabel } = loadBackground();

test("normalize keeps digits and a leading +", () => {
  for (const [raw, want] of [
    ["(905) 987-4466", "9059874466"],
    ["+1 (416) 555-0199", "+14165550199"],
    ["%2B14165550199", "+14165550199"], // URL-encoded tel: href
    ["416.555.0199", "4165550199"],
    ["+44 20 7946 0958", "+442079460958"],
    ["9059874466;ext=12", "9059874466"], // tel: parameters dropped
    ["9059874466?call", "9059874466"],
    ["  416\n555-0199 ", "4165550199"],
  ]) assert.equal(normalize(raw), want, raw);
});

test("normalize refuses short codes and non-numbers", () => {
  for (const raw of ["911", "112", "611", "555-12", "restaurants", "", null, undefined, "1234567890123456"]) {
    assert.equal(normalize(raw), null, String(raw));
  }
});

test("normalize accepts 7 digits, the shortest local number", () => {
  assert.equal(normalize("555-1234"), "5551234");
});

test("cleanLabel passes only short number-like text", () => {
  assert.equal(cleanLabel("(905) 987-4466"), "(905) 987-4466");
  assert.equal(cleanLabel("  +1 416\n555‑0199 "), "+1 416 555‑0199"); // whitespace squeezed, Unicode hyphen kept
  for (const bad of ["Call reception", "<b>9059874466</b>", "905", "(905) 987-4466 ext. 12", "1".repeat(31), null]) {
    assert.equal(cleanLabel(bad), "", String(bad));
  }
});
