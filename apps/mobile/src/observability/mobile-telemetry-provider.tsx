import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from "react";
import type { ClientTelemetryRecordType } from "@stu/observability/browser";
import { startTelemetryController } from "./controller";
import { makeTelemetryFileStorage } from "./file-storage";
import { TelemetryOutbox, type TelemetryPriority } from "./outbox";
import { makeFetchTelemetryTransport, type TelemetryAuthorization } from "./transport";

interface MobileTelemetry {
  readonly record: (
    record: ClientTelemetryRecordType,
    priority?: TelemetryPriority,
  ) => Promise<void>;
}

const disabledTelemetry: MobileTelemetry = { record: async () => undefined };
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
  const outbox = useMemo(() => {
    // Never fall back to a public/static credential. Until the app owns an
    // authenticated session authority, the first-party channel stays off.
    if (!isAllowedEndpoint(endpoint) || authorization === undefined) {
      return undefined;
    }
    return new TelemetryOutbox({
      storage: makeTelemetryFileStorage(),
      transport: makeFetchTelemetryTransport({ endpoint, authorization }),
      clock: { now: Date.now },
      random: { next: Math.random },
      serviceVersion: Constants.expoConfig?.version ?? "unknown",
      environment: __DEV__ ? "development" : "production",
      platform: Platform.OS === "android" ? "android" : Platform.OS === "web" ? "web" : "ios",
    });
  }, [authorization]);

  useEffect(() => {
    if (outbox === undefined) return;
    return startTelemetryController({
      outbox,
      lifecycle: {
        isActive: () => AppState.currentState === "active",
        subscribe: (onActive) => {
          const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") onActive();
          });
          return () => subscription.remove();
        },
      },
      connectivity: {
        // Native has no already-pinned reachability module. Failed sends remain
        // durable and back off; foregrounding and the timer provide recovery.
        isOnline: () =>
          typeof globalThis.navigator?.onLine === "boolean" ? globalThis.navigator.onLine : true,
        subscribe: (onOnline) => {
          if (Platform.OS !== "web") return () => undefined;
          globalThis.addEventListener?.("online", onOnline);
          return () => globalThis.removeEventListener?.("online", onOnline);
        },
      },
      scheduler: {
        every: (milliseconds, task) => {
          const timer = setInterval(task, milliseconds);
          return () => clearInterval(timer);
        },
      },
    });
  }, [outbox]);

  const value = useMemo<MobileTelemetry>(
    () =>
      outbox === undefined
        ? disabledTelemetry
        : { record: (record, priority) => outbox.enqueue(record, priority) },
    [outbox],
  );
  return <MobileTelemetryContext value={value}>{children}</MobileTelemetryContext>;
}

export const useMobileTelemetry = (): MobileTelemetry => useContext(MobileTelemetryContext);
