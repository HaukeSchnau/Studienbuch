# Studienbuch web

The web app contains the public site, legal pages, authentication ceremonies, and the browser
version of the product. TanStack Start owns delivery and routing. Effect owns application services,
RPC, failures, and server-derived client state.

## Run it

From the repository root:

```bash
vp run --filter @stu/web dev
vp run --filter @stu/web test
vp run --filter @stu/web build
```

The development server needs PostgreSQL because its Effect runtime fails closed. Public-site work
can skip that runtime locally:

```bash
STUDIENBUCH_WEB_SKIP_RUNTIME=1 vp run --filter @stu/web dev
```

The flag is ignored in production.

Nitro reloads server request handlers in place, so edits do not restart the development process or
its long-lived database and telemetry resources. Migration files are never watched or applied in
response to an edit. Managed development applies pending migrations when the instance starts; run
`just db-migrate` deliberately when adding one to an instance that is already running.

## Rendering and routing

Public marketing and legal routes render on the server. The pathless `_client` route disables SSR
for authentication and product routes, which are session-bound applications rather than indexable
documents.

Every router instance owns one `AtomRegistry`. The same registry is provided to React and exposed in
route context. Route reads therefore warm the exact cache consumed by components:

- `beforeLoad` owns authentication, authorization, and redirects.
- `loaderDeps` identifies route input; `loader` awaits the corresponding Effect Atom query.
- Components consume the same query with `useAtomSuspense`.
- Mutations use `AtomRpc` and explicit reactivity keys to invalidate affected queries.
- Router's abort signal interrupts Effect acquisition when navigation is abandoned.

Do not fetch route data in `useEffect`, introduce a second client cache, or redirect after render.
Local form input, disclosure, focus, and animation state remain ordinary React state.

See [Effect architecture](../../docs/effect-architecture.md) and
[authentication](../../docs/authentication.md) for the boundary rules.

## Authentication

Copy `.env.example` to `.env.local`, set `DATABASE_URL`, and generate a Better Auth secret:

```bash
vp dlx @better-auth/cli secret
just db-migrate
```

Better Auth owns `/api/auth/*`. Studienbuch product operations use Effect RPC at `/api/rpc`.
Regular signup requires a reserved school access code. Production email uses
`STUDIENBUCH_SMTP_URL_FILE`; local development defaults to console delivery.

Create operators and school codes through the console:

```bash
project dev console operator-bootstrap --name "Hauke Schnau" --email hauke@example.com
project dev console access-codes --school-id igs-lilienthal --school-name "IGS Lilienthal" \
  --kind student --count 100 --operator-user-id <operator-user-id>
```

The bootstrap output links to the ordinary password flow. Use `operator-grant --email` when the
account already exists.

## Production

`vp run --filter @stu/web build` creates a self-contained Nitro server under `.output/`. Start it
with:

```bash
node --import .output/server/instrument.server.mjs .output/server/index.mjs
```

The Nix flake exposes the managed release as `packages.projectRelease`. Deployment supplies the
public URL, listener, database, credentials, and scheduled WebUntis jobs.

## Observability

Sentry is enabled by the server-side `STUDIENBUCH_SENTRY_DSN` setting and is limited to crash and
error reporting. Effect and OpenTelemetry own traces, logs, and metrics. There is no product
analytics SDK, and client telemetry uses an allowlisted envelope without free-text fields. See
[`packages/observability/README.md`](../../packages/observability/README.md).
