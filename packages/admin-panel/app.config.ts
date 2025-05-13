import { defineConfig } from "@tanstack/react-start/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  tsr: {
    appDirectory: "src",
  },
  vite: {
    plugins: [
      // @ts-expect-error -- Wrong typings in Vinxi probably
      tsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
    ],
  },
});
