// oxlint-disable-next-line import/no-unassigned-import -- the shim has to run before wa-sqlite loads
import "./import-meta-shim.ts";
import * as WaSqlite from "@effect/wa-sqlite";
import SQLiteESMFactory from "@effect/wa-sqlite/dist/wa-sqlite.mjs";
import { AccessHandlePoolVFS } from "@effect/wa-sqlite/src/examples/AccessHandlePoolVFS.js";
import wasmUrl from "@effect/wa-sqlite/dist/wa-sqlite.wasm";

// Effect's `OpfsWorker.run`, ported for Metro: the wasm comes from a Metro asset URL, and the
// worker's name says where the database lives (`<directory>/<file>`, or `:memory:`). If
// `OpfsWorker.run` took both, this file could go. It keeps Effect's protocol, so the page uses
// Effect's unchanged `SqliteClient.layer`.

type Message =
  | [id: number, sql: string, params: Array<SQLiteCompatibleType | null>]
  | ["update_hook"]
  | ["close"];

type Failure = string | { readonly message: string; readonly code: number };

type Reply =
  | ["ready", Failure | undefined, undefined]
  | ["closed"]
  | ["update_hook", string, number]
  | [number, Failure | undefined, [Array<Array<string>>, Array<Array<SQLiteCompatibleType | null>>]]
  | [number, Failure, undefined];

const reply = (message: Reply) =>
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker posts to its page, which takes no target origin
  self.postMessage(message);

const memory = ":memory:";

const failure = (cause: unknown): Failure =>
  cause instanceof WaSqlite.SQLiteError
    ? { message: cause.message, code: cause.code }
    : String(cause);

const open = async () => {
  const module = await SQLiteESMFactory({ locateFile: () => wasmUrl });
  const sqlite3 = WaSqlite.Factory(module);

  if (self.name === memory) {
    return { sqlite3, db: sqlite3.open_v2(memory), release: () => Promise.resolve() };
  }

  const parts = self.name.split("/");
  const file = parts.pop() ?? "db.sqlite";
  const directory = parts.join("/");

  const vfs = await AccessHandlePoolVFS.create(directory, module);

  sqlite3.vfs_register(vfs, false);

  const db = sqlite3.open_v2(file, undefined, directory);

  // One connection owns the file (ADR 0014), so SQLite needs no shared memory for the WAL, and a
  // write costs a tenth of the default journal's (client-platform.md, speed).
  sqlite3.exec(db, "PRAGMA locking_mode = exclusive; PRAGMA journal_mode = wal;");

  return { sqlite3, db, release: () => vfs.close() };
};

const serve = ({ sqlite3, db, release }: Awaited<ReturnType<typeof open>>) => {
  self.addEventListener("message", (event: MessageEvent<Message>) => {
    const message = event.data;

    // The page deletes a database right after closing it. Safari releases a dead worker's OPFS
    // access handles only some time later, so the worker closes them and says so (database.web.ts).
    if (message[0] === "close") {
      sqlite3.close(db);
      void release().then(() => {
        reply(["closed"]);
        self.close();
      });

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

// Effect's client takes a failed start for a ready worker, so its queries would wait forever.
// Instead each one fails with the reason the database didn't open.
const refuse = (cause: unknown) => {
  const reason = failure(cause);

  self.addEventListener("message", (event: MessageEvent<Message>) => {
    const [id] = event.data;

    if (id === "close") {
      reply(["closed"]);
      self.close();
    } else if (id !== "update_hook") {
      reply([id, reason, undefined]);
    }
  });

  reply(["ready", reason, undefined]);
};

open().then(serve, refuse);
