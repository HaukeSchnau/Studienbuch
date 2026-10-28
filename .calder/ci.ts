import { Task, cmd } from "@calder-ci/core";
import { Pnpm, Project } from "@calder-ci/std";
import { flake } from "./flake.ts";

const shell = flake.devShells.ci;
const install = Pnpm.install({ shell });

const fmt = Task.make("fmt", { shell, setup: install, run: cmd`vp fmt --check` });
const lint = Task.make("lint", { shell, setup: install, run: cmd`vp lint` });

export default Project.standard({ flake, checks: [fmt, lint] });
