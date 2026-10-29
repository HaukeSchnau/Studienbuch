/**
 * The demo notebooks' encrypted content: the student's profile and a few homework entries, which
 * the server seals as the persona's own first device would (D55, ADR 0027). They go out as one
 * `Seal` through the engine's own push, so the server stores them after every check a device's
 * command passes. Only a notebook without a key epoch gets them, so a second seed writes nothing.
 */
import type { Demo } from "@stu/api/Demo";
import { CivilTime, Homework, type Notebook, NotebookProfile, Studienbuch } from "@stu/core";
import { SealedRow, SpaceKey } from "@stu/e2ee";
import { Command, type Sync, Tx } from "@stu/sync";
import { Push, SyncServer } from "@stu/sync/server";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Sync as ServerSync } from "../sync/Sync.ts";
import { DemoKeys } from "./DemoKeys.ts";
import { DemoSchool } from "./DemoSchool.ts";

export * as DemoNotebooks from "./DemoNotebooks.ts";

/** A homework entry, due `due` days after the seed's day, and done the day before if `done`. */
interface Entry {
  readonly course: string;
  readonly title: string;
  readonly description?: string;
  readonly due: number;
  readonly done?: true;
}

/** Invented entries in each persona's own courses. */
const homework: Readonly<Record<Demo.Persona, ReadonlyArray<Entry>>> = {
  lena: [
    { course: "ma-1", title: "Aufgaben S. 112, Nr. 3 bis 7", due: 1 },
    {
      course: "de-1",
      title: "Erörterung zu Ende schreiben",
      description: "Mindestens zwei Seiten, Gegenargumente nicht vergessen.",
      due: 2,
    },
    { course: "en-1", title: "Vocabulary Unit 4 lernen", due: 3 },
    { course: "bi-1", title: "Versuchsprotokoll abgeben", due: 5 },
    { course: "ge-1", title: "Quellenanalyse zur Weimarer Republik", due: 7 },
    { course: "ku-1", title: "Drei Perspektivstudien ins Skizzenbuch", due: -1, done: true },
  ],
  tom: [
    { course: "ma-1", title: "Übungsblatt Ableitungen", due: 1 },
    { course: "ch-1", title: "Reaktionsgleichungen, Arbeitsblatt 5", due: 2 },
    { course: "pw-1", title: "Zeitungsartikel zusammenfassen", due: 4 },
    {
      course: "en-1",
      title: "Short story: ein neues Ende schreiben",
      description: "Höchstens 300 Wörter.",
      due: 6,
    },
    { course: "mu-1", title: "Referat über Filmmusik vorbereiten", due: 8 },
    { course: "de-1", title: "Gedichtanalyse überarbeiten", due: -1, done: true },
  ],
};

const displayNames: Readonly<Record<Demo.Persona, string>> = { lena: "Lena", tom: "Tom" };

/**
 * A fixed id in the form of a random UUID, as `Homework.Id` requires, so every seed names an entry
 * alike: the first 16 bytes of a SHA-256 over the notebook and the entry's place.
 */
