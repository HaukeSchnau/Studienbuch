/**
 * Starts a throwaway PostgreSQL 18 on a Unix socket for one test run, so tests need no port and
 * leave nothing behind. It needs PostgreSQL 18's `postgres`, `initdb` and `pg_ctl` on `PATH`, for
 * example through `nix shell nixpkgs#postgresql_18`. Without them the tests that need a real server
 * skip and say so.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    /** The socket directory of the throwaway server, or `null` when PostgreSQL 18 is missing. */
    postgres18: string | null;
  }
}

export default function setup(project: TestProject) {
  const version = spawnSync("postgres", ["--version"], { encoding: "utf8" });
  if (version.status !== 0 || !/\(PostgreSQL\) 18\./.test(version.stdout)) {
    console.warn("PostgreSQL 18 is not on PATH, so the tests that need a real server skip.");
    project.provide("postgres18", null);
    return;
  }
  const directory = mkdtempSync(join(tmpdir(), "stu-sync-pg18-"));
  const data = join(directory, "data");
  const run = (command: string, args: ReadonlyArray<string>) => {
    const result = spawnSync(command, args, { encoding: "utf8" });
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
    run("pg_ctl", ["-D", data, "-w", "-l", join(directory, "log"), ...socket, "start"]);
  if (started) project.provide("postgres18", directory);
  return () => {
    if (started) spawnSync("pg_ctl", ["-D", data, "-m", "immediate", "stop"]);
    rmSync(directory, { recursive: true, force: true });
  };
}
