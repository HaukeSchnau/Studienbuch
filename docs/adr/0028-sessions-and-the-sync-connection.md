# Sessions and the sync connection

Status: accepted 2026-10-29

Better Auth signs accounts in at `/api/auth`, and every platform holds its session as a bearer token in the device's secrets. Devices keep no cookies: the server drops every cookie Better Auth sets and every cookie a request carries. The one cookie Better Auth needs, its signed passkey challenge, crosses as the `passkey-challenge` header and turns back into a cookie inside the server. A session lasts 90 days and renews with use, at most once a day (D27), so a device that stays offline longer signs in again before it syncs and keeps its local data meanwhile. The sync WebSocket authenticates once per connection with a single-use ticket that the device fetches over HTTP with its bearer token. The server ends a connection when Better Auth deletes the session's row, at sign-out or a revocation from another device, which the `session.delete` hook reports to the `SessionResolver`.

A cookie holds one session per browser, but the virtual devices of one browser (`?device=a`, `?device=b`) must be able to sign in as different accounts, and browsers can't set headers on a WebSocket upgrade. Native apps would need a cookie jar and an Origin header they don't send. One bearer path covers all three platforms. The challenge header keeps passkey ceremonies off the cookie jar too, and it can't be sent across sites without a CORS grant, so the server may fill in the Origin that native requests lack.

What this leaves out: the revocation signal lives in the server's memory, so a second server process would need it through Postgres. The operator console, once it signs in, needs cookies of its own on its own path.

Reasoning: [sync.md, auth, devices, logout](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/sync.md#7-auth-devices-logout), [stack.md, Better Auth](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/stack.md#better-auth).
