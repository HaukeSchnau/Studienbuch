import { assert, it } from "@effect/vitest";
import { getConfig } from "expo/config";
import { getLinkingConfig } from "expo-router/build/getLinkingConfig";
import { getRoutes } from "expo-router/build/getRoutes";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

// Which screen an address opens, decided by expo-router's own code from our route files and the
// router options the app config hands it. The options pass as in expo-router's useRouterConfig
// (build/global-state/useStore.js); compare the two after a bump.

const root = import.meta.dirname;

const router = getConfig(root, { isPublicConfig: true, skipSDKVersionRequirement: true }).exp.extra
  ?.router;

const files = NodeFS.readdirSync(NodePath.join(root, "src/app"), {
  recursive: true,
  encoding: "utf8",
})
  .filter((file) => /\.tsx?$/u.test(file))
  .map((file) => `./${file}`);

// Only the tree is under test, and routes load their modules lazily, so none is ever loaded.
const context = Object.assign(() => ({ default: () => null }), {
  keys: () => files,
  resolve: (key: string) => key,
  id: "src/app",
});

const linking = (() => {
  const routes = getRoutes(context, {
    ...router,
    skipGenerated: true,
    ignoreEntryPoints: true,
    platform: "web",
    preserveRedirectAndRewrites: true,
  });

  assert.isNotNull(routes);

  return getLinkingConfig(routes, context, {
    metaOnly: true,
    skipGenerated: router?.skipGenerated ?? false,
    sitemap: router?.sitemap ?? true,
    notFound: router?.notFound ?? true,
  });
})();

/** The routes from the root to the screen that `path` opens. */
const opened = (path: string) => {
  const names: Array<string> = [];
  let state = linking.getStateFromPath?.(path, linking.config);

  while (state !== undefined) {
    const route = state.routes.at(-1);

    if (route === undefined) break;

    names.push(route.name);
    state = route.state;
  }

  return names;
};

it("a wrong address, /_sitemap too, opens our not-found screen inside the root layout", () => {
  for (const path of ["/profile", "/diagnose/alt", "/_sitemap"]) {
    assert.deepStrictEqual(opened(path), ["__root", "+not-found"], path);
  }
});
