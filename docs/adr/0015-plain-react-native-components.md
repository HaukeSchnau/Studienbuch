# Plain React Native components

Status: accepted 2026-10-28 ([D30](https://files.schnau.dev/html/studienbuch-roadmap/#D30))

App UI uses React Native core components, `StyleSheet` and typed design tokens from `packages/ui`, with no styling library. The landing page renders the same components through react-native-web in TanStack Start, server-rendered and right in light and dark without JavaScript. Components the app and the landing page share take rows and callbacks as props and never read SQLite or the sync engine.

The landing page then shows the code the phone runs, without a styling runtime or compiler on the phone. It costs 28 KB gzip on a 109 KB page, and a misspelled token fails the type check where a misspelled class renders nothing. NativeWind 5, Tamagui, Uniwind and Unistyles all worked and cost more. react-strict-dom gave the best web output (3.8 KB) but is at 0.0.55 with an untried native renderer, so it is the one to revisit.

Reasoning: [client-platform.md, UI sharing](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/client-platform.md#recommendation-for-ui-sharing).
