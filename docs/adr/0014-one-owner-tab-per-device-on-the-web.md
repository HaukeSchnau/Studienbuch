# One owner tab per device on the web, no COOP or COEP

Status: accepted 2026-10-28 ([D28](https://files.schnau.dev/html/studienbuch-roadmap/#D28))

On the web, one tab owns a device's database. It takes a Web Lock for that device before the SQLite worker starts and holds it for the document's lifetime. A second tab of the same device shows "Studienbuch ist in einem anderen Tab geöffnet" with "hier verwenden", which asks the owner over a `BroadcastChannel` to let go, then takes over. Virtual devices (`?device=a`, `?device=b`) have their own directories and locks, so they run side by side.

The lock is mandatory: when its worker can't open the database, Effect's wasm client never fails, so a second tab would wait forever. SQLite on the web is used only through its async API, which needs no `SharedArrayBuffer`, so the server sends no COOP or COEP headers. A SharedWorker leader was rejected because it can't hold OPFS access handles and Android Chrome has no SharedWorker.

Reasoning: [client-platform.md, tabs](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/client-platform.md#tabs-and-virtual-devices).
