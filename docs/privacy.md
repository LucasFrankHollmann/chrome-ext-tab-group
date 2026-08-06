# Privacy Policy — Tytab

_Last updated: August 6, 2026_

**In short:** Tytab reads the titles and URLs of your open tabs to decide which tab group each one belongs to, and it saves the settings you choose. That is all it touches. There is no server, no account, no analytics, and no third party. Nothing is sold or shared, ever.

## What the extension handles

Tytab is a tab organizer. To do its job it works with two kinds of information, both described below. Google requires this disclosure even for data that never leaves your device, which is the case for almost everything here.

## 1. Tab titles and URLs (declared as "web history")

Every time a tab finishes loading, the extension reads that tab's URL and title. It uses the URL to work out the site (for example `docs.google.com` becomes the group "google"), to check whether the site belongs to one of your presets, to check whether the URL matches one of your tab naming rules, and to skip pages you asked it to ignore. It uses the title to show the tab in the popup list and to let you filter that list as you type.

This happens inside your browser, at the moment it is needed, and the result is discarded. Tytab does not build a browsing history, does not keep a log of the pages you visit, does not record how long you spend on them, and does not transmit any of it. There is no server for it to be sent to: the extension makes no network requests of any kind.

## 2. Your settings

The options you set are saved so they survive a browser restart: grouping mode, your presets (their names, colors, and site lists), the minimum tabs per group, the default color, the list of ignored sites, which groups should stay open when you switch tabs, and your tab naming rules (their patterns and names).

These are stored with Chrome's `storage.sync`, which means Chrome itself carries them to other computers where you are signed in to the same Chrome profile, the same way your bookmarks travel. That transfer is handled by Chrome and Google's sync service, under [Google's privacy policy](https://policies.google.com/privacy) — not by the developer of this extension, who has no access to it. If you do not want that, turn off extension syncing in Chrome's own sync settings.

Note that presets and naming rules contain text you typed, which may include site addresses. That is the only place where anything resembling a URL is stored, and you control it: edit or delete it in the extension's options, or use "Restore defaults" to clear everything.

## Website access, and what is done with it

The optional "Rename tabs" feature needs permission to run on websites, because a tab's title exists only inside the page itself. When you turn that feature on, Chrome asks you for that permission; if you refuse, the feature stays off and everything else keeps working. Turning the feature off gives the permission back.

With that permission, and only on pages whose URL matches a rule you wrote, the extension runs a short function that sets the page's title to your chosen name and puts it back if the site overwrites it. It does not read the page's text, images, forms, passwords, or any other content, and it injects nothing into pages that do not match one of your rules.

## What is never collected

- No personally identifiable information: no name, email, address, age, or identifiers.
- No authentication data: no passwords, credentials, cookies, or session tokens.
- No financial, payment, or health information.
- No personal communications: no email, chat, or message content.
- No location: no GPS, no IP-based location, no nearby-device information.
- No user activity tracking: no keystrokes, clicks, mouse position, or scrolling.
- No page content: no text, images, audio, video, or links from the pages you visit.

## Sharing, selling, and other uses

Nothing is transferred to anyone. The data described above is used only to provide the features you see in the extension. It is not sold or transferred to third parties, is not used or transferred for any purpose unrelated to the extension's single purpose, and is not used to determine creditworthiness or for lending purposes.

## Retention and removal

Tab titles and URLs are not retained — they are read and used in the moment. Your settings stay in your browser profile until you change them, clear them with "Restore defaults", or uninstall the extension, which removes them along with it.

## Children

Tytab is a utility for organizing tabs. It is not directed at children and collects no information about anyone, of any age.

## Changes to this policy

If a future version handles data differently, this page is updated before that version is published, and the date at the top changes with it.

## Contact

Questions about this policy, or about the extension: <lucasfrank_@hotmail.com>

Source code: <https://github.com/LucasFrankHollmann/chrome-ext-tab-group>
