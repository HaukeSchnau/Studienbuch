# Recovery methods are key pairs

Status: accepted 2026-10-29 ([D58](https://files.schnau.dev/html/studienbuch-roadmap/#D58))

Every way back to an account's root key is a wrapper with a key pair. The method's secret derives a seed and a MAC key with HKDF, bound to the account, and the seed an X-Wing key pair: a device's random seed in its keychain, a passkey's PRF output, or the 16 bytes of a Notfallkarte. The server stores the public key in a statement and the root key of each generation sealed to it. Renewing the root key after a lost phone therefore seals the new key to every wrapper with no method present: the card in a drawer keeps working, and the student's other devices find the new key in their own seal.

The server holds every public key, so it could seal a key of its own choosing, and a thief who copied an old root key could sign with that generation's identity key. Four checks stop a device from adopting a planted key or keeping a planted wrapper:

- Each generation's key record is signed by its own identity key and linked from the previous generation's.
- Each statement carries an anchor: an HMAC under the method's MAC key over the statement and the identity key of the generation it was created at. Only the secret can produce it.
- Each statement carries an endorsement by the newest generation's identity key. A renewal re-endorses only the wrappers the previous generation endorsed, and seals only to wrappers the new generation endorses. Recovery accepts a statement only if the newest generation endorses it.
- A recovering device accepts a root key only if the anchor verifies, every link from the anchor's generation to the newest record verifies, the seal is for the newest generation, and the key derives that record's identity and sealing keys.

One window remains. A thief who holds generation g's key can add a wrapper while g is still current, and the renewal that follows "Gerät entfernen" would re-endorse it. That flow lists the wrappers created in the lost device's last seven days, already marked for removal, so the student drops them before the renewal; after it, the old key endorses nothing. Beyond that, an active operator can withhold the newest generation from a device or sign a fork with a stolen key that no renewal has replaced. Key transparency closes both later.

The Notfallkarte's code is 128 random bits and a CRC-12 in 28 Crockford base32 characters. The CRC catches every mistyped character and every swap of two neighbours before anything reaches the server, so a typo and a wrong card get different messages. With 128 bits, a leaked dump can't be attacked offline, so no slow KDF is needed.

Reasoning: [recovery.md](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/recovery.md), sections 1 and 7.
