import { bunPluginPino } from "bun-plugin-pino";

await Bun.build({
  entrypoints: ["./src/bin/http.ts"],
  outdir: "./dist",
  minify: true,
  sourcemap: "linked",
  target: "node",
  plugins: [
    bunPluginPino({
      transports: ["pino-pretty", "@axiomhq/pino"],
    }),
  ],
});
