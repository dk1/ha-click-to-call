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

• Right-click a phone number link, or a number you've selected, and choose "Call on phone"
• Optionally, send phone links with a plain click, and make numbers that are only text clickable too
• Needs no access to the sites you visit unless you turn on clicking
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
Sends a phone number the user chooses on a web page to the user's own Home Assistant, which opens the dialer on
their Android phone.

**storage:**
Saves the user's Home Assistant address, webhook ID and the setting for underlining phone numbers.

**contextMenus:**
Adds a "Call on phone" item when the user right-clicks a phone number link or selected text. This is the main way
to use the extension.

**activeTab:**
After the user chooses "Call on phone", shows a short "Sent to your phone" message on that page.

**scripting:**
Injects that message after a right-click call (with activeTab). If the user turns on the optional click setting,
registers the click handler with registerContentScripts.

**Optional host permission `<all_urls>`:**
Not requested at install. Only if the user turns on "Send phone number links to your phone when you click them":
the click handler has to be on a page before the user clicks a link, and phone numbers can be on any site. It only
acts on real clicks on `tel:` links (and, with a second optional setting, underlines numbers that are only text).
Turning the setting off removes the permission. The number is sent to the user's own Home Assistant with a plain
form POST, which needs no host permission.

**Remote code:** No, I am not using remote code.

**Data usage:** check nothing. The extension collects no user data: the clicked number goes only to the user's own
server. Tick all three certifications (not sold, not used for unrelated purposes, not used for credit).

**Notes for the reviewer** (optional field):
To try it without Home Assistant, open the settings page, enter any address such as https://example.com and
select Save. Then right-click a phone number link on any page (or select a number and right-click) and choose
"Call on phone". The number is posted to https://example.com/api/webhook/<id> and the page shows "Sent … to your
phone". To try clicking, turn on the first setting under Settings and allow the prompt.

