import { Flake, Nix } from "@calder-ci/core";
import { Project } from "@calder-ci/std";
import { flake } from "./flake.ts";

// WP-14 measurement: each release derivation as its own step, for x86_64, which srv-2 hands to its
// x86_64 builder. A one-line edit in each app makes all three units build fresh.
const x86 = (output: string, name: string) =>
  Nix.build(Flake.attr(`${output}.x86_64-linux.${name}`), { name });

export default Project.standard({
  flake,
  checks: [
    x86("packages", "deps"),
    x86("packages", "serverBuild"),
    x86("packages", "webBuild"),
    x86("packages", "appWebBuild"),
    x86("packages", "bundle"),
    x86("checks", "closureGuard"),
    x86("checks", "serverSmoke"),
  ],
});
