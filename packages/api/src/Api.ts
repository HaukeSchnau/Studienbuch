import * as RpcSerialization from "effect/rpc/RpcSerialization";
import { Demo } from "./Demo.ts";
import { Dev } from "./Dev.ts";
import { Mail } from "./Mail.ts";
import { System } from "./System.ts";

/** Clients post RPC requests here, on the server's own origin (or `EXPO_PUBLIC_API_URL` on native). */
export const path = "/api/rpc";

/** Every RPC group the server serves at `path`. */
export const Rpcs = System.Rpcs.merge(Mail.Rpcs, Dev.Rpcs, Demo.Rpcs);

/** The wire format of `path`. Client and server provide this same layer. */
export const serialization = RpcSerialization.layerNdjson;

export * as Api from "./Api.ts";
