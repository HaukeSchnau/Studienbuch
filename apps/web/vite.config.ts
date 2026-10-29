import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type ViteBuilder } from "vite-plus";

// Pages prerendered to `<path>/index.html`. Everything under `/console` is served from the shell.
const pages = ["/", "/impressum", "/datenschutz"];
const shell = "/_shell";
const prerendered = [...pages.map((path) => NodePath.join(path, "index.html")), `${shell}.html`];

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
        : this.resolve("react-native-web", NodeURL.fileURLToPath(import.meta.url), {
            skipSelf: true,
          });
    },
    load(id) {
      if (id !== ssrModule) return;
      const exported: unknown = NodeModule.createRequire(import.meta.url)("react-native-web");
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

// The client build's output directory, where Start writes the prerendered pages.
const clientOutDir = (builder: ViteBuilder) => {
  const client = builder.environments["client"];

  return client === undefined
    ? undefined
    : NodePath.resolve(client.config.root, client.config.build.outDir);
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
      const outDir = clientOutDir(builder);

      if (outDir === undefined) return;

      const broken = files.filter((file) => {
        const path = NodePath.join(outDir, file);

        return !NodeFS.existsSync(path) || NodeFS.readFileSync(path, "utf8").includes("<!--$!-->");
      });

      if (broken.length > 0) this.error(`Prerendering failed for ${broken.join(", ")}`);
    },
  },
});

// Prerendering stamps each route match with the time it loaded (`u:<ms>` in the `$_TSR` script), so
// two builds of the same source differ. The client compares that time only with stale and gc times,
// and a page is past both whenever someone opens it, so a fixed time behaves the same.
const reproduciblePages = (files: ReadonlyArray<string>): Plugin => ({
  name: "studienbuch:reproducible-pages",
  enforce: "post",
  buildApp: {
    order: "post",
    async handler(builder) {
      const outDir = clientOutDir(builder);

      if (outDir === undefined) return;

      for (const file of files) {
        const path = NodePath.join(outDir, file);
        const html = NodeFS.readFileSync(path, "utf8");

        NodeFS.writeFileSync(
          path,
          html.replaceAll(/(?<match>\{i:"(?:[^"\\]|\\.)*",u:)\d+/g, "$<match>0"),
        );
      }
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
    // The React Compiler memoizes components here as Expo's Babel preset does in the app, which is
    // why no code memoizes by hand. It compiles the client build only, and warns about a component
    // it skips, which would otherwise go unmemoized without a sound.
    viteReact({ compiler: { reportDiagnostics: true } }),
    failOnBrokenPages(prerendered),
    reproduciblePages(prerendered),
  ],
});
