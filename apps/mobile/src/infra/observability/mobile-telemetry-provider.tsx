import Constants from "expo-constants";
import * as Network from "expo-network";
import { AppState, Platform } from "react-native";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from "react";
import {
  TelemetryOutbox,
  TelemetryStorage,
  clientMetricNames,
  telemetryOutboxLayer,
  type ClientTelemetryRecord,
  type screenNames,
  type TelemetryPriority,
} from "@stu/observability/browser";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { runTelemetryController, TelemetryConnectivity, TelemetryLifecycle } from "./controller";
import { makeTelemetryFileStorage } from "./file-storage";
import { mobileApiBaseUrl } from "~/infra/better-auth/client";
import { telemetryTransportLayer, type TelemetrySessionCookie } from "./transport";

type ScreenName = (typeof screenNames)[number];

interface MobileTelemetry {
  readonly record: (
    record: ClientTelemetryRecord,
    priority?: TelemetryPriority,
  ) => Promise<boolean>;
  readonly recordNavigation: (screen: ScreenName) => void;
  readonly recordRender: (durationMillis: number, screen: ScreenName) => void;
}

const disabledTelemetry: MobileTelemetry = {
  record: async () => false,
  recordNavigation: () => undefined,
  recordRender: () => undefined,
};
const MobileTelemetryContext = createContext<MobileTelemetry>(disabledTelemetry);

export interface MobileTelemetryProviderProps extends PropsWithChildren {
  /** Must return the current user-scoped Better Auth cookie for each delivery attempt. */
  readonly sessionCookie?: TelemetrySessionCookie;
}

const configuredEndpoint = process.env.EXPO_PUBLIC_TELEMETRY_ENDPOINT?.trim();
const endpoint = (() => {
  if (configuredEndpoint && configuredEndpoint.length > 0) return configuredEndpoint;
  if (mobileApiBaseUrl === undefined) return undefined;
  try {
    return new URL("/api/observability/v1/telemetry", mobileApiBaseUrl).href;
  } catch {
    return undefined;
  }
})();
const isAllowedEndpoint = (value: string | undefined): value is string => {
  if (value === undefined || value.length === 0) return false;
  try {
    const url = new URL(value);
    return (
      url.pathname === "/api/observability/v1/telemetry" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      (__DEV__ || url.protocol === "https:")
    );
  } catch {
    return false;
  }
};

export function MobileTelemetryProvider({ sessionCookie, children }: MobileTelemetryProviderProps) {
  const runtime = useRef<ReturnType<typeof makeTelemetryRuntime> | undefined>(undefined);

  useEffect(() => {
    // Never fall back to a public/static credential. Delivery fails closed until Better Auth owns
    // an authenticated session; the bounded queue may still retain useful pre-session startup data.
    if (!isAllowedEndpoint(endpoint) || sessionCookie === undefined) return;
    const activeRuntime = makeTelemetryRuntime(endpoint, sessionCookie);
    runtime.current = activeRuntime;
    enqueueCanary(activeRuntime);
    void activeRuntime.runPromise(runTelemetryController()).catch(() => undefined);
    return () => {
      if (runtime.current === activeRuntime) runtime.current = undefined;
      void activeRuntime.dispose();
    };
  }, [sessionCookie]);

  const value = useMemo<MobileTelemetry>(
    () =>
      ({
        record: (record, priority) => {
          const activeRuntime = runtime.current;
          return activeRuntime === undefined
            ? Promise.resolve(false)
            : activeRuntime.runPromise(
                Effect.flatMap(TelemetryOutbox, (outbox) => outbox.enqueue(record, priority)),
              );
        },
        recordNavigation: (screen) =>
          enqueueTimedSpan(runtime.current, "client.navigation", "navigation", 0, screen),
        recordRender: (durationMillis, screen) =>
          enqueueTimedSpan(runtime.current, "client.render", "render", durationMillis, screen),
      }) satisfies MobileTelemetry,
    [],
  );
  return <MobileTelemetryContext value={value}>{children}</MobileTelemetryContext>;
}

