import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Headers from "effect/http/Headers";
import * as HttpBody from "effect/http/HttpBody";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Socket from "effect/socket/Socket";

/** The dev servers that devenv runs beside this one: Vite for `apps/web`, Metro for `apps/app`. */
export interface Origins {
  readonly web: string;
  readonly app: string;
}

// Metro serves `/app` and, at the root, bundles named after their entry file in the workspace
// (`/apps/app/index.ts.bundle`), assets, and the sockets of hot reload and the dev tools. Vite takes
// every other path.
const metroPath =
  /^\/(app(\/|$)|hot$|message$|events$|symbolicate$|status$|assets\/|_expo\/|\.expo\/)|\.(bundle|map)$/;

// Headers about one hop: Node sets its own on each side.
const hopByHop = ["connection", "keep-alive", "transfer-encoding", "upgrade", "host"];

const http = Effect.fn("DevServers.http")(function* (
  request: HttpServerRequest.HttpServerRequest,
  target: string,
) {
  const client = yield* HttpClient.HttpClient;
  const contentType = request.headers["content-type"];

  const response = yield* client.execute(
    HttpClientRequest.make(request.method)(target, {
      // Fetch would decode a compressed body and leave its encoding and length behind.
      headers: Headers.set(
        Headers.removeMany(request.headers, hopByHop),
        "accept-encoding",
        "identity",
      ),
      body:
        request.method === "GET" || request.method === "HEAD"
          ? HttpBody.empty
          : HttpBody.stream(request.stream, contentType),
    }),
  );

  return HttpServerResponse.fromClientResponse(response).pipe(
    HttpServerResponse.removeHeader("transfer-encoding"),
    HttpServerResponse.removeHeader("connection"),
    HttpServerResponse.removeHeader("keep-alive"),
  );
});

const forward = (from: Socket.Reader, to: Socket.Writer) =>
  Effect.forever(Effect.flatMap(from.pull, to.writeAll));

// Hot reload in both dev servers runs over a WebSocket on the page's origin. Each frame is passed on
// as text or binary, as it came.
const webSocket = Effect.fn("DevServers.webSocket")(function* (
  request: HttpServerRequest.HttpServerRequest,
  target: string,
) {
  const protocols = request.headers["sec-websocket-protocol"]?.split(",").map((p) => p.trim());
  const upstream = yield* Socket.makeWebSocket(target.replace(/^http/, "ws"), { protocols });
  const fromUpstream = yield* upstream.reader;
  const toUpstream = yield* upstream.writer;

  const downstream = yield* request.upgrade;
  const fromDownstream = yield* downstream.reader;
  const toDownstream = yield* downstream.writer;

  yield* Effect.raceFirst(
    forward(fromDownstream, toUpstream),
    forward(fromUpstream, toDownstream),
  ).pipe(Effect.ignore);

  return HttpServerResponse.empty();
}, Effect.scoped);

/**
 * In development, serves every path that isn't the server's own from Vite or Metro, so the browser
 * sees one origin as it does in a release, where `WebBuilds` serves their builds.
 */
export const layer = (origins: Origins) =>
  HttpRouter.use(
    Effect.fnUntraced(function* (router) {
      const clients = yield* Effect.context<HttpClient.HttpClient | Socket.WebSocketConstructor>();

      yield* router.add(
        "*",
        "/*",
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const [path = "/"] = request.url.split("?");
          const target = (metroPath.test(path) ? origins.app : origins.web) + request.url;

          if (request.headers.upgrade?.toLowerCase() === "websocket") {
            return yield* webSocket(request, target);
          }

          return yield* http(request, target);
        }).pipe(
          // Vite and Metro start beside the server and may not listen yet.
          Effect.catch((error) =>
            Effect.succeed(HttpServerResponse.text(error.message, { status: 502 })),
          ),
          Effect.provideContext(clients),
        ),
      );
    }),
  ).pipe(Layer.provide([FetchHttpClient.layer, Socket.layerWebSocketConstructorGlobal]));

export * as DevServers from "./DevServers.ts";
