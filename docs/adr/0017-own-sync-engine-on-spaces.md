# Own sync engine on spaces

Status: accepted 2026-10-29 ([D1](https://files.schnau.dev/html/studienbuch-roadmap/#D1))

Studienbuch syncs through its own engine in `packages/sync`. Every synced row lives in exactly one space: a student's notebook, a school, a course, later a chat or a family. Membership in a space is the only read rule, and a role per space decides who may write which tables. Devices push commands and the server sends back rows. A device keeps the server's rows apart from the effect of its pending commands, so a refused command disappears from the screen and its reason stays.

The product needs weeks offline, a refusal per command from the server, end-to-end encrypted spaces and roles per space. Replicache and Zero expire long offline writes or disable a client on a schema change, LiveStore rebases events rather than replaying commands, and Effect's EventLog rejects whole batches and never rolls a client back. Their protocols are the model and their code doesn't fit. Messaging, sharing and teacher confirmation then become new space kinds rather than a new engine. PowerSync stays the fallback if the engine stalls.

Reasoning: [sync.md, the design on one page](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/sync.md#the-design-on-one-page), [sync.md, extensibility](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/sync.md#8-extensibility-walkthrough).
