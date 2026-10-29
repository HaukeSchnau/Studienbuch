/** The browser's fetch, which streams responses. */
export const streamingFetch: typeof globalThis.fetch = (input, init) => fetch(input, init);
