# Fleet.Service instead of the Project SDK

Status: accepted 2026-10-28 ([D31](https://files.schnau.dev/html/studienbuch-roadmap/#D31))

Studienbuch leaves infra's Project SDK. Releases go through `Fleet.Service`, an Alchemy resource in `@schnau/fleet` that hands a service spec to a controller on the host, which realizes it, runs `prepare`, gates on health and rolls back. Development is plain devenv on localhost, one instance per worktree. Hauke looks at PR previews and beta, not at dev servers.

The SDK described the environment once for the fleet and would need a second description for any other host, and it had no previews per PR. Dropping it loses Tailnet URLs and wake-on-request for dev instances. `agent-service publish` covers the rare case where someone needs a dev server from another device. Infra's other projects keep the SDK.

Reasoning: [hosting.md, section 3](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/hosting.md#3-the-project-sdk-keep-thin-or-drop).
