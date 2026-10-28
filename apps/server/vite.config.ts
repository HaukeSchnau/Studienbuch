import { defineConfig } from "vite-plus";

export default defineConfig({
  // The release runs `dist/` on the host's own Node 26 without node_modules, so every dependency is
  // bundled. None of them may be a native addon (ADR 0005).
  pack: {
    entry: { main: "src/main.ts" },
    platform: "node",
    target: "node26",
    format: "esm",
    outDir: "dist",
    dts: false,
    sourcemap: true,
    deps: { alwaysBundle: [/.*/], onlyBundle: false },
  },
});
