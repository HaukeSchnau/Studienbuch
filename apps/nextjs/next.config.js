import { fileURLToPath } from "url";
import analyzer from "@next/bundle-analyzer";
import createJiti from "jiti";
import { withAxiom } from "next-axiom";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
createJiti(fileURLToPath(import.meta.url))("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@stu/api",
    "@stu/db",
    "@stu/lib",
    "@stu/lib-server",
    "@stu/rest",
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  experimental: {
    typedRoutes: true,
  },

  output: "standalone",
};

const withAnalyzer = analyzer({ enabled: process.env.ANALYZE === "true" })(
  config,
);
export default withAxiom(withAnalyzer);
