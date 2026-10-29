import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Atom from "effect/reactivity/Atom";
import * as Stream from "effect/Stream";
import * as Network from "expo-network";
import { AppState } from "react-native";

// One implementation for all three platforms: React Native's AppState follows the app on iOS and
// Android and the tab's visibility in react-native-web, and expo-network follows the platform's
// network, which in a browser is `navigator.onLine` with its `online` and `offline` events.

export * as AppLifecycle from "./AppLifecycle.ts";

const foreground = (state: string | null | undefined) => state === "active";

// A network that Android hasn't probed yet reports no reachability, so a connection counts.
const online = (state: Network.NetworkState) =>
  state.isInternetReachable ?? state.isConnected ?? true;

const same = (a: Ports.LifecycleState, b: Ports.LifecycleState) =>
  a.foreground === b.foreground && a.online === b.online;

const changes = Stream.callback<Ports.LifecycleState>((queue) =>
  Effect.gen(function* () {
    let state: Ports.LifecycleState = {
      foreground: foreground(AppState.currentState),
      online: true,
    };

    const update = (next: Partial<Ports.LifecycleState>) => {
      state = { ...state, ...next };

      Queue.offerUnsafe(queue, state);
    };

    const app = AppState.addEventListener("change", (next) =>
      update({ foreground: foreground(next) }),
    );

    const network = Network.addNetworkStateListener((next) => update({ online: online(next) }));

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        app.remove();
        network.remove();
      }),
    );

    const initial = yield* Effect.promise(() => Network.getNetworkStateAsync());
    update({ online: online(initial) });
  }),
).pipe(Stream.changesWith(same));

/** `Ports.Lifecycle` from the app's state and the platform's network. */
export const layer = Layer.succeed(Ports.Lifecycle)({ changes });

/** The same states for screens: the latest one. */
export const state = Atom.make(changes).pipe(Atom.keepAlive);
