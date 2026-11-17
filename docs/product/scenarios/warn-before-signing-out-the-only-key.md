# Warn before signing out loses the notebook

Status: accepted
Platforms: Android, iOS, Web
Confidence: corroborated

## Rule

Signing out deletes this device's copy of the notebook's key. When no passkey, Notfallkarte or
other device opens the notebook without this device, or the device can't tell, "Abmelden" asks
first, in the same question that names unsent changes. Where only this device opens the notebook,
the question offers "Notfallkarte erstellen" before "Trotzdem abmelden". It never blocks the
sign-out, and it stays silent when nothing would be lost. A change saved after the question isn't
lost unasked: the question comes again and counts it.

## Example

Given a student who pressed "Später" and finished onboarding on this device
When the student presses "Abmelden"
Then the question says the notebook hangs on this device and offers "Notfallkarte erstellen",
"Trotzdem abmelden" and "Abbrechen"
And after a Notfallkarte, "Abmelden" signs out without asking

## Evidence contract

| Outcome                         | Executable evidence                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| The only key asks first         | After "Später", "Abmelden" shows the question with "Notfallkarte erstellen" and no sign-out yet |
| The safer way leads to the card | "Notfallkarte erstellen" opens Notizbuch-Schlüssel, still signed in                             |
| The student decides             | "Trotzdem abmelden" signs out and the device shows "Willkommen!"                                |
| One question for both losses    | Offline with unsent changes, the question names the notebook check and the changes, once        |
| Nothing to lose asks nothing    | With a Notfallkarte, or on a second device that is still locked, "Abmelden" signs out at once   |
| A later change asks again       | A change saved while the question is open brings the question back, counting it                 |

## State

Initial state: A new account of the demo school on one device, signed in after "Später"
Final state: The device is signed out, or still signed in with a Notfallkarte made
Side effects: A notebook signed out without a card is lost for good; use a new account per run

## Sources

- `docs/product/legacy-behavior/catalogue.md` has no counterpart: the legacy apps kept no notebook key
- The QA sweeps of 2026-11-11, issue 3, and the orchestrator's decision D2 on it
