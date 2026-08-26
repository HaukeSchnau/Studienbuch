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

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ subscribe: vi.fn(() => vi.fn()) }),
}));

vi.mock("./sentry-client.ts", async () => {
  await sentry.gate.promise;
  sentry.loaded.resolve();
  return { initializeSentryClient: sentry.initialize };
});

vi.mock("./browser-client.ts", () => ({
  browserTelemetry: () => undefined,
  installBrowserTelemetryLifecycle: vi.fn(),
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
});
