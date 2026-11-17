# Accounts without an email address

Status: accepted 2026-11-17 ([D97](https://files.schnau.dev/html/studienbuch-roadmap/#D97))

An account needs no email address. Sign-up offers two ways in: the email account as before, and an account without an address, which starts with a passkey, or with the Notfallkarte on a device without passkeys. The Notfallkarte alone then signs in to such an account: the device derives a login from the card's 128 bits (`RecoveryCode.login`), and the server keeps only its SHA-256 as a Better Auth account row. Whoever holds the card holds the account and the notebook, as with a recovery phrase. An email account's card still opens only the notebook, after a sign-in.

Better Auth needs an address per account, so an account without one carries Better Auth's placeholder under `.invalid`, made from a random id. `Mail` refuses any `.invalid` recipient and no email route accepts one, so nothing mails a code a stranger could use. A passkey that signs up registers without a session, which this ADR adds to [ADR 0025](0025-recovery-without-escrow.md): it needs an access code's reservation, and the account, the passkey and its session come into being in one transaction. A registration from a signed-in device keeps ADR 0025's ten-minute rule and still signs nobody in. Nobody confirms such an account, so its sign-up spends the code's use at once, and every code has a use limit.

The LfD Niedersachsen's Eckpunkte for learning platforms want pseudonymous pupil accounts to be possible, and the address is the most identifying thing the server reads about a pupil. Passkeys alone would leave the login without a way back once the passkey is gone, and school computers without a way in. School-issued IDs need a school, which D96 rules out as the only way in, and bring passwords back. What this leaves out: adding an address to an account without one, and deleting accounts nobody signed in to for 13 months, which needs in-app deletion first.

Reasoning: [pseudonymous-accounts.md](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/pseudonymous-accounts.md), with Hauke's decisions in its last section.
