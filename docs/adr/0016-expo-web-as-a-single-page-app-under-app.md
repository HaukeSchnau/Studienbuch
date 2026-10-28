# Expo web as a single-page app under /app

Status: accepted 2026-10-28

The Expo app's web export uses `web.output: "single"` and `experiments.baseUrl: "/app"`. The server answers `/app/*` with the file if one exists and with `index.html` otherwise, and marks `/_expo/static/*` and `/assets/*` immutable. The landing page and the console keep `/` and `/console` on the same origin.

Nothing under `/app` is worth prerendering, because its content lives in the device's database. Static output hydrated with React error 418 on every page whose content depends on the URL or local data. Single output has no hydration step, and every deep link works through the fallback.

Reasoning: [client-platform.md, Expo Router on the web](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/client-platform.md#expo-router-on-the-web).
