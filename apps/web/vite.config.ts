import { defineConfig } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const projectHostNames = JSON.parse(process.env.STUDIENBUCH_WEB_HOST_NAMES ?? "[]") as string[];
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
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});

export default config;
