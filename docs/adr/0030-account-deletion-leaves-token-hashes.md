# Account deletion leaves token hashes

Status: accepted 2026-11-17

A student deletes their account in the app (Art. 17 DSGVO, and Apple requires deletion to start in the app). `AccountDeletion.delete` needs a sign-in in the last ten minutes, as a new passkey does, so a thief with an unlocked phone can't delete the account. Proof by password or passkey happens through an ordinary sign-in, whose password checks Better Auth's routes already limit, and an account without an email address proves itself the same way. The deletion runs in one transaction of our own rather than Better Auth's `/delete-user`, which deletes in separate statements and knows nothing of notebooks, memberships or sync clients. Its sessions end through `Deletion.Ended`, which the session resolver merges with Better Auth's revocations, so the sync server closes their sockets.

The other devices of the account must forget it too, and an ended session alone keeps a device's data until it signs in again (D27). So the transaction leaves one `deleted_session` row per session it ended: the SHA-256 of the session's token, and nothing else. A device whose session ends asks `AccountDeletion.deleted` with the token it still holds and forgets the account on yes, as sign-out does. Only the device holding a token can ask about it, so the rows reveal nothing to anyone else, and they name no account and no time. They don't expire, because a device may come back after any time.

Rejected: answering by account id whether an account exists. Anyone holding an id could ask, and a device would wipe itself when a backup restore lost an account created after the backup.

What this leaves out: a device whose session had already ended for another reason before the deletion, such as a password change that signed the other devices out, holds no token the server remembers, so it keeps its copy until it signs out or the app's data is deleted. The operator's deletion by email request has no console command yet and should run `Deletion.run`.
