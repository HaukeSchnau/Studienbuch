# Scheduled jobs inside the server

Status: accepted 2026-10-28 ([D21](https://files.schnau.dev/html/studienbuch-roadmap/#D21))

The WebUntis import, blob garbage collection, the demo refresh and retention cleanup run inside the server process, through Effect's `ClusterCron` on a `SingleRunner` backed by Postgres. Runs never overlap and missed runs catch up in order. `STUDIENBUCH_JOBS` picks the jobs a process runs, or `none`, so splitting them into a second process later is a deploy setting, not a code change.

Any host that runs the server then runs the jobs, with no timers and no NixOS switch for a job change. The cost: `effect/cluster` is marked unstable and is Effect's most actively patched area. M0 runs a single `heartbeat` job on the real host before anything depends on it. The `cluster_*` tables migrate themselves and stay out of drizzle-kit.

Reasoning: [hosting.md, scheduled jobs](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/hosting.md#scheduled-jobs-d21).
