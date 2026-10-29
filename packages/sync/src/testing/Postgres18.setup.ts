/**
 * Vitest's global setup that starts a throwaway PostgreSQL 18 on a Unix socket for one test run,
 * which tests reach through `Postgres18`. It needs `postgres`, `initdb` and `pg_ctl` 18 on `PATH`,
 * as devenv's shell has them. Without them those tests skip and say so.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import type { TestProject } from "vitest/node";

export default function setup(project: TestProject) {
  const version = NodeChildProcess.spawnSync("postgres", ["--version"], { encoding: "utf8" });

  if (version.status !== 0 || !/\(PostgreSQL\) 18\./.test(version.stdout)) {
    console.warn("PostgreSQL 18 is not on PATH, so the tests that need a real server skip.");
    project.provide("postgres18", null);

    return;
  }

  const directory = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stu-pg18-"));
  const data = NodePath.join(directory, "data");

  const run = (command: string, args: ReadonlyArray<string>) => {
    const result = NodeChildProcess.spawnSync(command, args, { encoding: "utf8" });

    if (result.status !== 0) {
      project.provide("postgres18", null);
      console.warn(
        `${command} failed, so the tests that need a real server skip:\n${result.stderr}`,
      );
    }

    return result.status === 0;
  };

  // An ICU default collation, as on a cluster created with a system locale, so a query that relies
  // on the default collation sorts differently from SQLite and fails here.
  const initdb = ["-D", data, "-U", "postgres", "--auth=trust", "--encoding=UTF8"];
  const icu = ["--locale-provider=icu", "--icu-locale=en", "--locale=C.UTF-8"];
  const socket = ["-o", `-k ${directory} -c listen_addresses=`];

  const started =
    run("initdb", [...initdb, ...icu]) &&
    run("pg_ctl", ["-D", data, "-w", "-l", NodePath.join(directory, "log"), ...socket, "start"]);

  if (started) project.provide("postgres18", directory);

  return () => {
    if (started) NodeChildProcess.spawnSync("pg_ctl", ["-D", data, "-m", "immediate", "stop"]);
    NodeFS.rmSync(directory, { recursive: true, force: true });
  };
}
