# Store listing

Copy these into the store forms. `npm run store` in `dev/` makes the upload zip (`store/dist/`) and the images
(`store/images/`). Bump `version` in `extension/manifest.json` before uploading an update.

## Chrome Web Store: Store listing tab

**Name:** HA Click-to-Call

**Summary** (132 characters max):
Dial phone numbers from your browser on your Android phone, through Home Assistant.

**Category:** Productivity > Tools.

**Homepage / support:** https://github.com/dk1/ha-click-to-call

**Privacy policy:** https://github.com/dk1/ha-click-to-call/blob/main/PRIVACY.md

**Images:** `screenshot-1` to `screenshot-5` (1280×800) and the small promo tile `promo-small-440x280.png`.
Icon: `extension/icons/icon-128.png`.

**Description:**

```
Dial a number on your phone from your browser.

Click a phone number on any web page and your Android phone opens the dialer with the number ready to call. The number goes through your own Home Assistant, using a blueprint and the Home Assistant Companion app on your phone.

• Works with phone number links, and optionally with numbers that are only text (shown with a dotted underline)
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

**Sending to Home Assistant:**
The number goes to the user's own Home Assistant webhook as a plain form POST, which needs no host permission.
Apart from the content script below, the extension declares no host permissions.

**Content script on all URLs:**
Phone numbers can be on any site, so the content script has to run on all of them. That's why Chrome shows "Read
and change all your data on all websites" at install. The script only handles real user clicks on `tel:` links.
If the user turns on the optional setting (off by default), it also underlines numbers that are only text so
they can be clicked. Page content is never stored or sent; nothing is sent until the user clicks a number.

**Remote code:** No, I am not using remote code.

**Data usage:** check nothing. The extension collects no user data: the clicked number goes only to the user's own
server. Tick all three certifications (not sold, not used for unrelated purposes, not used for credit).

**Notes for the reviewer** (optional field):
To try it without Home Assistant, open the settings page, enter any address such as https://example.com and
select Save, then click a phone number on any page. The request goes to
https://example.com/api/webhook/<id>, and the page shows "Sent … to your phone". That confirms the click was handled and sent.

