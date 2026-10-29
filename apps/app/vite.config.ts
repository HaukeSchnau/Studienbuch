import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig } from "vite-plus";

// Logic tests run in Node. Code that needs a browser's own APIs (IndexedDB, WebCrypto keys, OPFS)
// runs as `*.browser.test.ts` in Chromium and Firefox through Playwright, with the browsers from
// nixpkgs' `playwright-driver.browsers` in PLAYWRIGHT_BROWSERS_PATH.
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
