import { Api } from "@stu/api";
import { Inspect } from "@stu/sync";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as Redacted from "effect/Redacted";
import * as RpcClient from "effect/rpc/RpcClient";

// The Lab's calls to the server outside the engine: the app's RPC group for `System.info` and
// `Demo.signIn`, and `Sync.inspect` for the server panel, which answers only development and
// preview servers, and only to a bearer session.

export * as LabServer from "./LabServer.ts";

const protocol = (path: string, token: Option.Option<Redacted.Redacted>) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const server = yield* Ports.Server;
      const http = yield* HttpClient.HttpClient;

      const client = Option.match(token, {
        onNone: () => http,
        onSome: (bearer) => HttpClient.mapRequest(http, HttpClientRequest.bearerToken(bearer)),
      });

      return RpcClient.layerProtocolHttp({ url: `${server.origin.origin}${path}` }).pipe(
        Layer.provide(Layer.succeed(HttpClient.HttpClient)(client)),
      );
    }),
  );

/** The app's RPC group, as `token`'s account when given. Its scope ends the client. */
export const api = (token: Option.Option<Redacted.Redacted>) =>
  RpcClient.make(Api.Rpcs).pipe(
    Effect.provide(protocol(Api.path, token).pipe(Layer.provide(Api.serialization))),
  );

/** What the server holds of `request`'s spaces and clients, asked with any session. */
export const inspect = (token: Redacted.Redacted, request: Inspect.Request) =>
  Effect.scoped(
    Effect.flatMap(
      RpcClient.make(Inspect.Rpcs).pipe(
        Effect.provide(
          protocol(Inspect.path, Option.some(token)).pipe(Layer.provide(Inspect.serialization)),
        ),
      ),
      (client) => client["Sync.inspect"](request),
    ),
  );
