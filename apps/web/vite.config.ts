import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const allowedHosts = new Set<string>(JSON.parse(process.env.STUDIENBUCH_WEB_HOST_NAMES ?? "[]"));
if (process.env.BETTER_AUTH_URL !== undefined) {
  allowedHosts.add(new URL(process.env.BETTER_AUTH_URL).hostname);
}

/**
 * The Effect runtime plugin terminates the server when the application runtime cannot start, which
 * for a developer without PostgreSQL means the dev server crash-loops even on the public marketing
 * pages, which touch no service at all. This flag drops the plugin so those pages can be worked on
 * offline. It is ignored in production builds so a stray environment variable cannot ship a release
 * that silently runs without its runtime.
 */
const skipRuntimePlugin =
  process.env.NODE_ENV !== "production" && process.env.STUDIENBUCH_WEB_SKIP_RUNTIME === "1";

// Remote development pays a network round trip for every unbundled module. The managed Tailnet
// action enables Vite's bundled development mode by default; local development remains unchanged.
const bundledDev = process.env.STUDIENBUCH_WEB_BUNDLED_DEV === "1";

const config = defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  experimental: { bundledDev },
  server: {
    allowedHosts: [...allowedHosts],
  },
  plugins: [
    devtools(),
    nitro({
      plugins: skipRuntimePlugin ? [] : ["./server/plugins/effect-runtime.ts"],
    }),
    tailwindcss(),
    tanstackStart(),
    // React Compiler is a production optimization. Running it in development added 3-5 seconds
    // to a cold readiness probe; the production build in CI still compiles every component.
    viteReact({ compiler: command === "build" ? { target: "19" } : false }),
  ],
}));

export default config;
