import { fetch as expoFetch } from "expo/fetch";

// The server answers in NDJSON, which Effect reads as a stream. React Native's own fetch has no
// response streams; Expo's has. `fetch.web.ts` is the browser's, which has them already.

export const streamingFetch: typeof globalThis.fetch = (input, init) => expoFetch(input, init);
