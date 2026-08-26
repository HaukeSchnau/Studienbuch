# The application shell

One account leads several lives. A person can be a student at one school, a teacher at another, and
the operator of Studienbuch itself. The shell exists so that "which of those am I right now" is
answered once, explicitly, and everything below it is scoped to that answer.

## Contexts

A **context** is one of those lives. Exactly one is active at a time.

- one per redeemed school access — `Student` or `Teacher` today
- one operator context, if the account holds a grant
- later: one per guardian relationship, one per administrator membership

`Organization.ContextRef` in `packages/core/src/organization/context.ts` is the identity. It lives in
core rather than in an application because both surfaces have to agree on what a context is and how
a deep link spells one.

### How a context is spelled

```
/app/igs-lilienthal/schueler/heute
/app/gymnasium-nord/lehrer/kurse
/app/operator/schulen
/app/konto                          account-scoped, outside every context
/app                                resolves to the active context
```

`(schoolId, kind)` is unique per account — `school_accesses_active_identity_unique` — so those two
segments identify a context exactly, including for someone who is both a student and a teacher at
one school.

Two consequences: `Organization.SchoolId` is constrained to a slug because it appears in the address
bar, and `operator` is a reserved school id so that `/app/operator/...` can only ever mean the
operator context.

The active context is chosen by, in order: what the URL says, what this browser last used, then the
first available. The URL wins so that a link someone was sent opens where it points.

## Capabilities, not roles

Destinations declare the capability they require. They never name a role.

`Organization.capabilitiesFor` turns a context into a small set — `KeepNotebook`, `TeachCourses`,
`AcknowledgeAsGuardian`, `AdministerSchool`, `OperatePlatform` — and the registry in
`apps/web/src/domain-ui/shell/destinations.ts` filters on it.

This is deliberately coarser than `Organization.authorize` in `authority.ts`, and the two must stay
apart. `authorize` answers "may this actor acknowledge for _this student_ on _this date_", which is
the right question for an action and the wrong one for a menu — a destination has no target yet.

Today the coarse set is derived from a redeemed access code, which names only a school and a kind.
When provider-backed directory memberships arrive, `capabilitiesFor` reads `SchoolMembership.roles`
instead and one context can return several capabilities. **Only that function changes.** The
registry, the navigation and every route are already correct. That is the whole point of naming the
question this way, and it is why nothing else may branch on `kind`.

## Where the pieces live

| Path                                        | What it owns                                          |
| ------------------------------------------- | ----------------------------------------------------- |
| `packages/core/src/organization/context.ts` | The portable model: refs, capabilities, path encoding |
| `apps/web/src/domain-ui/shell/`             | The chrome: registry, responsive navigation, switcher |
| `apps/web/src/routes/app*.tsx`              | The routes and the destination screens                |

Operator destinations are registered only in the web application's registry. Mobile builds its list
from the same capability model and never names them, which keeps administration out of a student's
bundle while leaving it an ordinary context rather than a separate application.

`shell-state.tsx` holds the React context deliberately outside any route file. The router
code-splits route modules, so a destination importing the provider from `routes/app.tsx` receives a
second module instance — and therefore a second, empty React context — while the provider populates
the first.

## What the shell does not do yet

No sync or offline hydration. The shell renders from `accountAtom` and degrades to the last known
contexts; real offline hydration waits on the event-log decision that `effect-architecture.md`
defers pending a Groundswell/LiveStore comparison. The capability model is shaped so that decision
does not disturb it — note that the accepted backlog requires authorization to be checked _before_
an event enters the offline outbox, and `authorize` is already pure and IO-free for exactly that.

The mobile shell still hard-codes its three tabs. Aligning it to `capabilitiesFor` is the next step,
and it must keep `main-shell-navigation.md` and `main-shell-responsive-navigation.md` passing.
