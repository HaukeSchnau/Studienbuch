# Authentication and school access

Studienbuch accounts outlive any one school. An account owns the person's self-authored name,
verified email address, and authentication methods. A school access record answers which
school-specific notebook that account may use. Imported school directory data answers a separate
question: which real person a provider says exists. These records must not collapse into one
another.

## First release

Every account authenticates with a verified email address and password and may add passkeys after
signing in. A platform operator is an ordinary account with an active operator grant. The console
can create the first account and grant or restore operator authority for an existing account.

`operator-bootstrap` creates a verified, passwordless account. The account owner uses the standard
password-reset flow to choose its first password. Better Auth creates the missing credential during
that reset. This keeps initial provisioning inside the trusted console without maintaining a second
authentication or recovery protocol.

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
5. The user may add school-specific cohort and class details to their notebook profile.

A reservation prevents two registrations from racing for one code without permanently consuming a
code when someone closes the signup page. Reservations expire. Redemption is atomic and final.

A reservation authorises a small, fixed number of signups rather than every signup made during its
lifetime. Redemption is what consumes it, and redemption needs a verified address, which arrives
long after the signup request returns; without a budget in between, one code would buy two hours of
account creation and verification mail. The budget is larger than one so that someone who mistyped
their own address can correct it. Signing up with an address Studienbuch already knows answers with
a success rather than an error, so that signup cannot be used to test whether an address is
registered, and that response spends from the budget like any other.

The budget is claimed atomically before Better Auth starts signup. A request Better Auth rejects
returns that claim; a response describing either a new or deliberately masked existing account
keeps it. A read followed by a later increment is not sufficient here, because parallel requests
could all pass the read before any one of them increments the counter.

## Application boundary

Better Auth continues to own its standard `/api/auth/*` HTTP endpoints. Studienbuch's first-party
web and mobile clients use the shared Effect RPC group in `@stu/api` for product operations. The
group owns payload, success, and expected-error schemas; the server supplies handlers and
middleware, while each client supplies its transport. The web client uses JSON over `/api/rpc`.
Account and reservation reads are `AtomRpc` queries; enrollment and enquiry writes are `AtomRpc`
mutations. Authentication and authorization checks run in TanStack Router `beforeLoad`, while route
loaders warm the same registry read by React. Successful Better Auth session changes refresh the
account atom and invalidate Router so guards are evaluated against the new identity.

This is deliberately not a promise that every future endpoint is RPC. Public webhooks, downloads,
redirects, third-party integrations, and any API whose HTTP/OpenAPI surface is itself a product
belong in Effect HTTP API. The authentication provider's protocol also remains HTTP rather than
being wrapped in a private RPC facade.

## Stored meaning

A school access record means only that an account redeemed a code issued for a school. The account
name and email do not prove school membership or a provider identity.

The notebook profile contains only school-specific, self-authored data such as cohort and class.
The access code fixes the access kind, so a student cannot grant themselves teacher access. A
teacher code initially unlocks the teacher's own workspace. Reading or changing student data
requires a verified directory link or an explicit grant that is outside this first release.

Provider-backed directory memberships stay separate. Studienbuch must never link a self-authored
profile to an imported person by matching a name, class, or email address. A future linking ceremony
must use stronger evidence and record that decision explicitly.

## Privacy

The account name and email address belong to the authentication system. Studienbuch uses them for
personal account UI, login, verification, and account recovery. They are not copied into the
notebook profile, exposed to a school, used as proof of school membership, or enrolled in marketing.

Imported names remain independent. Studienbuch never links an account to an imported person because
their names or email addresses happen to match.

Schools can see counts for generated, reserved, redeemed, expired, and revoked codes. They do not
receive a code-to-account or code-to-email mapping.

## Security rules

- Store access codes and reservations as hashes. Show plaintext only when they are created.
- Generate 80 bits of randomness for human-entered access codes. Their one-time use and
  server-side verification make that ample. Generate at least 128 bits for machine-entered
  reservation tokens.
- Make access codes revocable and optionally expiring. Codes do not expire by default because
  schools may distribute printed batches over a long period.
- Allow only one active reservation per code. Expired reservations no longer block a code.
- Bound the number of accounts one reservation may create. Claim from that bound atomically before
  signup, then return the claim when Better Auth rejects the request.
- Rate-limit the enrollment routes per client. Not for entropy — 80 bits is ample — but so that one
  client cannot churn reservations or the work behind them.
- Require a verified email before an account can redeem a reservation or enter the app.
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
