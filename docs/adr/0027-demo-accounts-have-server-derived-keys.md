# Demo accounts have server-derived keys

Status: accepted 2026-10-29 ([D55](https://files.schnau.dev/html/studienbuch-roadmap/#D55), [D66](https://files.schnau.dev/html/studienbuch-roadmap/#D66))

Previews seed a demo school whose students, Lena and Tom, anyone can sign in as, and the store's reviewers sign in to Lena's account on beta with a password from a secret. Their notebooks are encrypted like everyone else's, so a device needs the account's root key R to open them. For the accounts in `demo_account`, and no other, the server derives R from the secret `DEMO_KEY_SEED`: HKDF-SHA256 over the seed, with the account id in the info. The seed publishes their first key records. Persona sign-in on development and preview servers hands R over with the session. `Demo.rootKey` gives a signed-in demo account its own R on any server, which the review account needs after signing in with its password.

This is the one exception to "the server holds no key", and it stays small. Only `prepare`'s seed and the operator console create demo accounts, because they alone hold the `Seeding` capability. A lint rule keeps that capability, the derivation, persona sign-in and every write to `demo_account` in their own modules. A test calls every RPC as an ordinary account and finds no new demo account and no root key. A demo account gets into the demo school only, so the review password, which every reviewer knows, never opens a real school. A leaked `DEMO_KEY_SEED` opens demo notebooks with invented content, and nothing else.

What this leaves out: a demo account's R never changes, so demo accounts have no recovery methods and no renewal. Changing `DEMO_KEY_SEED` strands what their devices sealed. Demo content written on the server waits until devices open sealed rows. Until then a persona's first device opens the notebook's first key epoch with the R it received.

Reasoning: [encryption.md](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/encryption.md), section 8, "Demo accounts", and [hosting.md](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/hosting.md), "Seeding a demo school".
