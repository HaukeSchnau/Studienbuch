// A probe for Calder's default-branch secrets (F65, F66), on a scratch branch that is deleted afterwards:
// a push of any branch but main asks for the App Store Connect key, and Calder must refuse it.
import { Calder, On, Secret, Task, cmd } from "@calder-ci/core";
import { flake } from "./flake.ts";

const probe = Task.make("store-key-probe", {
  shell: flake.devShells.ci,
  run: cmd`test -s "$ASC_PRIVATE_KEY_PATH" && echo "the probe got a key file" || echo "no key file"`,
  secrets: { ASC_PRIVATE_KEY_PATH: Secret.file("app-store-connect") },
  reuse: "never",
});

export default Calder.project({ rules: [On.push("calder-probe-f65", [probe])] });
