# Seal and compare-and-swap for encrypted writes

Status: accepted 2026-10-29 ([D24](https://files.schnau.dev/html/studienbuch-roadmap/#D24), [D54](https://files.schnau.dev/html/studienbuch-roadmap/#D54))

A mutator writes readable tables or encrypted tables, never both, and its tables decide how its commands travel. Readable tables use `Mutate`: the device sends the arguments, and the server runs the same mutator again on its rows and may refuse. Encrypted tables use `Seal`: the device's run is final. At push the device replays the command, pads and encrypts each row it wrote, and sends it with the base it was computed from: a row version, no row, or the row as its own earlier command left it. The server checks membership, role, key epoch, base and size without reading the row. When the row moved, it answers `Stale`, and the device pulls, replays the command on the newer row and seals it again.

The server can't run a mutator on ciphertext. Compare-and-swap keeps the rule that a command runs against the latest row, so concurrent edits of different fields still both win. One write path for both classes would save 100 to 150 lines only if `Enrollment`'s rules, which decide course membership, became a row validator beside its mutator, and those rules would then exist twice. Domain checks on encrypted rows run on the device, so a modified app can only corrupt what its owner may write anyway.

Reasoning: [encryption.md, the write path for encrypted tables](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/encryption.md#the-write-path-for-encrypted-tables), [Tx conformance spike, one write path](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/spikes/tx-conformance.md#d54-one-write-path).
