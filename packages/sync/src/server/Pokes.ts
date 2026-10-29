/**
 * What a commit tells the connected devices. Writers call {@link notify} inside their transaction,
 * and Postgres delivers notifications only on commit, in commit order, from every process that
 * writes: the server, the console and backfills alike.
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Ids } from "../protocol/Ids.ts";
import { Protocol } from "../protocol/Protocol.ts";

export * as Pokes from "./Pokes.ts";

/** The `LISTEN` channel. */
export const channel = "stu_sync";

/** One notification: spaces that advanced, and accounts whose memberships changed. */
export const Payload = Schema.Struct({
  spaces: Schema.Array(Protocol.Cursor),
  accounts: Schema.Array(Ids.Id),
});

export type Payload = typeof Payload.Type;

const encode = Schema.encodeEffect(Schema.fromJsonString(Payload));

/** Postgres caps a payload at 8000 bytes. Ids have at most 64 characters, so 50 fit with room. */
const perNotification = 50;

const chunks = <A>(items: ReadonlyArray<A>) =>
  Array.from({ length: Math.ceil(items.length / perNotification) }, (_, index) =>
    items.slice(index * perNotification, (index + 1) * perNotification),
  );

export const notify = Effect.fn("Pokes.notify")(function* (payload: Payload) {
  const sql = yield* SqlClient.SqlClient;

  const parts = [
    ...chunks(payload.spaces).map((spaces) => ({ spaces, accounts: [] })),
    ...chunks(payload.accounts).map((accounts) => ({ spaces: [], accounts })),
  ];

  for (const part of parts) {
    yield* sql`select pg_notify(${channel}, ${yield* Effect.orDie(encode(part))})`;
  }
});
