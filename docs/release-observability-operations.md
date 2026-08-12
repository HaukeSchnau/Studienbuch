# Release observability operations

The production web release exports its Effect telemetry to the host-local OTLP
agent at `http://127.0.0.1:4318`. The Nix release action owns the environment
translation:

- `STUDIENBUCH_OTEL_ENABLED=true`
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318`
- `STUDIENBUCH_ENVIRONMENT=production`
- `STUDIENBUCH_VERSION=<immutable Nix web-application output identity>`
- five-second export and three-second exporter shutdown timeouts

The collector is not an application availability dependency. Export failures
must remain buffered or dropped according to exporter policy without failing
HTTP startup or requests. The collector has no public listener; browser
telemetry enters through the strict same-origin Studienbuch HTTP relay. Mobile
delivery stays disabled until the app can supply a short-lived user authority
and the relay gains the corresponding authentication policy.

## Deployment health

The release descriptor checks both application-owned endpoints:

- `/api/health/live` proves the HTTP process is alive.
- `/api/health/ready` proves the Effect runtime has successfully warmed.

The release smoke also invokes `/api/observability/v1/canary` against a local
OTLP test receiver, verifies that logs, metrics, and traces reach that receiver,
and requires the server to flush and terminate within five seconds after
`SIGTERM`.

## Fleet follow-up

Project descriptor v2 intentionally has no systemd dependency escape hatch, so
collector ordering belongs in `~/infra`. On `srv-2`, extend the generated unit
without adding a hard requirement:

```nix
systemd.services.app-deployment-studienbuch = {
  after = [ "opentelemetry-collector.service" ];
  wants = [ "opentelemetry-collector.service" ];
};
```

Do not use `requires`: Studienbuch must continue to start and serve when the
collector is unavailable. Add an evaluated infra check for both soft edges.

The runtime manifest does not expose the deployed VCS revision to repository
actions. The Nix output identity is therefore used as `service.version`.
Adding `vcs.revision` requires a typed runtime-context field or a host-supplied
environment binding; do not infer it from a mutable checkout.

## Recomputing the dependency hash

After the root lockfile is regenerated for the new `@stu/observability`
workspace dependencies, run:

```sh
nix build .#webApplication
```

Copy the `got: sha256-...` value into `pnpmDependencyHash` in
`apps/web/nix.nix`, then rerun the web application and release smoke builds.
