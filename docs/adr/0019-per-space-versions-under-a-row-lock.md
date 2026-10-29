# Per-space versions under a row lock

Status: accepted 2026-10-29

Every transaction that writes a space first runs `update space set version = version + 1 ... returning version` and stamps the rows it writes there with that number. The row lock holds until commit, so the next writer to that space waits, and version order is commit order. A device's cursor maps each space to the version it holds, and a pull reads every space in one `REPEATABLE READ` snapshot, so a commit that wrote two spaces arrives whole.

A sequence hands out numbers when called, but transactions commit in any order: in the M0 spike a puller following its cursor skipped 28 of 200 rows. One global counter would order every write of the app behind the longest import. On PostgreSQL 18 one hot space took 139 commits per second and 1,000 spaces 1,292, and no school writes one space that fast.

Reasoning: [sync.md, versions](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/sync.md#versions-one-counter-per-space-bumped-under-a-lock), [Tx conformance spike, the counter](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/spikes/tx-conformance.md#the-per-space-counter-on-postgresql-18).
