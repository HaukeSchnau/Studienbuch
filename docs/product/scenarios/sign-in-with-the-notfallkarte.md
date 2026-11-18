# Sign in with the Notfallkarte

Status: accepted
Platforms: Android, iOS, Web
Confidence: corroborated

## Rule

The Notfallkarte of an account without an email address signs in on any device, a public computer
included, and opens the notebook in the same step. A mistyped code gets its answer on the device,
offline too, before anything is sent. A card the student replaced signs in nowhere: a new card
retires the old one and signs out every other device of the account, which keep their entries and
say that the sign-in ended. "Kurz bestätigen" before a new card or passkey takes the card too. An
account signed in on a public computer keeps its card in the tab's memory when it signs in again
there, as its first sign-in chose.

## Example

Given an account without an address made on `?device=a`, with its name set on the first start
When the student types the card's code on `?device=b` under "Mit Notfallkarte anmelden"
Then device b greets the student by that name
And after a new card on device b, the old card is refused and device a's sign-in has ended

## Evidence contract

| Outcome                        | Executable evidence                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| One entry signs in and unlocks | After the card, the overview greets the student and no "Dein Notizbuch ist gesperrt" shows   |
| A typo stays on the device     | Offline, a changed character answers "Da stimmt ein Zeichen nicht"                           |
| A replaced card is refused     | The old code answers "Diese Notfallkarte gehört zu keinem Konto"                             |
| Other devices are signed out   | Device a shows "Deine Anmeldung ist abgelaufen" and keeps its entries                        |
| A public computer works        | With "Öffentlicher Computer", the card signs in and opens the notebook                       |
| The card confirms a sign-in    | An hour after sign-in, "Notfallkarte erstellen" asks "Kurz bestätigen" and the card confirms |

## State

Initial state: An account without an address with a saved card, another device signed out
Final state: Both devices hold the account; after a new card, only the device that made it
Side effects: None beyond the account's own sessions

## Sources

- `docs/adr/0030-accounts-without-an-email-address.md` and Hauke's decisions D97 (Q2)
- QA issue 35: a replaced card kept working
