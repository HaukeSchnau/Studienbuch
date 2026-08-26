# Release observability operations

The production web release exports its Effect telemetry to the OTLP endpoint selected by the
Project Runtime. The release descriptor declares an `observabilityOtlpEndpoint` parameter, while
the private deployment owns its concrete host-local value. The Nix release action translates that
runtime context into the application environment:

- `STUDIENBUCH_OTEL_ENABLED=true`
- `OTEL_EXPORTER_OTLP_ENDPOINT=<runtime-selected endpoint>`
- `STUDIENBUCH_ENVIRONMENT=production`
- `STUDIENBUCH_VERSION=<immutable Nix web-application output identity>`
- `STUDIENBUCH_REVISION=<promoted immutable Git revision>`
- five-second export and three-second exporter shutdown timeouts

The collector is not an application availability dependency. Export failures
must remain buffered or dropped according to exporter policy without failing
HTTP startup or requests. The collector has no public listener; browser
telemetry enters through the strict Studienbuch HTTP relay. Browser delivery is same-origin;
mobile delivery attaches the current Better Auth session cookie for each send. Both use the same
bounded envelope and Effect HTTP delivery contract, and the relay admits only authenticated mobile
requests or browser requests with a valid same-origin authority.

## Deployment health

The release descriptor checks both application-owned endpoints:

- `/api/health/live` proves the HTTP process is alive.
- `/api/health/ready` proves the Effect runtime has successfully warmed and reports the promoted
  Git revision in Release.

The release smoke also invokes `/api/observability/v1/canary` against a local
OTLP test receiver, verifies that logs, metrics, and traces reach that receiver,
and requires the server to flush and terminate within five seconds after
`SIGTERM`.

The host binds the collector as a weak dependency (`wants`, never `requires`) so Studienbuch keeps
serving if telemetry is unavailable. Runtime Context supplies the immutable revision; server,
console, migration, and worker telemetry attach it as `vcs.revision`. `service.version` remains the
immutable Nix application output identity because the two values answer different questions.

Gitea at `git.schnau.dev` is authoritative for CI and deployment. Use `tea actions` to inspect the
workflow. GitHub is a mirror and may lag.

## Recomputing the dependency hash

After the root lockfile is regenerated for the new `@stu/observability`
workspace dependencies, run:

```sh
nix build .#webApplication
```

Copy the `got: sha256-...` value into `pnpmDependencyHash` in
`apps/web/nix.nix`, then rerun the web application and release smoke builds.
