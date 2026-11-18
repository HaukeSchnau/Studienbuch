# Sign up without an email address

Status: accepted
Platforms: Android, iOS, Web
Confidence: corroborated

## Rule

An access code makes an account without an email address. Where the device keeps passkeys, one
passkey prompt makes the account; on a public computer or a device without passkeys, the
Notfallkarte does. Either way the account's Notfallkarte shows next, before anything else, and
nothing skips it: it is the account's way back. Until the student says it is saved, the device
keeps the card, so a reload or a restart shows the same card again. Signing out before that
deletes it from the device with the account's other secrets. Without a passkey the step
offers one, and if the student says "Später", it ends with typing the code back once, which also
signs in with it. A public computer offers no passkey and goes straight to the typing: the card
then gives the notebook's key its way back on the student's own device. "Lieber mit E-Mail-Adresse" keeps the email sign-up.

## Example

Given a computer without passkeys and the demo school's access code
When the student presses "Notfallkarte erstellen", reloads the page, presses "Ich habe ihn
aufgeschrieben" and "Später", and types the code back
Then the same card showed before and after the reload
And the first start asks "Wie soll die App dich nennen?"

## Evidence contract

| Outcome                          | Executable evidence                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| A passkey makes the account      | With a platform authenticator, "Konto mit Passkey anlegen" leads to "Deine Notfallkarte"         |
| The card makes the account       | Without one, "Notfallkarte erstellen" leads to "Deine Notfallkarte"                              |
| The card survives a restart      | After a reload, "Deine Notfallkarte" shows the same 28 characters                                |
| A typo or another card is caught | The read-back answers "Da stimmt ein Zeichen nicht" or "Das ist nicht der Code von dieser Karte" |
| The read-back signs in           | The right code leads to the first start, and the server knows the card's login                   |
| Email stays a choice             | "Lieber mit E-Mail-Adresse" opens "Konto erstellen" with "Freiwillig."                           |

## State

Initial state: Signed out, the demo school's access code redeemed, online
Final state: A new account without an address, signed in, its card saved, on the first start
Side effects: The code spends one use; use a new account per run

## Sources

- `docs/adr/0030-accounts-without-an-email-address.md` and Hauke's decisions D97 (Q4, Q7)
- No legacy counterpart: the legacy apps signed up with an email address only
