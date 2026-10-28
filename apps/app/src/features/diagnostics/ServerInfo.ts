import { System } from "@stu/api/System";
import * as AtomRpc from "effect/reactivity/AtomRpc";

import { ApiProtocol } from "../../infra/api/ApiProtocol.ts";

export * as ServerInfo from "./ServerInfo.ts";

class Client extends AtomRpc.Service<Client>()("ServerInfo.Client", {
  group: System.Rpcs,
  protocol: ApiProtocol.layer,
}) {}

/** What the server says about itself. Refresh it to ask again. */
export const info = Client.query("System.info", undefined);
