import { bunPluginPino } from "bun-plugin-pino";

await Bun.build({
  entrypoints: ["./bin/bun.ts"],
  outdir: "./dist",
  minify: true,
  sourcemap: "linked",
  target: "bun",
  plugins: [
    bunPluginPino({
      transports: ["pino-pretty", "@axiomhq/pino"],
    }),
  ],
});
