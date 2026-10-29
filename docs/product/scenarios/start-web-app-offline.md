# Start the web app offline

Status: accepted
Platforms: Web
Confidence: established

## Rule

Once a browser has opened the web app online, it opens again without network, from `/app`,
`/app/`, a deep link or a new `?device=`, and shows the data it keeps locally. A tab still running
the release before a deploy keeps loading the rest of that release.

## Example

Given a browser opened `/app/` online and its device stored data
When the network is gone and the browser starts again at `/app`
Then the app shows the same data and says the server can't be reached
And `/app/<a deep link>` and `/app/?device=<a name it never used>` open as well, the latter empty

Given a tab runs release A and the server deploys release B
When that tab moves to a screen it hasn't loaded yet
Then the screen loads from release A, and the next start shows release B

## Evidence contract

| Outcome                               | Executable evidence                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/app` reaches the app                | `/app` answers 308 to `/app/`, which the service worker controls                          |
| Offline start keeps the data          | After a new browser process starts offline at `/app/`, the stored data is on screen       |
| Offline deep link                     | `/app/<route>` opens that screen offline                                                  |
| Offline new device                    | `/app/?device=<new>` opens offline with an empty device, and the earlier device is intact |
| Older tab across a deploy             | After a deploy, the old tab opens a route it hadn't loaded, with no failed chunk request  |
| Online starts get the current release | With the network up, a start after a deploy runs release B                                |

## State

Initial state: A browser profile that opened `/app/` online once, with data on its device
Final state: The same data, now shown offline, and release B after the next online start
Side effects: Two releases deployed in one run for the deploy case; offline through the browser context

## Sources

- `apps/app/public/sw.js`
- `apps/server/src/routes/WebBuilds.ts`
- `roadmap/design/spikes/app-platform.md` (M1-WP-10)
