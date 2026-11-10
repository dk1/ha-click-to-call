# Privacy policy

HA Click-to-Call is a browser extension that sends phone numbers you click to your own Home Assistant.

**What it stores.** Your Home Assistant address, the webhook ID, and whether to underline numbers that are only
text. They're kept in your browser's extension storage on your computer.

**What it sends, and where.** When you click a phone number or choose **Call … on phone**, the extension sends
only that number to the webhook address you entered. Nothing is sent anywhere else, and nothing is sent until you
click.

**What it reads.** The extension watches for clicks on phone number links on the pages you visit. If you turn on
making numbers that are only text clickable, it also looks at page text to find them. This happens in your
browser. Page content, addresses and browsing history are never stored or sent.

**What it doesn't do.** No analytics, no tracking, no ads, no accounts, and no data sold or shared. The developer
receives no data from the extension. It never sees a Home Assistant password or token.

**Permissions.** The number is sent to your Home Assistant as a plain form, which needs no access to that
address. The extension runs on all sites only to handle clicks on phone number links.

**Questions.** Open an issue at https://github.com/dk1/ha-click-to-call/issues.

Last updated: November 2, 2026.
