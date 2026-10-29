# Recovery without escrow

Status: accepted 2026-10-29 ([D43](https://files.schnau.dev/html/studienbuch-roadmap/#D43), [D58](https://files.schnau.dev/html/studienbuch-roadmap/#D58), [D65](https://files.schnau.dev/html/studienbuch-roadmap/#D65))

Only the student's own methods open the notebook's root key. Neither the operator nor the school holds a copy, a key that opens one, or a secret derived from the password. The demo accounts are the one exception: the server derives their keys from its own secret (ADR 0027). A student who loses every method loses the encrypted notebook. The account, the timetable and the course choice come back at once, because they are readable. Copy never promises more than that, and says plainly that nobody, Studienbuch included, can bring the entries back.

M1 builds three methods, each a wrapper of ADR 0026:

- **The device wrapper.** Every device that holds the root key keeps a device seed in its keychain. A browser in "Öffentlicher Computer" mode keeps no seed, and unlocks again on every visit.
- **A passkey with PRF.** Sign-in and unlock take one prompt. The PRF output never leaves the device.
- **The Notfallkarte, typed in.**

QR pairing, renewal after a lost device, device removal, and the unlock banners and mail arrive in M3.

The server stores each account's key records, statements and seals, and checks every signature and endorsement it receives. It can't open a seal. Two limits guard the methods:

- A passkey or Notfallkarte wrapper needs a sign-in in the last ten minutes, so a thief with an unlocked phone can't quietly add a card of their own.
- An account gets 20 seal fetches in 24 hours, and each fetch that finds a seal writes a `recovery_event` in the same transaction. The 128 bits of a card are the real protection. The limit and the events give M3's unlock alerts something to show.

Key operations need the server: it decides `ChainExists`, the ten-minute rule and the limit. So in M1 a device sends them online and shows a new Notfallkarte only after the server stored its wrapper. The offline promise covers the notebook's content, not key operations, which need a sign-in anyway. ADR 0021 says a device re-sends its key operations after a restore. M1 doesn't: a re-sent passkey or card wrapper would fail the ten-minute rule, so M3 designs the re-send with its local queue. Until then, a device that finds the server without its generation 0 publishes it again.

Escrow was the alternative: a copy of the root key under an operator key, or under a key derived from the password. An operator copy is exactly what the privacy claim rules out, and a dump with it is a dump with every notebook. A password-derived key falls to an offline guess against a leaked dump, and a password reset would lose the notebook anyway.

Reasoning: [recovery.md](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/recovery.md), sections 1, 2 and 7, and [encryption.md](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/encryption.md), section 8.
