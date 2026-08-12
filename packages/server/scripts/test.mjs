import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const environment = { ...process.env };
const userId = process.getuid?.();
const runtimeDirectory =
  environment.XDG_RUNTIME_DIR ?? (userId === undefined ? undefined : `/run/user/${userId}`);
const podmanSocket = runtimeDirectory ? `${runtimeDirectory}/podman/podman.sock` : undefined;

if (environment.DOCKER_HOST === undefined && podmanSocket && existsSync(podmanSocket)) {
  environment.DOCKER_HOST = `unix://${podmanSocket}`;
  environment.TESTCONTAINERS_RYUK_DISABLED ??= "true";
}

const result = spawnSync("vp", ["test", "run", "--passWithNoTests"], {
  env: environment,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
