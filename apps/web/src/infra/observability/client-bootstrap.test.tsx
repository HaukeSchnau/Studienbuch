import { describe, expect, it, vi } from "vite-plus/test";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ClientObservability } from "./client-bootstrap.tsx";

const sentry = vi.hoisted(() => ({
  gate: (() => {
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>((resume) => {
      resolve = resume;
    });
    return { promise, resolve };
  })(),
  loaded: (() => {
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>((resume) => {
      resolve = resume;
    });
    return { promise, resolve };
  })(),
  initialize: vi.fn(),
}));

const router = vi.hoisted(() => {
  type RouterEvent = {
    readonly pathChanged: boolean;
    readonly toLocation: { readonly pathname: string };
  };
  const callbacks = new Map<string, (event: RouterEvent) => void>();
  return {
    callbacks,
    subscribe: vi.fn((eventName: string, callback: (event: RouterEvent) => void) => {
      callbacks.set(eventName, callback);
      return vi.fn();
    }),
  };
});

const browser = vi.hoisted(() => ({
  enabled: false,
  recordCanary: vi.fn(),
  recordNavigation: vi.fn(),
  recordRender: vi.fn(),
  removeLifecycle: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ subscribe: router.subscribe }),
}));

vi.mock("./sentry-client.ts", async () => {
  await sentry.gate.promise;
  sentry.loaded.resolve();
  return { initializeSentryClient: sentry.initialize };
});

vi.mock("./browser-client.ts", () => ({
  browserTelemetry: () =>
    browser.enabled
      ? {
          recordCanary: browser.recordCanary,
          recordNavigation: browser.recordNavigation,
          recordRender: browser.recordRender,
        }
      : undefined,
  installBrowserTelemetryLifecycle: () => browser.removeLifecycle,
}));

describe("client observability bootstrap", () => {
  it("does not initialize Sentry after unmounting", async () => {
    const root = createRoot(document.createElement("div"));
    flushSync(() => {
      root.render(
        <ClientObservability
          config={{
            sentryDsn: "https://public@example.invalid/1",
            environment: "test",
            instanceId: undefined,
            version: "test",
          }}
        />,
      );
    });
    root.unmount();
    sentry.gate.resolve();
    await sentry.loaded.promise;
    await Promise.resolve();

    expect(sentry.initialize).not.toHaveBeenCalled();
  });

  it("measures the initial render from browser navigation start", async () => {
    browser.enabled = true;
    router.callbacks.clear();
    const navigationEntry: PerformanceEntry = {
      duration: 0,
      entryType: "navigation",
      name: "document",
      startTime: 25,
      toJSON: () => ({}),
    };
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([navigationEntry]);
    vi.spyOn(performance, "now").mockReturnValue(3_275);

    const root = createRoot(document.createElement("div"));
    flushSync(() => {
      root.render(
        <ClientObservability
          config={{
            sentryDsn: undefined,
            environment: "test",
            instanceId: undefined,
            version: "test",
          }}
        />,
      );
    });
    await vi.waitFor(() => expect(router.callbacks.get("onRendered")).toBeDefined());

    router.callbacks.get("onRendered")?.({
      pathChanged: false,
      toLocation: { pathname: "/app" },
    });

    expect(browser.recordRender).toHaveBeenCalledWith(3_250, "/app");
    root.unmount();
    browser.enabled = false;
    vi.restoreAllMocks();
  });
});
