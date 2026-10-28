# Three apps, one server process, one origin

Status: accepted 2026-10-28 ([D2](https://files.schnau.dev/html/studienbuch-roadmap/#D2))

`apps/app` is the Expo app for iOS, Android and the web. `apps/web` is TanStack Start built to static files: the landing page, legal pages and the operator console. `apps/server` is one Effect process that serves both web builds, Effect RPC, the sync WebSocket, Better Auth, blobs and the scheduled jobs, all from one origin.

One origin keeps cookies, passkeys and CORS simple. The server is a plain process instead of TanStack Start, as in the old repository, because sync needs long-lived WebSockets and hosting the Effect runtime inside Vite needed its own hot-reload state machine. Start uses no server functions or server routes at runtime.

Reasoning: [architecture.md](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/architecture.md#the-system-on-one-page), [hosting.md, HTTP surface](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/hosting.md#http-surface).
