import { Api } from "@stu/api";
import { Mail } from "@stu/api/Mail";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as RpcClient from "effect/rpc/RpcClient";

// The `Mail` RPC group on the page's own origin.
export * as MailClient from "./MailClient.ts";

class Client extends AtomRpc.Service<Client>()("MailClient", {
  group: Mail.Rpcs,
  protocol: RpcClient.layerProtocolHttp({ url: Api.path }).pipe(
    Layer.provide([FetchHttpClient.layer, Api.serialization]),
  ),
}) {}

/** The newest captured mail. Refresh it to ask again. */
export const captured = Client.query("Mail.captured", undefined);
