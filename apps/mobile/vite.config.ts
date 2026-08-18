import "vite-plus/test/config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    name: "@stu/mobile",
  },
});
