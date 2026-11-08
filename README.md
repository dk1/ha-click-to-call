# HA Click-to-Call

Click to call phone numbers from your browser on your phone, using Home Assistant and the Home Assistant Companion
app.

<p>
  <img src="docs/screenshots/page-sent.png" width="480" alt="A web page with a phone number. After clicking it, a message says it was sent to your phone.">
  <img src="docs/screenshots/phone-dialer.png" width="160" alt="The phone shows a 'Number from browser' notification and the dialer with the number filled in.">
</p>

## What you need
- [Home Assistant](https://www.home-assistant.io/).
- An Android phone with the [Home Assistant Companion app](https://companion.home-assistant.io/) installed.
- Chrome, Edge or Firefox.

## Set up
[Install the extension](#install), then click its icon in the toolbar to open the settings.

It will walk you through four steps.

**1. Add the blueprint to Home Assistant.**
[![Open your Home Assistant instance and show the blueprint import dialog with this blueprint pre-filled.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Fdk1%2Fha-click-to-call%2Fblob%2Fmain%2Fblueprints%2Fha_click_to_call.yaml)

**2. Create the automation.** Open the blueprint, select **Create automation**, select your phone and paste the
webhook ID from the extension's settings.

<img src="docs/screenshots/settings-step2.png" width="640" alt="Step 2 in the extension's settings, with the webhook ID and a Copy button.">

**3. Set up your phone.** Allow the Home Assistant app to **Display over other apps**: on your phone, go to
**Settings** > **Apps** > **Home Assistant** (called **Appear on top** on some phones). Android needs this
before an app can open the dialer for you. Without it, you can tap the notification to open the dialer.

<img src="docs/screenshots/phone-overlay-setting.png" width="520" alt="App info for Home Assistant with Display over other apps outlined, then the Allow display over other apps switch turned on.">

**4. Connect the extension.** Enter your Home Assistant address, such as your Nabu Casa URL, and click
**Save**, then **Send to phone** to try it.

<img src="docs/screenshots/settings-step4.png" width="440" alt="Step 4 in the extension's settings, with a Nabu Casa address and the Save button.">

## Install
Store listings for Chrome, Edge and Firefox are on the way. Until then, or if you'd rather not install from a
store, run it straight from this repository.

### Run it from the source (no store)
The extension is a few hundred lines of plain JavaScript in the [`extension`](extension) folder, with no build
step and nothing downloaded at runtime, so you can read all of it before you load it.

1. Get the code: `git clone https://github.com/dk1/ha-click-to-call`, or **Code** > **Download ZIP** on this
   page and unzip it. Keep the folder: the browser loads the extension from it.
2. Load it in your browser:
   - **Chrome, Edge, Brave, Arc:** go to `chrome://extensions` (`edge://extensions` in Edge), turn on
     **Developer mode**, click **Load unpacked** and choose the `extension` folder.
   - **Firefox:** go to `about:debugging` > **This Firefox** > **Load Temporary Add-on** and choose
     `extension/manifest.json`. Firefox removes it when it restarts. To keep it, sign your own copy: create a free
     [add-ons account](https://addons.mozilla.org/developers/), get API keys, run
     `npx web-ext sign --source-dir extension --channel=unlisted --api-key=… --api-secret=…`, then open the
     `.xpi` file it makes in Firefox. Unlisted copies aren't published anywhere.
   - **Safari:** run `xcrun safari-web-extension-converter extension`, build the Xcode project it makes, then turn
     the extension on in **Safari** > **Settings** > **Extensions**.
3. To update, run `git pull` (or download the ZIP again into the same folder), then click the reload button on the
   extension in `chrome://extensions`. Your settings are kept.

## Use it
<img src="docs/screenshots/page-number.png" width="480" alt="Phone numbers on a web page with a dotted underline.">

- Click any phone number link, or any number the extension has underlined.
- Or select a number, right-click and choose **Call … on phone**.
- A message at the bottom of the page confirms it was sent. Your phone buzzes and opens the dialer. If the
  dialer doesn't open, tap the notification.
- Hold Alt (Option on a Mac) when you click to use your desktop's own phone app instead.

## Troubleshooting
- **The phone shows a permission prompt instead of the dialer:** allow the Home Assistant app to Display over
  other apps.
- **"Sent", but nothing happens on the phone:** open the automation in Home Assistant and check its traces.
  Home Assistant accepts any webhook ID, so a mistyped ID still shows as "Sent".
- **Works at home but not away:** a home address like `http://homeassistant.local:8123` only works on your
  home network. Use your Nabu Casa URL instead, and turn off **Only accept calls from the local network** in the
  automation.
- **No vibration:** Android lets you change it under **Settings** > **Apps** > **Home Assistant** >
  **Notifications** > **Click-to-Call**.

## Options
The automation's **Behavior** section lets you place the call straight away instead of opening the dialer
(the Home Assistant app then needs the Phone permission), and change how long the notification stays.

## Privacy
The extension stores only your Home Assistant address and webhook ID, and sends only the number you click, to
your Home Assistant. It never sees a Home Assistant password or token. Anyone who knows
the webhook ID can open your phone's dialer, so treat it like a password. The automation accepts digits only,
so nothing else can be sent to your phone. See the [privacy policy](PRIVACY.md).

## Development
Screenshots in `docs/screenshots` are made by `dev/screenshots.mjs` against a throwaway Home Assistant in Docker
and the Android emulator, so no real data ends up in them. See the comments at the top of `dev/screenshots.mjs`
and `dev/docker-compose.yml`. `npm run store` in `dev` makes the store zip and listing
images; see [`store/LISTING.md`](store/LISTING.md).

`npx web-ext lint --source-dir extension` reports one expected warning about `background.service_worker`: Chrome uses it, Firefox
uses `background.scripts`.
