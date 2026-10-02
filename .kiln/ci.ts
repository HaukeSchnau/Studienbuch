import { Action, Kiln, Nix, On, Step, Task, cmd } from "@kiln/core";
import { Release } from "@kiln/std";
import { flake } from "./flake.ts";

export const qa = Task.make("qa", { shell: flake.devShells.ci, run: cmd`just qa` }).pipe(
  Step.timeout("30 minutes"),
);

export const gate = Nix.build(flake.checks.projectReleaseGate, { name: "gate" });
export const release = Nix.build(flake.packages.projectRelease, { name: "release" });

export const promote = Action.make(
  "promote",
  { needs: { release }, after: [qa, gate], grants: { deploy: true } },
  function* ({ release }) {
    return yield* Release.promote(release, {
      readiness: "https://beta.studienbuch.app/api/health/ready",
    });
  },
);

export default Kiln.project({
  rules: [On.pullRequest([qa, gate, release]), On.push("main", [promote])],
});
