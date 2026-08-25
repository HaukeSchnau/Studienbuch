# Authentication and school access

Studienbuch accounts outlive any one school. Authentication answers who controls an account. A
school access record answers which school-specific notebook that account may use. Imported school
directory data answers a third question: which real person a provider says exists. These records
must not collapse into one another.

## First release

Regular users authenticate with a verified email address and password. They may add passkeys after
signing in. Platform operators use passkeys only. The console creates an operator account and a
short-lived setup token; it never creates an operator password.

Production uses `studienbuch.app` as its WebAuthn relying-party ID. A passkey registered on
`beta.studienbuch.app` therefore remains usable if the application later moves to another
`studienbuch.app` origin. Development derives its own relying-party ID from its URL and stays
cryptographically separate.

Public registration is closed. A regular user starts with an unassigned, one-time school access
code. The code names only a school and an access kind, currently `Student` or `Teacher`. It does not
name a person, email address, class, or cohort. An administrator can print a batch and let the school
distribute the codes in any order.

The flow is:

1. The user reserves an unused code.
2. They create an account or sign in to an existing one.
3. New accounts verify their email address.
4. Studienbuch redeems the reservation for the authenticated account.
5. The user configures their own notebook profile.

A reservation prevents two registrations from racing for one code without permanently consuming a
code when someone closes the signup page. Reservations expire. Redemption is atomic and final.

## Stored meaning

A school access record means only that an account redeemed a code issued for a school. It does not
verify the user's name, class, email domain, or provider identity.

The notebook profile is self-authored. A student may choose their display name, cohort, class, and
courses. The access code fixes the access kind, so a student cannot grant themselves teacher access.
A teacher code initially unlocks the teacher's own workspace. Reading or changing student data
requires a verified directory link or an explicit grant that is outside this first release.

Provider-backed directory memberships stay separate. Studienbuch must never link a self-authored
profile to an imported person by matching a name, class, or email address. A future linking ceremony
must use stronger evidence and record that decision explicitly.

## Privacy

An email address belongs to the authentication system. Studienbuch uses it for login, verification,
and account recovery. It is not copied into the notebook profile, exposed to a school, used as proof
of school membership, or enrolled in marketing.

The global account does not collect a person's name. Better Auth's required name field contains a
neutral internal value. A display name exists only in the self-authored, school-scoped notebook
profile.

Schools can see counts for generated, reserved, redeemed, expired, and revoked codes. They do not
receive a code-to-account or code-to-email mapping.

## Security rules

- Store access codes, reservations, and operator setup tokens as hashes. Show plaintext only when
  they are created.
- Generate 80 bits of randomness for human-entered access codes. Their one-time use and
  server-side verification make that ample. Generate at least 128 bits for machine-entered
  reservation and setup tokens.
- Make access codes revocable and optionally expiring. Codes do not expire by default because
  schools may distribute printed batches over a long period.
- Allow only one active reservation per code. Expired reservations no longer block a code.
- Require a verified email before a regular user can redeem a reservation or enter the app.
- Require WebAuthn user verification for passkey registration and authentication.
- Never automatically link accounts that happen to use the same email address at different identity
  providers.
- Read production SMTP credentials from a root-managed credential file, never from a checked-in
  environment file or build input.
- Record operator grants independently of school access.
- Revoke school access without deleting the global account or its other notebooks.

## Later additions

OIDC providers such as IServ can become another credential on the same account. Individual plans can
grant a personal notebook without a school access record. Neither change requires a new account
model. Cohort-specific code pools should wait until a school has an operational need for them.
