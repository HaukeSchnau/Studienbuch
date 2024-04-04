import { fileURLToPath } from "url";
import analyzer from "@next/bundle-analyzer";
import _jiti from "jiti";
import { withAxiom } from "next-axiom";

const jiti = _jiti(fileURLToPath(import.meta.url));

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
jiti("./src/env");
jiti("@schnau/auth/env");

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: ["@schnau/api", "@schnau/auth", "@schnau/db"],

  /** We already do linting and typechecking as separate tasks in CI */
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  output: "standalone",
};

const withAnalyzer = analyzer({ enabled: process.env.ANALYZE === "true" })(
  config,
);
export default withAxiom(withAnalyzer);
