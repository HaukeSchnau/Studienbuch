import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite-plus";

// Pages prerendered to `<path>/index.html`. Everything under `/console` is served from the shell.
const pages = ["/", "/impressum", "/datenschutz"];
const shell = "/_shell";

// `react-native` resolves to react-native-web. The browser and production builds get RNW's ESM build,
// which Rolldown bundles. Vite's dev SSR runner can neither externalize that build (Node refuses ESM
// inside a CommonJS package) nor inline it (its CommonJS helpers lose their default export), so dev
// SSR loads RNW's CommonJS build through Node's require.
const reactNativeWeb = (): Plugin => {
  const ssrModule = "\0react-native-web-ssr";
  let dev = false;

  return {
    name: "studienbuch:react-native-web",
    enforce: "pre",
    configResolved(config) {
      dev = config.command === "serve";
    },
    resolveId(id) {
      if (id !== "react-native") return;

      // Resolved from this app: shared packages import `react-native` without depending on RNW.
      return dev && this.environment.name !== "client"
        ? ssrModule
        : this.resolve("react-native-web", fileURLToPath(import.meta.url), { skipSelf: true });
    },
    load(id) {
      if (id !== ssrModule) return;
      const exported: unknown = createRequire(import.meta.url)("react-native-web");
      const names = exported instanceof Object ? Object.keys(exported) : [];

      return [
        `import { createRequire } from "node:module";`,
        `const rnw = createRequire(${JSON.stringify(import.meta.url)})("react-native-web");`,
        `export const { ${names.filter((name) => name !== "default" && name !== "__esModule").join(", ")} } = rnw;`,
        `export default rnw;`,
      ].join("\n");
    },
  };
};

// Start 1.169 exits with code 0 when a page fails to prerender (TanStack/router#8120). A page that
// throws while rendering is even written, as React's client-render fallback (`<!--$!-->`) with no
// content. Remove this check once a failed page fails Start's build.
const failOnBrokenPages = (files: ReadonlyArray<string>): Plugin => ({
  name: "studienbuch:fail-on-broken-pages",
  enforce: "post",
  buildApp: {
    order: "post",
    async handler(builder) {
      const client = builder.environments["client"];

      if (client === undefined) return;
      const outDir = resolve(client.config.root, client.config.build.outDir);

      const broken = files.filter((file) => {
        const path = join(outDir, file);

        return !existsSync(path) || readFileSync(path, "utf8").includes("<!--$!-->");
      });

      if (broken.length > 0) this.error(`Prerendering failed for ${broken.join(", ")}`);
    },
  },
});

export default defineConfig({
  resolve: {
    // Platform files written for Metro (`Thing.web.tsx`) resolve the same way here.
    extensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".mjs", ".js", ".jsx", ".json"],
  },
  // Vite hands bare imports of external packages to Node before plugins see them.
  ssr: { noExternal: ["react-native"] },
  // Start prerenders by fetching pages from Vite's preview server in the build process. On
  // `localhost` it listens on ::1 only, and Node's fetch gives ::1 250 ms before trying 127.0.0.1,
  // which a busy build exceeds; the build then fails at random.
  preview: { host: "127.0.0.1" },
  plugins: [
    reactNativeWeb(),
    tanstackStart({
      // The generated route tree is checked in, so it is written the way oxfmt formats it.
      router: { quoteStyle: "double", semicolons: true },
      pages: pages.map((path) => ({ path })),
      prerender: { enabled: true, autoStaticPathsDiscovery: false, crawlLinks: false },
      // The shell is rendered at a route that is never prerendered: with the default mask `/`, the
      // shell and the prerendered landing page collide on `index.html` (TanStack/router#8741).
      spa: { enabled: true, maskPath: "/console", prerender: { outputPath: shell } },
    }),
    viteReact(),
    failOnBrokenPages([...pages.map((path) => join(path, "index.html")), `${shell}.html`]),
  ],
});
