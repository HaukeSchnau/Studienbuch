import { Api } from "@stu/api";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as RpcClient from "effect/rpc/RpcClient";
import { streamingFetch } from "./fetch.ts";
import { ServerOrigin } from "./ServerOrigin.ts";

// The RPC protocol to the server, over HTTP.

export * as ApiProtocol from "./ApiProtocol.ts";

/** Effect's `HttpClient` on a fetch that streams responses on every platform. */
export const httpClient = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(streamingFetch)),
);

export const layer = Layer.unwrap(
  Option.match(ServerOrigin.origin, {
    onNone: () => Effect.fail(new ServerOrigin.NoServer()),
    onSome: (url) =>
      Effect.succeed(RpcClient.layerProtocolHttp({ url: `${url.origin}${Api.path}` })),
  }),
).pipe(Layer.provide([httpClient, Api.serialization]));
