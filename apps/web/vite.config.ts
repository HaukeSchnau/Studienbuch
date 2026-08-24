import { defineConfig } from "vite-plus";
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

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: { allowedHosts: [...allowedHosts] },
  plugins: [
    devtools(),
    nitro({
      plugins: skipRuntimePlugin ? [] : ["./server/plugins/effect-runtime.ts"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact({ compiler: { target: "19" } }),
  ],
});

export default config;
