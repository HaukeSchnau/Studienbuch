import { fileURLToPath, URL } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^next$/, replacement: resolvePath("./src/infrastructure/next-compat/next.ts") },
      { find: /^next\/link$/, replacement: resolvePath("./src/infrastructure/next-compat/next-link.tsx") },
      {
        find: /^next\/navigation$/,
        replacement: resolvePath("./src/infrastructure/next-compat/next-navigation.ts"),
      },
      { find: /^next\/router$/, replacement: resolvePath("./src/infrastructure/next-compat/next-router.ts") },
      { find: /^next\/headers$/, replacement: resolvePath("./src/infrastructure/next-compat/next-headers.ts") },
      {
        find: /^next\/font\/local$/,
        replacement: resolvePath("./src/infrastructure/next-compat/next-font-local.ts"),
      },
      { find: /^next-axiom$/, replacement: resolvePath("./src/infrastructure/next-compat/next-axiom.tsx") },
    ],
  },
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    viteReact(),
  ],
});
