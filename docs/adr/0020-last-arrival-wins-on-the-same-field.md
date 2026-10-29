# Last arrival wins on the same field

Status: accepted 2026-10-29 ([D26](https://files.schnau.dev/html/studienbuch-roadmap/#D26), [D54](https://files.schnau.dev/html/studienbuch-roadmap/#D54))

Updates patch the fields they change and never replace a row, so two devices that edit different fields of one homework both keep their edit, and an old app can't drop a field a newer one added. When both edit the same field, the edit that reaches the server last wins, even when it was made earlier while offline. Encrypted rows behave the same, because a stale sealed write is replayed on the newer row and patches it again (ADR 0023).

One student rarely edits the same field on two devices while one of them is offline. Edit times per field would cost about 60 lines and a timestamp per field, and a device with a wrong clock would win. The Sync Lab shows the case, and a table can switch to edit times later if it feels wrong.

Reasoning: [sync.md, ordering and conflicts](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/sync.md#ordering-idempotency-conflicts), [sync.md, decision 3](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/sync.md#decisions-for-hauke).
