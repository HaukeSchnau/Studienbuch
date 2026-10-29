/**
 * Zugang: admitting an account to a school. One transaction creates the account's notebook there,
 * makes the account its owner and a reader of the school, and writes the first course choice
 * through `enrollment.set`, so the server applies a device's rules. Access codes redeem through it
 * from M3. Until then the console, the demo seed and the dev shortcuts admit.
 */
import { Enrollment, Notebook, School } from "@stu/core";
import { Spaces, SyncWriter } from "@stu/sync/server";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Notebooks } from "../sync/Notebooks.ts";
import type { Schools } from "./Schools.ts";

export * as Access from "./Access.ts";

export class UnknownSchool extends Schema.TaggedError<
  UnknownSchool,
  { readonly brand: unique symbol }
>()("Access.UnknownSchool", { school: Schema.String }) {}

export interface Admission {
  readonly notebook: Notebook.Id;
  /** `false` when the account already had access, which the call then left as it was. */
  readonly created: boolean;
}

/**
 * Writes the notebook's course choice for the choice's term through `enrollment.set`, unless the
 * notebook already chose for that term. Answers whether it wrote.
 */
export const enroll = Effect.fn("Access.enroll")(function* (
  notebook: Notebook.Id,
  choice: Schools.Choice,
) {
  const sql = yield* SqlClient.SqlClient;
  const writer = yield* SyncWriter.Service;

  const chosen = yield* sql`
    select 1 from sync_row
    where space_id = ${notebook} and tbl = ${Enrollment.Row.name} and id = ${choice.termId}
      and data is not null
  `;

  if (chosen.length > 0) return false;

  yield* writer.write(notebook, Enrollment.set.writes, Enrollment.set.run({ notebook, ...choice }));

  return true;
});

/**
 * Admits the account to the school with its first course choice, or answers the notebook it
 * already has there, with its memberships restored. Admissions of one account run one at a time,
 * so it never gets two notebooks at one school. A choice that `enrollment.set` refuses admits
 * nothing. The notebook's id is random unless the demo seed names it.
 */
export const admit = Effect.fn("Access.admit")(function* (
  account: string,
  school: School.Id,
  choice: Option.Option<Schools.Choice>,
  named?: Notebook.Id,
) {
  const sql = yield* SqlClient.SqlClient;
  const spaces = yield* Spaces.Service;
  const crypto = yield* Crypto.Crypto;

  return yield* sql.withTransaction(
    Effect.gen(function* () {
      const [found] = yield* sql`
        select 1 from auth_user where id = ${account} for no key update
      `;

      if (found === undefined) return yield* Effect.die(`The account ${account} doesn't exist`);

      const [admitted] = yield* sql<{ readonly notebook: string }>`
        select notebook_id as notebook from school_access
        where account_id = ${account} and school_id = ${school}
      `;

      if (admitted !== undefined) {
        const notebook = Notebook.Id.make(admitted.notebook);
        // An account that left the school gets its memberships, and with them its courses, back.
        yield* spaces.addMember(notebook, account, "owner");
        yield* spaces.addMember(school, account, "reader");

        return { notebook, created: false } satisfies Admission;
      }

      const [space] = yield* sql<{ readonly kind: string }>`
        select kind from space where id = ${school}
      `;

      if (space?.kind !== School.Space.name) return yield* new UnknownSchool({ school });

      const notebook = named ?? Notebook.Id.make(yield* Effect.orDie(crypto.randomUUIDv4()));
      yield* Notebooks.create(notebook, school);

      yield* sql`
        insert into school_access (account_id, school_id, notebook_id)
        values (${account}, ${school}, ${notebook})
      `;

      yield* spaces.addMember(notebook, account, "owner");
      yield* spaces.addMember(school, account, "reader");

      if (Option.isSome(choice)) yield* enroll(notebook, choice.value);

      return { notebook, created: true } satisfies Admission;
    }),
  );
});
