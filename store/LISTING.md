# Store listing

Copy these into the store forms. `npm run store` in `dev/` makes the upload zip (`store/dist/`) and the images
(`store/images/`). Bump `version` in `extension/manifest.json` before uploading an update.

## All stores

**Name:** HA Click-to-Call

**Summary** (Chrome 132 / Firefox 250 characters max):
Dial phone numbers from your browser on your Android phone, through Home Assistant.

**Category:** Chrome: Productivity > Tools. Edge: Productivity. Firefox: Other (or Social & Communication).

**Homepage / support:** https://github.com/dk1/ha-click-to-call

**Privacy policy:** https://github.com/dk1/ha-click-to-call/blob/main/PRIVACY.md

**Images:** `screenshot-1` to `screenshot-4` (1280×800). Chrome also takes `promo-small-440x280.png`.
Icon: `extension/icons/icon-128.png`.

**Description:**

```
Dial a number on your phone from your browser.

Click a phone number on any web page and your Android phone opens the dialer with the number ready to call. The number goes through your own Home Assistant, using a blueprint and the Home Assistant Companion app on your phone.

• Works with phone number links, and with numbers that are only text (shown with a dotted underline)
• Select a number, right-click and choose "Call … on phone"
• Hold Alt (Option on a Mac) to use your computer's own phone app instead
• Works at home and away with Nabu Casa or any remote address

What you need:
• Home Assistant
• An Android phone with the Home Assistant Companion app
• The HA Click-to-Call blueprint (the settings page has a one-click import)

Private by design: the extension stores only your webhook address and sends only the number you click, to your Home Assistant and nowhere else. It never sees a Home Assistant password or token. No analytics or tracking.

Open source: https://github.com/dk1/ha-click-to-call

Not affiliated with Home Assistant or the Open Home Foundation.
```

## Chrome Web Store: Privacy practices tab

**Single purpose:**
Sends a phone number the user clicks on a web page to the user's own Home Assistant, which opens the dialer on
their Android phone.

**storage:**
Saves the user's Home Assistant address, webhook ID and the setting for underlining phone numbers.

**contextMenus:**
Adds a "Call … on phone" item when the user selects a phone number and right-clicks.

**Host permission** (optional `http://*/*`, `https://*/*`):
Every user has a different Home Assistant address (a Nabu Casa URL, a home IP address or their own domain), so it
can't be listed in advance. The extension asks for access to that one address when the user saves it, and only
sends the clicked phone number to it.

**Content script on all URLs:**
Phone numbers can be on any site. The content script handles clicks on `tel:` links and underlines numbers that
are only text, so the user can click them. It reads page text in the browser only and sends nothing unless the
user clicks a number.

**Remote code:** No, I am not using remote code.

**Data usage:** check nothing. The extension collects no user data: the clicked number goes only to the user's own
server. Tick all three certifications (not sold, not used for unrelated purposes, not used for credit).

**Notes for the reviewer** (optional field):
To try it without Home Assistant, open the settings page, enter any address such as https://example.com and
select Save, then click a phone number on any page. The request goes to
https://example.com/api/webhook/<id>, so the page shows "Home Assistant replied with an error (404)". That confirms the click was handled and sent.

## Edge Add-ons

Same zip, description, images and privacy policy. **Search terms:** home assistant, click to call, phone, dialer,
android. Edge uses the 1280×800 screenshots; the promo tile is optional.

## Firefox Add-ons

Upload the same zip as **On this site** (listed). Source code isn't needed: there's no build step. The manifest
already declares that no data is collected. **License:** MIT. **Tags:** productivity.
