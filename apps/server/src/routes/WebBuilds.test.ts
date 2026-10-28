import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { assert, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { WebBuilds } from "./WebBuilds.ts";

const files = {
  "web/index.html": "landing",
  "web/impressum/index.html": "impressum",
  "web/datenschutz.html": "datenschutz",
  "web/_shell.html": "console shell",
  "web/assets/site-3f2a.js": "site js",
  "app/index.html": "app",
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
).pipe(Layer.provideMerge(NodeHttpServer.layerTest));

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
          "/app",
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
        page("/app", "app"),
        page("/app/timetable/2026-10-28", "app"),
        asset("/app/_expo/static/js/web/entry-9c1d.js", "app js"),
        asset("/app/assets/icon-77ab.png", "icon"),
        missing("/app/_expo/static/js/web/gone-0000.js"),
        missing("/nowhere"),
      ]);
      assert.deepStrictEqual(yield* get("/app/missing.js", "*/*"), missing("/app/missing.js"));
    }),
  );
});
