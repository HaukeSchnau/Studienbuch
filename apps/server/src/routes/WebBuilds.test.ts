import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { assert, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { Deployment } from "../infra/config/Deployment.ts";
import { WebBuilds } from "./WebBuilds.ts";

const files = {
  "web/index.html": "landing",
  "web/impressum/index.html": "impressum",
  "web/datenschutz.html": "datenschutz",
  "web/_shell.html": "console shell",
  "web/assets/site-3f2a.js": "site js",
  "app/index.html": "app",
  "app/sw.js": "worker",
  "app/_expo/static/js/web/entry-9c1d.js": "app js",
  "app/assets/icon-77ab.png": "icon",
};

const builds = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped();

  for (const [file, content] of Object.entries(files)) {
    yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
    yield* fs.writeFileString(path.join(root, file), content);
  }

  return { web: path.join(root, "web"), app: path.join(root, "app") };
});

const server = Layer.unwrap(
  Effect.map(builds, (roots) =>
    HttpRouter.serve(WebBuilds.layer(roots), { disableLogger: true, disableListenLog: true }),
  ),
).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest),
  Layer.provide(
    Layer.succeed(Deployment.Current)({ revision: "0123abc", environment: "development" }),
  ),
);

// A browser navigation; asset requests don't accept HTML and get no fallback.
const get = Effect.fnUntraced(function* (url: string, accept = "text/html") {
  const response = yield* (yield* HttpClient.HttpClient).get(url, { headers: { accept } });

  const isolation = ["cross-origin-opener-policy", "cross-origin-embedder-policy"].filter(
    (header) => header in response.headers,
  );

  return {
    url,
    status: response.status,
    body: response.status === 200 ? yield* response.text : "",
    cache: response.headers["cache-control"] ?? null,
    isolation,
  };
});

const page = (url: string, body: string) => ({
  url,
  status: 200,
  body,
  cache: "no-cache",
  isolation: [],
});

const asset = (url: string, body: string) => ({
  url,
  status: 200,
  body,
  cache: "public, max-age=31536000, immutable",
  isolation: [],
});

const missing = (url: string) => ({ url, status: 404, body: "", cache: null, isolation: [] });

layer(server)("WebBuilds", (it) => {
  it.effect("serves both builds from one origin", () =>
    Effect.gen(function* () {
      const responses = yield* Effect.forEach(
        [
          "/",
          "/impressum",
          "/datenschutz",
          "/assets/site-3f2a.js",
          "/console",
          "/console/schools/7",
          "/app/",
          "/app/timetable/2026-10-28",
          "/app/_expo/static/js/web/entry-9c1d.js",
          "/app/assets/icon-77ab.png",
          "/app/_expo/static/js/web/gone-0000.js",
          "/nowhere",
        ],
        (url) => get(url),
      );

      assert.deepStrictEqual(responses, [
        page("/", "landing"),
        page("/impressum", "impressum"),
        page("/datenschutz", "datenschutz"),
        asset("/assets/site-3f2a.js", "site js"),
        page("/console", "console shell"),
        page("/console/schools/7", "console shell"),
        page("/app/", "app"),
        page("/app/timetable/2026-10-28", "app"),
        asset("/app/_expo/static/js/web/entry-9c1d.js", "app js"),
        asset("/app/assets/icon-77ab.png", "icon"),
        missing("/app/_expo/static/js/web/gone-0000.js"),
        missing("/nowhere"),
      ]);
      assert.deepStrictEqual(yield* get("/app/missing.js", "*/*"), missing("/app/missing.js"));
    }),
  );

  // The service worker's scope is /app/, and the landing page and old links name /app.
  it.effect("moves /app to /app/ for good, query and all", () =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;

      const responses = yield* Effect.forEach(["/app", "/app?device=a"], (url) =>
        Effect.map(client.get(url), (response) => ({
          status: response.status,
          location: response.headers["location"] ?? null,
          cache: response.headers["cache-control"] ?? null,
        })),
      ).pipe(Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }));

      const moved = { status: 308, cache: "public, max-age=31536000" };

      assert.deepStrictEqual(responses, [
        { ...moved, location: "/app/" },
        { ...moved, location: "/app/?device=a" },
      ]);
    }),
  );

  it.effect("lets the service worker answer /app as well", () =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const worker = yield* client.get("/app/sw.js");

      assert.deepStrictEqual(
        [worker.status, worker.headers["service-worker-allowed"], worker.headers["cache-control"]],
        [200, "/app", "no-cache"],
      );
    }),
  );

  it.effect("limits the app's pages and files to its own origin", () =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;

      const policies = yield* Effect.forEach(
        ["/app/", "/app/_expo/static/js/web/entry-9c1d.js", "/"],
        (url) =>
          Effect.map(client.get(url), (response) =>
            (response.headers["content-security-policy"] ?? "").includes("default-src 'self'"),
          ),
      );

      assert.deepStrictEqual(policies, [true, true, false]);
    }),
  );

  it.effect("revalidates pages by the release's ETag, never by size, mtime or date", () =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;

      const revalidate = Effect.fnUntraced(function* (headers: Record<string, string>) {
        const response = yield* client.get("/app/", {
          headers: { accept: "text/html", ...headers },
        });

        return { status: response.status, lastModified: response.headers["last-modified"] ?? null };
      });

      const etag = (yield* client.get("/app/")).headers["etag"] ?? "";
      // The ETag of the same file in another release with equal sizes and dates, as a Nix store has.
      const sameMetadata = etag.replace(/^W\/"[0-9a-f]+-/, '"');

      assert.deepStrictEqual(
        [
          yield* revalidate({ "if-none-match": etag }),
          yield* revalidate({ "if-none-match": sameMetadata }),
          yield* revalidate({ "if-modified-since": "Fri, 01 Jan 2100 00:00:00 GMT" }),
        ],
        [
          { status: 304, lastModified: null },
          { status: 200, lastModified: null },
          { status: 200, lastModified: null },
        ],
      );
    }),
  );
});
