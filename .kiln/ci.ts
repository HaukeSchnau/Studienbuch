import { Step, Task, cmd } from "@kiln/core";
import { Pnpm, Project } from "@kiln/std";
import { flake } from "./flake.ts";

const shell = flake.devShells.ci;

/** Expo and the web build reuse their outputs between tasks. */
const install = Pnpm.install({
  shell,
  keep: ["dist", "dist-ssr", "web-build", ".expo", ".expo-update-verify"],
});

export const qa = Task.make("qa", { shell, setup: install, run: cmd`just qa` }).pipe(
  Step.timeout("30 minutes"),
);

export default Project.standard({
  flake,
  checks: [qa],
  readiness: "https://beta.studienbuch.app/api/health/ready",
});
