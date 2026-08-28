import path from "node:path";
import type { Plugin } from "vite";

const migrationsDirectory = path.resolve(
  import.meta.dirname,
  "../../../../../packages/server/drizzle",
);
const runtimeLayer = path.resolve(import.meta.dirname, "../runtime/layer.server.ts");

const isMigration = (file: string) => {
  const relative = path.relative(migrationsDirectory, file);
  return (
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative) &&
    path.basename(file) === "migration.sql"
  );
};

/** Rebuilds the development runtime when its generated migration history changes. */
export const databaseMigrationReload = (): Plugin => ({
  name: "studienbuch:database-migration-reload",
  apply: "serve",
  configureServer(server) {
    server.watcher.add(migrationsDirectory);
  },
  hotUpdate(context) {
    if (this.environment.name !== "nitro" || !isMigration(context.file)) return;
    const modules = this.environment.moduleGraph.getModulesByFile(runtimeLayer);
    return modules === undefined ? [] : [...modules];
  },
});
