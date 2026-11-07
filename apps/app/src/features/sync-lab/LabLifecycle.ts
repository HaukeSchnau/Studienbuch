import { Ports } from "@stu/sync/client";
import type { Faults } from "@stu/sync/lab";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

// A Lab device's platform, which its "Offline" toggle drives instead of the browser's network, so
// one tab holds an offline device next to online ones. The toggle also drops the device's sockets
// (`Faults.setOffline`), as a lost network would.

export * as LabLifecycle from "./LabLifecycle.ts";

/** `Ports.Lifecycle` for one Lab device: always on screen, online while its faults say so. */
export const layer = (faults: Faults.Faults) =>
  Layer.succeed(Ports.Lifecycle)({
    changes: SubscriptionRef.changes(faults.settings).pipe(
      Stream.map((settings) => settings.offline),
      Stream.changes,
      Stream.map((offline): Ports.LifecycleState => ({ foreground: true, online: !offline })),
    ),
  });
