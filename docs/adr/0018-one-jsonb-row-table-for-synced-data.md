# One JSONB row table for synced data

Status: accepted 2026-10-29 ([D25](https://files.schnau.dev/html/studienbuch-roadmap/#D25))

Everything a device downloads lives in one Postgres table, `sync_row`, keyed by space, table and id: readable rows as canonical JSON in `data`, encrypted rows as an envelope and a ciphertext. What the server reasons about stays relational: accounts and sessions, spaces and memberships, the command log, access codes and the import's source store.

The device stores the same shape, so one `Tx` runs a mutator against SQLite and against Postgres, and the server stores exactly what clients receive. Versions, tombstones, purging, export and deletion exist once, for one table. Domain tables would need their own version tracking and pull query each, and most notebook rows are ciphertext that no domain table could query (D24). A server feature that needs relational power gets a projection that the writing transaction maintains.

Reasoning: [sync.md, rows and identity](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/sync.md#rows-and-identity), [encryption.md, a generic rows table](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/encryption.md#a-generic-rows-table-becomes-more-compelling).
