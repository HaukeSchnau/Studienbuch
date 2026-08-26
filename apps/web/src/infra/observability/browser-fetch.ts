export type BrowserFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const browserFetchKey = Symbol.for("@stu/web/browser-telemetry-fetch");
const browserGlobal = globalThis as typeof globalThis & {
  [browserFetchKey]?: BrowserFetch;
};

/**
 * Routes callers through browser telemetry once it has loaded, while keeping telemetry itself out
 * of the initial auth bundle. Better Auth calls this function at request time, so initializing the
 * telemetry client after the auth client is created still takes effect.
 */
export const fetchWithBrowserTelemetry: BrowserFetch = (input, init) =>
  (browserGlobal[browserFetchKey] ?? globalThis.fetch)(input, init);

export function installBrowserTelemetryFetch(fetch: BrowserFetch): () => void {
  const previous = browserGlobal[browserFetchKey];
  browserGlobal[browserFetchKey] = fetch;
  return () => {
    if (browserGlobal[browserFetchKey] !== fetch) return;
    if (previous === undefined) {
      delete browserGlobal[browserFetchKey];
    } else {
      browserGlobal[browserFetchKey] = previous;
    }
  };
}
