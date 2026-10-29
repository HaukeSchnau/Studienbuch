import * as NodeHttpPlatform from "@effect/platform-node/NodeHttpPlatform";
import * as Effect from "effect/Effect";
import * as Hash from "effect/Hash";
import * as Etag from "effect/http/Etag";
import * as Headers from "effect/http/Headers";
import * as HttpPlatform from "effect/http/HttpPlatform";
import * as HttpRouter from "effect/http/HttpRouter";
import type * as HttpServerError from "effect/http/HttpServerError";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as HttpStaticServer from "effect/http/HttpStaticServer";
import * as Path from "effect/Path";
import { Deployment } from "../infra/config/Deployment.ts";

/** Where the two web builds live: `apps/web`'s static output and `apps/app`'s Expo web export. */
export interface Roots {
  readonly web: string;
  readonly app: string;
}

// Content-hashed file names, so a cached copy never goes stale.
const immutable = "public, max-age=31536000, immutable";
const revalidate = "no-cache";

// The app's own files and its server only. RNW and Expo write inline styles, and the database's
// wasm needs `wasm-unsafe-eval`. A script injected into the page could still use the browser's
// keys (IndexedDbKeychain.ts), so this is what keeps the notebook's plaintext on the device.
const appPolicy = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const withAppPolicy = <E, R>(serve: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
  Effect.map(serve, HttpServerResponse.setHeader("content-security-policy", appPolicy));

const isNotFound = (error: HttpServerError.HttpServerError) =>
  error.reason._tag === "RouteNotFound";

// A release's files may all carry the same size and mtime as the last release's (the Nix store dates
// every file 1970), so ETags from those alone let a browser keep an old `index.html` whose chunks are
// gone. The release's revision and the directory it serves from tell releases apart.
const releaseEtags = (metadata: Etag.Generator["Service"], revision: string, root: string) => {
  const release = (Hash.string(`${revision}\0${root}`) >>> 0).toString(16);
  const prefixed = (etag: Etag.Etag) => ({ ...etag, value: `${release}-${etag.value}` });

  return Etag.Generator.of({
    fromFileInfo: (info) => Effect.map(metadata.fromFileInfo(info), prefixed),
    fromFileWeb: (file) => Effect.map(metadata.fromFileWeb(file), prefixed),
  });
};

// For the same reason, revalidated files answer by ETag only, never by date.
const withoutDates = Effect.fn("WebBuilds.withoutDates")(function* <E, R>(
  serve: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const headers = Headers.removeMany(request.headers, ["if-modified-since", "if-unmodified-since"]);

  const response = yield* Effect.provideService(
    serve,
    HttpServerRequest.HttpServerRequest,
    request.modify({ headers }),
  );

  return HttpServerResponse.removeHeader(response, "last-modified");
});

/**
 * Serves both web builds from one origin, with no COOP or COEP headers (ADR 0014, D29): the Expo
 * web export under `/app/*` (unknown routes get `index.html`), the console SPA's `_shell.html`
 * under `/console/*`, and the prerendered pages elsewhere, where `/impressum` is `impressum.html`
 * or `impressum/index.html`, whichever the build wrote.
 */
export const layer = (roots: Roots) =>
  HttpRouter.use(
    Effect.fnUntraced(function* (router) {
      const path = yield* Path.Path;
      const { revision } = yield* Deployment.Current;
      const metadata = yield* Etag.Generator;

      const handler = (options: Parameters<typeof HttpStaticServer.make>[0]) =>
        NodeHttpPlatform.make.pipe(
          Effect.provideService(Etag.Generator, releaseEtags(metadata, revision, options.root)),
          Effect.flatMap((platform) =>
            Effect.provideService(
              HttpStaticServer.make(options),
              HttpPlatform.HttpPlatform,
              platform,
            ),
          ),
          Effect.map((serve) =>
            options.cacheControl === revalidate ? withoutDates(serve) : serve,
          ),
        );

      const files = (options: Parameters<typeof HttpStaticServer.make>[0]) =>
        Effect.map(handler(options), (serve) =>
          Effect.catch(serve, HttpServerRespondable.toResponse),
        );

      const app = router.prefixed("/app");
      const appAssets = withAppPolicy(yield* files({ root: roots.app, cacheControl: immutable }));
      yield* app.add("GET", "/_expo/static/*", appAssets);
      yield* app.add("GET", "/assets/*", appAssets);

      const appPages = withAppPolicy(
        yield* files({ root: roots.app, spa: true, cacheControl: revalidate }),
      );

      // A link to /app moves to /app/ for good, query and all. The service worker may also answer
      // /app itself, so it starts offline from there too, which its file under /app/ alone can't.
      yield* app.add(
        "GET",
        "/*",
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          // Absolute behind a prefixed router; the base only parses a relative one.
          const { pathname, search } = new URL(request.originalUrl, "http://localhost");

          if (pathname === "/app/sw.js") {
            return yield* Effect.map(
              appPages,
              HttpServerResponse.setHeader("service-worker-allowed", "/app"),
            );
          }

          if (pathname !== "/app") return yield* appPages;

          return HttpServerResponse.redirect(`/app/${search}`, {
            status: 308,
            headers: { "cache-control": "public, max-age=31536000" },
          });
        }),
      );

      const consoleShell = {
        root: roots.web,
        index: "_shell.html",
        spa: true,
        cacheControl: revalidate,
      };

      yield* router.add("GET", "/console/*", yield* files(consoleShell));
      yield* router.add(
        "GET",
        "/assets/*",
        yield* files({ root: roots.web, cacheControl: immutable }),
      );

      const page = yield* handler({ root: roots.web, cacheControl: revalidate });
      yield* router.add(
        "GET",
        "/*",
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const [pathname = "/", ...query] = request.url.split("?");
          const search = query.length > 0 ? `?${query.join("?")}` : "";

          const [first = pathname, ...rest] =
            path.extname(pathname) !== ""
              ? [pathname]
              : pathname.endsWith("/")
                ? [`${pathname}index.html`]
                : [`${pathname}.html`, `${pathname}/index.html`];

          const serve = (candidate: string) =>
            Effect.provideService(
              page,
              HttpServerRequest.HttpServerRequest,
              request.modify({ url: candidate + search }),
            );

          return yield* rest.reduce(
            (previous, candidate) => Effect.catchIf(previous, isNotFound, () => serve(candidate)),
            serve(first),
          );
        }).pipe(Effect.catch(HttpServerRespondable.toResponse)),
      );
    }),
  );

export * as WebBuilds from "./WebBuilds.ts";
