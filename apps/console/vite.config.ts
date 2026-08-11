import "vite-plus/test/config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    outDir: "dist",
    clean: true,
    format: "esm",
    banner: {
      js: "#!/usr/bin/env node\n",
    },
  },
  test: {
    environment: "node",
    name: "@stu/console",
  },
});
