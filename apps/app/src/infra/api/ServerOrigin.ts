import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Platform } from "react-native";

// Where the server is. The web app calls its own origin, so one build serves every deployment.
// Native builds name their server in EXPO_PUBLIC_API_URL, set per EAS environment (AGENTS.md,
// "Baking in an origin").

export * as ServerOrigin from "./ServerOrigin.ts";

/** A native build without EXPO_PUBLIC_API_URL, or with one that isn't a URL. */
export class NoServer extends Schema.TaggedError<NoServer, { readonly brand: unique symbol }>()(
  "ServerOrigin.NoServer",
  {},
) {}

// React Native's URL parses with regular expressions and has no `URL.canParse`, so the origin is
// matched here before it becomes a URL.
const originOf = (url: string) =>
  Option.map(
    Option.fromNullishOr(/^https?:\/\/[^/?#]+/u.exec(url)?.[0]),
    (match) => new URL(match),
  );

// Expo inlines `process.env.EXPO_PUBLIC_*` only where the code names it literally.
/** The server's origin, which also names where this device keeps an account's data. */
export const origin: Option.Option<URL> =
  Platform.OS === "web"
    ? Option.some(new URL(window.location.origin))
    : Option.flatMap(Option.fromNullishOr(process.env.EXPO_PUBLIC_API_URL), originOf);

/** The server's host, for people comparing builds. */
export const host: Option.Option<string> = Option.map(origin, (url) => url.host);

/** `Ports.Server` for the engine. */
export const layer = Layer.effect(Ports.Server)(
  Option.match(origin, {
    onNone: () => Effect.fail(new NoServer()),
    onSome: (url) => Effect.succeed({ origin: url }),
  }),
);
