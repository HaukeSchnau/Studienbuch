# @stu/lib-server

Server-side helper layer built on domain and repository packages.

## Responsibilities

- Auth/session helpers.
- User creation and account support utilities.
- Notification dispatch integration helpers.
- Schedule and PDF conversion helpers.
- Ticket-related utility integration.

## Public Surface

From `src/index.ts`:

- `auth`
- `infrastructure`
- `notifications`
- `pdf`
- `schedule`
- `tickets`
- `users`

## Key Files

- `src/auth/`: permission/session/password/cookie helpers.
- `src/notifications.ts`: notification functionality.
- `src/schedule/`: import and substitution helpers.
- `src/pdf/convertPdf.ts`: PDF conversion utility.
- `src/users/createUser.ts`: user creation workflow.

## Scripts

```bash
bun --filter @stu/lib-server lint
bun --filter @stu/lib-server typecheck
```

## Testing

- `src/auth/session.test.ts`

## Internal Dependencies

- `@stu/db`
- `@stu/external-api`
- `@stu/lib`

## Note

`package.json` currently declares a `./client` export path; verify it stays aligned with actual files when changing exports.
