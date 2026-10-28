import { Api } from "@stu/api";
import { System } from "@stu/api/System";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as RpcClient from "effect/rpc/RpcClient";

// The `System` RPC group on the page's own origin.
export * as SystemClient from "./SystemClient.ts";

class Client extends AtomRpc.Service<Client>()("SystemClient", {
  group: System.Rpcs,
  protocol: RpcClient.layerProtocolHttp({ url: Api.path }).pipe(
    Layer.provide([FetchHttpClient.layer, Api.serialization]),
  ),
}) {}

/** What `System.info` returns. Prerendering never calls the server, so the HTML shows the waiting state. */
export const info = Client.query("System.info", undefined).pipe(Atom.withServerValueInitial);
