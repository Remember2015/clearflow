# Security

## Reporting a vulnerability

Please email **developer@ohmyai.app** instead of opening a public issue. Include what you found, how to reproduce it and what an attacker could do with it. We'll reply within a week and credit you in the changelog if you like.

## Things to know about the design

- **API keys are stored in plain text** in `chrome.storage.local`, like any other extension setting. Anyone with access to your browser profile can read them. Use keys you can rotate, and set spending limits with TypeSafe and OpenRouter.
- **Page content is sent to third parties.** Comments, posts and author names on the supported sites are sent to TypeSafe and OpenRouter with your keys (see [PRIVACY.md](PRIVACY.md)). Nothing is sent to the developers.
- **Page-world helpers can be spoofed by the page itself.** On X and YouTube, `pagedata.js` and `ytdata.js` run in the page's own context to read the site's API responses and pass them to the extension via DOM events / `postMessage`. A page can forge these messages, but that only affects how that page's own content is judged or translated; they never carry keys or reach the background with privileges.
- **No remote code.** Everything that runs is in the extension package. The background worker only talks to `api.typesafe.ai` and `openrouter.ai` (and, if you enable "look at images", reads images from the listed image hosts).
- **Supported versions:** only the latest release.
