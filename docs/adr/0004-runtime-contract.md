# Runtime contract

Status: accepted 2026-10-28 ([D8](https://files.schnau.dev/html/studienbuch-roadmap/#D8))

The server knows nothing about Fleet, Nix, systemd or devenv. Configuration comes only from environment variables, and every secret may also come from a `<NAME>_FILE` path, which wins. One executable has four commands: `serve` (the default), `prepare` (migrations under an advisory lock and the demo school seed, run before traffic switches), `console` (the operator CLI) and `verify` (the restore drill's checks). It needs PostgreSQL 18 over a direct connection, one bucket behind an S3 API, and SMTP. `STUDIENBUCH_ENVIRONMENT` gates development features and nothing else.

A host that runs Node 26, sets the variables, runs `prepare` before switching traffic, terminates HTTPS with WebSockets and gates on `/api/health/ready` can run Studienbuch. The Alchemy stack binds the contract to srv-2 today, and moving production to another host changes the stack, not the app.

Reasoning: [hosting.md, section 1](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/hosting.md#1-runtime-contract).
