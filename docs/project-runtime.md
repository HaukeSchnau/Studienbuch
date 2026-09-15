# Project development and release

`devenv.nix` defines the native database, web, mobile and worker processes and
their setup tasks. `nix/project-contract.nix` adds Project metadata to that graph
and declares the application's resource requirements. `project.json` is the
generated transport contract. Regenerate it with `project export` after editing
the declarations; preparation rejects an export that differs from the native graph.

For a managed checkout:

```sh
project inspect --json
project plan --json
project dev up
project dev console --help
project dev down
```

`plan` reports missing resources without creating files or allocating an instance.
`up` activates the instance, and `down` keeps it paused across reconciliation.
`project dev retire` stops an instance while retaining its database and credentials.
Use `--name` to create a separate instance from the same checkout. `project dev
bundle refresh` explicitly prepares a changed generation.

Development provides PostgreSQL 17 through the native database process. Project
assigns its port and retained data directory. The requirement accepts PostgreSQL
16 and 17 so production can bind an existing supported host database. A version
change to an initialized local data directory still needs an explicit migration.

Web and Metro consume their Project endpoint's listen address and port. In an
isolated workspace, Metro uses LAN mode so the workspace's preview forwarding can
reach it. Ordinary local development keeps Metro on localhost.

Each development instance receives a generated session-signing credential. WebUntis
account credentials and school selection come from authorized host bindings.
Production also binds SMTP and the session credential through host policy. Their
values are resolved only when a consuming action runs.

The Release scripts receive `DATABASE_URL`, auth settings, account settings and
telemetry identity through the same declarative environment interface. They own
application startup, migrations and maintenance commands. The host owns database
placement, access, service dependencies and backups.

Ordinary local devenv keeps its local environment and process lifecycle. The SDK
applies Project environment references only during managed execution.
