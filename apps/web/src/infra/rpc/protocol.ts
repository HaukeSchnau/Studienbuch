import { rpcPath } from "@stu/api/access";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

/** The one browser transport for every first-party RPC group. */
export const browserRpcProtocol = RpcClient.layerProtocolHttp({ url: rpcPath }).pipe(
  Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
);
