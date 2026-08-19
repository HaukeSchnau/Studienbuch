import { defineConfig } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import * as Schema from "effect/Schema";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const projectHostNames = Schema.decodeUnknownSync(Schema.Array(Schema.String))(
  JSON.parse(process.env.STUDIENBUCH_WEB_HOST_NAMES ?? "[]"),
);
const authHostName = process.env.BETTER_AUTH_URL
  ? new URL(process.env.BETTER_AUTH_URL).hostname
  : undefined;

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    allowedHosts: [...new Set([...projectHostNames, authHostName])].filter(
      (hostName): hostName is string => hostName !== undefined,
    ),
  },
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
