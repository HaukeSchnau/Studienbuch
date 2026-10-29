# Recovery methods are key pairs

Status: accepted 2026-10-29 ([D58](https://files.schnau.dev/html/studienbuch-roadmap/#D58))

Every way back to an account's root key is a wrapper with a key pair. The method's secret derives a seed and a MAC key with HKDF, bound to the account, and the seed an X-Wing key pair: a device's random seed in its keychain, a passkey's PRF output, or the 16 bytes of a Notfallkarte. The server stores the public key in a statement and the root key of each generation sealed to it. Renewing the root key after a lost phone therefore seals the new key to every wrapper with no method present: the card in a drawer keeps working, and the student's other devices find the new key in their own seal.

The server holds every public key, so it could seal a key of its own choosing, and a thief who copied an old root key could sign with that generation's identity key. Four checks stop a device from adopting a planted key or keeping a planted wrapper:

- Each generation's key record is signed by its own identity key and linked from the previous generation's.
- Each statement carries an anchor: an HMAC under the method's MAC key over the statement and the identity key of the generation it was created at. Only the secret can produce it.
- Each statement carries an endorsement by the newest generation's identity key. A renewal re-endorses only the wrappers the previous generation endorsed, and seals only to wrappers the new generation endorses. Recovery accepts a statement only if the newest generation endorses it.
- A recovering device accepts a root key only if the anchor verifies, every link from the anchor's generation to the newest record verifies, the seal is for the newest generation, and the key derives that record's identity and sealing keys.

What holds depends on the server. Against a leaked dump, and against a thief whom the server doesn't help, a stolen generation's key endorses nothing after the next renewal. Wrappers the thief added while that generation was current are the exception: the renewal re-endorses them unless the student removes them first. "Gerät entfernen" offers the wrappers created in the lost device's last seven days for removal, but that list is the server's metadata, so it only helps while the server is honest. An active server can hide or relabel wrappers in that list, withhold the newest generation from a device, and, holding a stolen generation's key, serve a forked successor chain that a recovering device accepts even after any number of renewals. No check in this design detects that. Key transparency, a log of key records that every device checks for forks, is the fix. A cheaper step for M3: the renewing device flags every statement it hadn't seen before the loss, instead of trusting the server's list.

The Notfallkarte's code is 128 random bits and a CRC-12 in 28 Crockford base32 characters. The CRC catches every mistyped character and every swap of two neighbours before anything reaches the server, so a typo and a wrong card get different messages. With 128 bits, a leaked dump can't be attacked offline, so no slow KDF is needed.

Reasoning: [recovery.md](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/recovery.md), sections 1 and 7.