export const useMobileTelemetry = (): MobileTelemetry => useContext(MobileTelemetryContext);

const appLifecycle = TelemetryLifecycle.of({
  isActive: Effect.sync(() => AppState.currentState === "active"),
  whenActive: Effect.callback<void>((resume) => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") resume(Effect.void);
    });
    return Effect.sync(() => subscription.remove());
  }),
});

const connectivity = TelemetryConnectivity.of({
  isOnline: Effect.tryPromise(() => Network.getNetworkStateAsync()).pipe(
    Effect.map((state) => state.isInternetReachable ?? state.isConnected ?? true),
    Effect.orElseSucceed(() => true),
  ),
  whenOnline: Effect.callback<void>((resume) => {
    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isInternetReachable ?? state.isConnected ?? false) resume(Effect.void);
    });
    return Effect.sync(() => subscription.remove());
  }),
});

function makeTelemetryRuntime(endpoint: string, sessionCookie: TelemetrySessionCookie) {
  return ManagedRuntime.make(
    telemetryOutboxLayer({
      serviceName: "studienbuch-mobile",
      serviceVersion: Constants.expoConfig?.version ?? "unknown",
      environment: __DEV__ ? "development" : "production",
      platform: Platform.OS === "android" ? "android" : Platform.OS === "web" ? "web" : "ios",
    }).pipe(
      Layer.provide([
        Layer.succeed(TelemetryStorage, makeTelemetryFileStorage()),
        telemetryTransportLayer({ endpoint, sessionCookie }),
      ]),
      Layer.provideMerge(
        Layer.mergeAll(
          Layer.succeed(TelemetryLifecycle, appLifecycle),
          Layer.succeed(TelemetryConnectivity, connectivity),
        ),
      ),
    ),
  );
}

function randomHex(byteLength: number): string {
  return Array.from({ length: byteLength * 2 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}

function enqueueCanary(runtime: ReturnType<typeof makeTelemetryRuntime>) {
  const recordedAtUnixMillis = Date.now();
  void runtime.runPromise(
    Effect.flatMap(TelemetryOutbox, (outbox) =>
      Effect.all([
        outbox.enqueue(
          {
            type: "log",
            event: "client.telemetry.canary",
            severity: "info",
            occurredAtUnixMillis: recordedAtUnixMillis,
            attributes: { "telemetry.priority": "low" },
          },
          "low",
        ),
        outbox.enqueue(
          {
            type: "metric",
            name: clientMetricNames.canaryTotal,
            kind: "counter",
            value: 1,
            recordedAtUnixMillis,
            attributes: {
              platform:
                Platform.OS === "android" ? "android" : Platform.OS === "web" ? "web" : "ios",
              signal: "all",
            },
          },
          "low",
        ),
      ]).pipe(Effect.asVoid),
    ),
  );
}

function enqueueTimedSpan(
  runtime: ReturnType<typeof makeTelemetryRuntime> | undefined,
  name: "client.navigation" | "client.render",
  operation: "navigation" | "render",
  durationMillis: number,
  screen: ScreenName,
) {
  if (runtime === undefined) return;
  const endedAt = Date.now();
  void runtime.runPromise(
    Effect.flatMap(TelemetryOutbox, (outbox) =>
      outbox.enqueue(
        {
          type: "span",
          name,
          traceId: randomHex(16),
          spanId: randomHex(8),
          startedAtUnixMillis: Math.max(0, endedAt - durationMillis),
          durationMillis: Math.max(0, durationMillis),
          status: "ok",
          attributes: {
            "app.operation": operation,
            "screen.name": screen,
            outcome: "success",
            "telemetry.priority": "normal",
          },
        },
        "normal",
      ),
    ),
  );
}
