import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import type * as HttpServerError from "effect/http/HttpServerError";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpStaticServer from "effect/http/HttpStaticServer";
import * as Path from "effect/Path";

/** Where the two web builds live: `apps/web`'s static output and `apps/app`'s Expo web export. */
export interface Roots {
  readonly web: string;
  readonly app: string;
}

// Content-hashed file names, so a cached copy never goes stale.
const immutable = "public, max-age=31536000, immutable";
const revalidate = "no-cache";

const isNotFound = (error: HttpServerError.HttpServerError) =>
  error.reason._tag === "RouteNotFound";

/**
 * Serves both web builds from one origin, with no COOP or COEP headers (ADR 0014, D29):
 * - `/app/*`: the Expo web export, falling back to `index.html` for routes without a file.
 * - `/console/*`: the console SPA shell that TanStack Start writes as `_shell.html`.
 * - everything else: the prerendered pages, where `/impressum` is `impressum.html` or
 *   `impressum/index.html`, whichever the build wrote.
 */
export const layer = (roots: Roots) =>
  HttpRouter.use(
    Effect.fnUntraced(function* (router) {
      const path = yield* Path.Path;

      const files = (options: Parameters<typeof HttpStaticServer.make>[0]) =>
        Effect.map(HttpStaticServer.make(options), (handler) =>
          Effect.catch(handler, HttpServerRespondable.toResponse),
        );

      const app = router.prefixed("/app");
      const appAssets = yield* files({ root: roots.app, cacheControl: immutable });
      yield* app.add("GET", "/_expo/static/*", appAssets);
      yield* app.add("GET", "/assets/*", appAssets);
      yield* app.add(
        "GET",
        "/*",
        yield* files({ root: roots.app, spa: true, cacheControl: revalidate }),
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

      const page = yield* HttpStaticServer.make({ root: roots.web, cacheControl: revalidate });
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
