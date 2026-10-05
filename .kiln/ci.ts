import { Step, Task, cmd } from "@kiln/core";
import { Project } from "@kiln/std";
import { flake } from "./flake.ts";

export const qa = Task.make("qa", { shell: flake.devShells.ci, run: cmd`just qa` }).pipe(
  Step.timeout("30 minutes"),
);

export default Project.standard({
  flake,
  checks: [qa],
  readiness: "https://beta.studienbuch.app/api/health/ready",
});
