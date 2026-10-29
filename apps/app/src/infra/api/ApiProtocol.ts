import { Api } from "@stu/api";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as Redacted from "effect/Redacted";
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

/**
 * The RPC protocol as a signed-in device, to `Ports.Server`: each request carries the bearer token
 * `token` answers at that moment, so a new sign-in takes effect at once. None when it has none.
 */
export const authenticated = (token: Effect.Effect<Option.Option<Redacted.Redacted>>) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const server = yield* Ports.Server;
      const http = yield* HttpClient.HttpClient;

      const client = HttpClient.mapRequestEffect(http, (request) =>
        Effect.map(
          token,
          Option.match({
            onNone: () => request,
            onSome: (bearer) => HttpClientRequest.bearerToken(request, bearer),
          }),
        ),
      );

      return RpcClient.layerProtocolHttp({ url: `${server.origin.origin}${Api.path}` }).pipe(
        Layer.provide(Layer.succeed(HttpClient.HttpClient)(client)),
      );
    }),
  ).pipe(Layer.provide(Api.serialization));
