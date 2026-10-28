import { Api } from "@stu/api";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as RpcClient from "effect/rpc/RpcClient";
import * as Schema from "effect/Schema";
import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";

// The RPC protocol to the server, over HTTP. The web app calls its own origin, so one build serves
// every deployment. Native builds name their server in EXPO_PUBLIC_API_URL, set per EAS environment
// (AGENTS.md, "Baking in an origin").

export * as ApiProtocol from "./ApiProtocol.ts";

/** A native build without EXPO_PUBLIC_API_URL. */
export class NoServer extends Schema.TaggedError<NoServer, { readonly brand: unique symbol }>()(
  "ApiProtocol.NoServer",
  {},
) {}

// Expo inlines `process.env.EXPO_PUBLIC_*` only where the code names it literally.
const origin =
  Platform.OS === "web"
    ? Option.some("")
    : Option.fromNullishOr(process.env.EXPO_PUBLIC_API_URL).pipe(
        Option.map((url) => url.replace(/\/+$/u, "")),
        Option.filter((url) => url !== ""),
      );

/** The server's host, for people comparing builds. */
export const host: Option.Option<string> =
  Platform.OS === "web"
    ? Option.some(window.location.host)
    : Option.map(origin, (url) => url.replace(/^[a-z]+:\/\//u, "").replace(/\/.*$/u, ""));

// The server answers in NDJSON, which Effect reads as a stream. React Native's own fetch has no
// response streams; Expo's has, and on the web it is the browser's.
const streamingFetch: typeof globalThis.fetch = (input, init) => expoFetch(input, init);

export const layer = Layer.unwrap(
  Option.match(origin, {
    onNone: () => Effect.fail(new NoServer()),
    onSome: (url) => Effect.succeed(RpcClient.layerProtocolHttp({ url: `${url}${Api.path}` })),
  }),
).pipe(
  Layer.provide([
    FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(streamingFetch))),
    Api.serialization,
  ]),
);
