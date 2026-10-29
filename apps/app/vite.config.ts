import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig, type Plugin } from "vite-plus";

// Logic tests run in Node. Code that needs a browser's own APIs (IndexedDB, WebCrypto keys, OPFS)
// runs as `*.browser.test.ts` in Chromium and Firefox through Playwright, with the browsers from
// nixpkgs' `playwright-driver.browsers` in PLAYWRIGHT_BROWSERS_PATH.

// What Metro does for the web build and Vite doesn't: our imports of `x.ts` get `x.web.ts` where
// one exists (metro.config.js), a wasm import is the file's URL, SQL migrations are text modules
// (metro.transformer.js), and the SQLite worker's URL is relative to the page, where Vite wants it
// relative to the module and loaded as a module worker.
const ownTypeScript = /^\.{1,2}\/.*\.tsx?$/u;

const metroForTheWeb: Plugin = {
  name: "studienbuch:metro-for-the-web",
  enforce: "pre",
  async resolveId(source, importer) {
    // Metro hands the worker the wasm file's URL, as Vite does for `?url`.
    if (source.endsWith(".wasm"))
      return this.resolve(`${source}?url`, importer, { skipSelf: true });

    if (importer === undefined || importer.includes("/node_modules/")) return null;

    if (!ownTypeScript.test(source)) return null;

    return this.resolve(source.replace(/\.(tsx?)$/u, ".web.$1"), importer, { skipSelf: true });
  },
  transform: (code, id) => {
    if (id.endsWith(".sql")) return { code: `export default ${JSON.stringify(code)};`, map: null };

    if (!id.endsWith("/infra/sqlite/database.web.ts")) return null;

    return {
      code: code
        .replace(
          'new URL("./opfs.worker", window.location.href)',
          'new URL("./opfs.worker.ts", import.meta.url)',
        )
        .replace("name: workerName(location),", 'type: "module", name: workerName(location),'),
      map: null,
    };
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["src/**/*.test.ts", "modules/**/*.test.ts"],
          exclude: ["src/**/*.browser.test.ts"],
        },
      },
      {
        extends: true,
        plugins: [metroForTheWeb],
        resolve: {
          alias: { "react-native": "react-native-web" },
          extensions: [".web.ts", ".web.tsx", ".web.js", ".ts", ".tsx", ".mjs", ".js", ".json"],
        },
        define: { "process.env.EXPO_OS": JSON.stringify("web") },
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }, { browser: "firefox" }],
            screenshotFailures: false,
          },
        },
      },
    ],
  },
});
