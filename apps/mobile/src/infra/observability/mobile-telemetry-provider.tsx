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
  TelemetryDelivery,
  TelemetryOutbox,
  TelemetryStorage,
  telemetryOutboxLayer,
  type ClientTelemetryRecord,
  type TelemetryPriority,
} from "@stu/observability/browser";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { runTelemetryController, TelemetryConnectivity, TelemetryLifecycle } from "./controller";
import { makeTelemetryFileStorage } from "./file-storage";
import { makeFetchTelemetryTransport, type TelemetryAuthorization } from "./transport";

interface MobileTelemetry {
  readonly record: (
    record: ClientTelemetryRecord,
    priority?: TelemetryPriority,
  ) => Promise<boolean>;
}

const disabledTelemetry: MobileTelemetry = { record: async () => false };
const MobileTelemetryContext = createContext<MobileTelemetry>(disabledTelemetry);

export interface MobileTelemetryProviderProps extends PropsWithChildren {
  /** Must return a short-lived, user-scoped Authorization header value. */
  readonly authorization?: TelemetryAuthorization;
}

const endpoint = process.env.EXPO_PUBLIC_TELEMETRY_ENDPOINT?.trim();
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

export function MobileTelemetryProvider({ authorization, children }: MobileTelemetryProviderProps) {
  const runtime = useRef<ReturnType<typeof makeTelemetryRuntime> | undefined>(undefined);

  useEffect(() => {
    // Never fall back to a public/static credential. Until the app owns an
    // authenticated session authority, the first-party channel stays off.
    if (!isAllowedEndpoint(endpoint) || authorization === undefined) return;
    const activeRuntime = makeTelemetryRuntime(endpoint, authorization);
    runtime.current = activeRuntime;
    void activeRuntime.runPromise(runTelemetryController()).catch(() => undefined);
    return () => {
      if (runtime.current === activeRuntime) runtime.current = undefined;
      void activeRuntime.dispose();
    };
  }, [authorization]);

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

function makeTelemetryRuntime(endpoint: string, authorization: TelemetryAuthorization) {
  return ManagedRuntime.make(
    telemetryOutboxLayer({
      serviceName: "studienbuch-mobile",
      serviceVersion: Constants.expoConfig?.version ?? "unknown",
      environment: __DEV__ ? "development" : "production",
      platform: Platform.OS === "android" ? "android" : Platform.OS === "web" ? "web" : "ios",
    }).pipe(
      Layer.provide([
        Layer.succeed(TelemetryStorage, makeTelemetryFileStorage()),
        Layer.succeed(TelemetryDelivery, makeFetchTelemetryTransport({ endpoint, authorization })),
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
