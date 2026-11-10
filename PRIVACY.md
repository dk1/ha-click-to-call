# Privacy policy

HA Click-to-Call is a browser extension that sends phone numbers you click to your own Home Assistant.

**What it stores.** Your Home Assistant address, the webhook ID, and whether to underline numbers that are only
text. They're kept in your browser's extension storage on your computer.

**What it sends, and where.** When you choose **Call on phone**, or click a phone number with clicking turned on,
the extension sends only that number to the webhook address you entered. Nothing is sent anywhere else, and nothing is sent until you
click.

**What it reads.** By default, only the phone link or text you right-click and choose **Call on phone** for.
If you turn on clicking, it also watches for clicks on phone number links on the pages you visit, and if you
turn on making numbers that are only text clickable, it looks at page text to find them. This happens in your
browser. Page content, addresses and browsing history are never stored or sent.

**What it doesn't do.** No analytics, no tracking, no ads, no accounts, and no data sold or shared. The developer
receives no data from the extension. It never sees a Home Assistant password or token.

**Permissions.** The extension needs no access to your Home Assistant address or to the sites you visit. Access
to all sites is asked for only when you turn on clicking, and given back when you turn it off.

**Questions.** Open an issue at https://github.com/dk1/ha-click-to-call/issues.

Last updated: November 2, 2026.
