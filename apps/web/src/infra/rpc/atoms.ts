import { Rpcs } from "@stu/api";
import { AtomRpc } from "effect/unstable/reactivity";
import { browserRpcProtocol } from "./protocol.ts";

/** The browser's single RPC runtime, so every feature shares one reactivity graph. */
export const WebRpc = AtomRpc.Service()("@stu/web/infra/rpc/WebRpc", {
  group: Rpcs,
  protocol: browserRpcProtocol,
});
