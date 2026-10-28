// wa-sqlite ships no types for its example VFS. Metro turns a wasm import into the asset's URL.
declare module "@effect/wa-sqlite/src/examples/AccessHandlePoolVFS.js" {
  import type * as WaSqlite from "@effect/wa-sqlite";

  export const AccessHandlePoolVFS: {
    create(directory: string, module: Parameters<typeof WaSqlite.Factory>[0]): Promise<SQLiteVFS>;
  };
}

// Metro's registry behind `import.meta.url` (import-meta-shim.ts).
declare var __ExpoImportMetaRegistry: { url: string } | undefined;

declare module "*.wasm" {
  const url: string;
  export default url;
}
