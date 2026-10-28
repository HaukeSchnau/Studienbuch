// oxlint-disable-next-line import/no-unassigned-import -- the shim has to run before wa-sqlite loads
import "./import-meta-shim.ts";
import * as WaSqlite from "@effect/wa-sqlite";
import SQLiteESMFactory from "@effect/wa-sqlite/dist/wa-sqlite.mjs";
import { AccessHandlePoolVFS } from "@effect/wa-sqlite/src/examples/AccessHandlePoolVFS.js";
import wasmUrl from "@effect/wa-sqlite/dist/wa-sqlite.wasm";

// Effect's `OpfsWorker.run` from @effect/sql-sqlite-wasm, ported for Metro (client-platform.md, "Effect
// and SQLite"). It speaks the same protocol, so the page uses Effect's unchanged `SqliteClient.layer`.
// Two things differ: wa-sqlite's wasm comes from a Metro asset URL, because Metro rewrites the
// `import.meta.url` wa-sqlite looks next to, and the OPFS directory is the worker's name, so every
// device keeps its own pool of access handles. If `OpfsWorker.run` took a wasm URL and a directory,
// this file could go.

type Message =
  | [id: number, sql: string, params: Array<SQLiteCompatibleType | null>]
  | ["update_hook"]
  | ["close"];

type Failure = string | { readonly message: string; readonly code: number };

type Reply =
  | ["ready", Failure | undefined, undefined]
  | ["update_hook", string, number]
  | [number, Failure | undefined, [Array<Array<string>>, Array<Array<SQLiteCompatibleType | null>>]]
  | [number, Failure, undefined];

const reply = (message: Reply) =>
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker posts to its page, which takes no target origin
  self.postMessage(message);

const [directory = "device", file = "studienbuch.db"] = self.name.split("/");

const failure = (cause: unknown): Failure =>
  cause instanceof WaSqlite.SQLiteError
    ? { message: cause.message, code: cause.code }
    : String(cause);

const start = async () => {
  const module = await SQLiteESMFactory({ locateFile: () => wasmUrl });
  const sqlite3 = WaSqlite.Factory(module);
  const vfs = await AccessHandlePoolVFS.create(directory, module);

  sqlite3.vfs_register(vfs, false);

  const db = sqlite3.open_v2(file, undefined, directory);

  self.addEventListener("message", (event: MessageEvent<Message>) => {
    const message = event.data;

    // Ending the worker releases its OPFS access handles.
    if (message[0] === "close") {
      sqlite3.close(db);
      self.close();

      return;
    }

    if (message[0] === "update_hook") {
      sqlite3.update_hook(db, (_operation, _database, table, rowid) => {
        if (table !== null) reply(["update_hook", table, Number(rowid)]);
      });

      return;
    }

    const [id, sql, params] = message;

    try {
      const rows: Array<Array<SQLiteCompatibleType | null>> = [];
      const columns: Array<Array<string>> = [];

      for (const statement of sqlite3.statements(db, sql)) {
        let names: Array<string> | undefined;
        sqlite3.bind_collection(statement, params);

        while (sqlite3.step(statement) === WaSqlite.SQLITE_ROW) {
          names ??= sqlite3.column_names(statement);
          rows.push(sqlite3.row(statement));
          columns.push(names);
        }
      }

      reply([id, undefined, [columns, rows]]);
    } catch (cause) {
      reply([id, failure(cause), undefined]);
    }
  });

  reply(["ready", undefined, undefined]);
};

start().catch((cause: unknown) => reply(["ready", failure(cause), undefined]));
