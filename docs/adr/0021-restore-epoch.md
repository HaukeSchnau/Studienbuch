# Restore epoch

Status: accepted 2026-10-29

The server's database has a restore epoch, `syncEpoch`: a random id written when the database is created and rewritten by every restore, combined with PostgreSQL's system identifier and timeline, so a restore that skips the rewrite still changes it. Every push and pull carries the device's epoch. On a mismatch the server answers `Sync.EpochChanged` with the client's last mutation id as the restored database knows it. The device drops its base rows and cursors, moves its settled commands above that id from a 7-day history back into the outbox, takes a new client id if the history doesn't reach that far, and pulls every space again. It also re-sends the key operations of those 7 days through `Keys`.

A restore rewinds space versions and last mutation ids. Without the epoch, devices would skip rows that reuse version numbers they think they hold, and drop commands the server forgot as confirmed. What the epoch can't bring back: a command older than 7 days, and one from a device that never comes online again.

Reasoning: [sync.md, backup restores and the epoch](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/sync.md#backup-restores-and-the-epoch).
