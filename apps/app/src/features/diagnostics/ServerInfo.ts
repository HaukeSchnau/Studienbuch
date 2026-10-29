import { System } from "@stu/api/System";
import * as Atom from "effect/reactivity/Atom";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRpc from "effect/reactivity/AtomRpc";

import { ApiProtocol } from "../../infra/api/ApiProtocol.ts";
import { AppLifecycle } from "../../infra/lifecycle/AppLifecycle.ts";

export * as ServerInfo from "./ServerInfo.ts";

class Client extends AtomRpc.Service<Client>()("ServerInfo.Client", {
  group: System.Rpcs,
  protocol: ApiProtocol.layer,
}) {}

// Whether the app is in the foreground and online. The web has no pull to refresh, so the server is
// asked again each time this changes, as when a tab comes back or the network returns.
const awake = Atom.map(AppLifecycle.state, (state) =>
  AsyncResult.isSuccess(state) ? state.value.foreground && state.value.online : false,
);

/** What the server says about itself. It asks again on return to the app; refresh it to ask now. */
export const info = Client.query("System.info", undefined).pipe(Atom.makeRefreshOnSignal(awake));
