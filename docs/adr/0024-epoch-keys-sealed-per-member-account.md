# Epoch keys sealed per member account

Status: accepted 2026-10-29 ([D38](https://files.schnau.dev/html/studienbuch-roadmap/#D38), [D40](https://files.schnau.dev/html/studienbuch-roadmap/#D40))

Each encrypted space has one random key per epoch. A key box delivers it to one member account: an X-Wing encapsulation (ML-KEM-768 and X25519) to the account's sealing key, and the keys under AES-256-GCM, signed with the author's Ed25519 identity key. A history link holds the previous epoch's key under the current one. Both live in the space as rows the server stores and checks without opening. The notebook is the one-member case, so v1 runs the machinery that shared spaces use later.

A device opens a box only as filed: the space and the recipient come from where the device found it, not from the box, and the box's author and recipient generations must be the newest ones the device verified. A box signed at an older generation counts as unsigned, because a thief may hold that generation's key, so a renewal re-seals the boxes its author wrote.

Keys belong to accounts, not devices. Every device of an account reads the same spaces, so a new phone needs only the account's root key and finds every box. One box covers the newest key and, for a member who may read history, older keys too, so history visibility is a setting per space (D40) and not a format. Each space carries a key scheme id, `sealed-v1`, so a space kind can later take its epoch key from an MLS group's exporter without touching rows.

MLS was the alternative. Its forward secrecy and healing after a compromise don't fit records that must stay readable on every new device, its members are devices, and a commit made offline usually loses. X-Wing is hybrid because boxes sit in backups for years, and BSI accepts ML-KEM only in a hybrid. Sealing a box takes about 33 ms on Hermes on an iPhone-class core, in noble's JavaScript (`spikes/native.md`), and the suite id lets native ML-KEM replace it later.

Safari's WebKit randomizes Ed25519 signatures, and on iOS 27 its verify rejects any signature over an empty message. So no format depends on signature bytes, and every signed message starts with a label.

Reasoning: [encryption.md](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/encryption.md), sections 3 to 5.