const entryId = Effect.fn("DemoNotebooks.entryId")(function* (
  notebook: Notebook.Id,
  index: number,
) {
  const crypto = yield* Crypto.Crypto;
  const name = new TextEncoder().encode(`${notebook}\u0000${index}`);
  const bytes = (yield* crypto.digest("SHA-256", name)).slice(0, 16);

  // RFC 9562: version 4 in the high nibble of byte 6, variant 0b10 in the high bits of byte 8.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Hex.encode(bytes);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}, Effect.orDie);

const encodeDate = Schema.encodeEffect(CivilTime.PlainDate);

/** A row's JSON as a device's `Tx` stores it, from the row's encoded fields. */
const json = <T extends Sync.Any>(table: T, encoded: Schema.Struct.Encoded<T["fields"]>) =>
  Effect.flatMap(Schema.decodeUnknownEffect(table.codec)(encoded), (row) =>
    // A table's codec decodes to its row by construction, which TypeScript can't see through `T`.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    Tx.canonical(table, row as Sync.Row<T>),
  );

type HomeworkFields = Schema.Struct.Encoded<(typeof Homework.Row)["fields"]>;

/** A homework row's fields as JSON, built one optional field at a time. */
type HomeworkJson = { -readonly [Field in keyof HomeworkFields]: HomeworkFields[Field] };

/** The persona's profile and homework, as rows a device's run would write. */
const rows = Effect.fn("DemoNotebooks.rows")(function* (
  persona: Demo.Persona,
  today: CivilTime.PlainDate,
) {
  const { notebook } = DemoSchool.personas[persona];

  const day = (offset: number) => encodeDate(CivilTime.addDays(today, offset));

  const profile = {
    table: NotebookProfile.Row.name,
    id: notebook,
    json: yield* json(NotebookProfile.Row, { displayName: displayNames[persona] }),
  };

  const entries = yield* Effect.forEach(homework[persona], (entry, index) =>
    Effect.gen(function* () {
      const fields: HomeworkJson = {
        courseId: entry.course,
        title: entry.title,
        dueOn: yield* day(entry.due),
      };

      if (entry.description !== undefined) fields.description = entry.description;

      if (entry.done === true) fields.doneOn = yield* day(entry.due - 1);

      return {
        table: Homework.Row.name,
        id: yield* entryId(notebook, index),
        json: yield* json(Homework.Row, fields),
      };
    }),
  );

  return [profile, ...entries];
}, Effect.orDie);

/** The seed's own client, which only ever sends one command per notebook. */
const clientOf = (persona: Demo.Persona) => `demo-seed-${persona}`;

/**
 * Opens the persona's notebook at key epoch 0 and seals its profile and homework into it, unless
 * the notebook has an epoch already: from an earlier seed, or from a device that wrote first.
 */
export const seal = Effect.fn("DemoNotebooks.seal")(function* (
  persona: Demo.Persona,
  today: CivilTime.PlainDate,
) {
  const sql = yield* SqlClient.SqlClient;
  const push = yield* Push.Service;
  const { account, notebook } = DemoSchool.personas[persona];

  const [space] = yield* sql<{ readonly epoch: number | null }>`
    select key_epoch as epoch from space where id = ${notebook}
  `;

  if (space === undefined) return yield* Effect.die(`The notebook ${notebook} doesn't exist`);

  if (space.epoch !== null) return;

  const { keys, record } = yield* DemoKeys.chain(account);
  const key = yield* SpaceKey.generate;
  const box = yield* SpaceKey.box(notebook, [{ epoch: 0, key }], record, keys);

  const writes = yield* Effect.forEach(yield* rows(persona, today), (row) =>
    Effect.map(SealedRow.seal({ space: notebook, ...row }, account, 0, key), (sealed) => ({
      space: notebook,
      id: row.id,
      base: Command.Absent.make({}),
      ...sealed,
    })),
  );

  const [client] = yield* sql<{ readonly last: number }>`
    select last_mutation_id::float8 as last from sync_client where id = ${clientOf(persona)}
  `;

  const mutationId = (client?.last ?? 0) + 1;

  const { outcomes } = yield* push.push(account, {
    clientId: clientOf(persona),
    syncEpoch: null,
    contract: Studienbuch.schema.contract,
    commands: [
      Command.Seal.make({
        mutationId,
        at: yield* DateTime.now,
        writes,
        boxes: [box],
        links: [],
      }),
    ],
  });

  const [outcome] = outcomes;

  if (outcome?._tag !== "Applied") {
    return yield* Effect.die(
      `The server didn't apply ${notebook}'s demo content: ${outcome?._tag}`,
    );
  }
});

/**
 * The engine's push with the seed's writers, checking boxes against the key store like the
 * server's. The seed is the push's only client and as new as the server, so its own contract is
 * the minimum.
 */
export const layer = Push.layer(Studienbuch.schema.contract).pipe(
  Layer.provideMerge(SyncServer.writers(Studienbuch.schema)),
  Layer.provide(ServerSync.accountKeys),
);
