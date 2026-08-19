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

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: { allowedHosts: [...allowedHosts] },
  plugins: [
    devtools(),
    nitro({
      plugins: ["./server/plugins/effect-runtime.ts"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact({ compiler: { target: "19" } }),
  ],
});

export default config;
