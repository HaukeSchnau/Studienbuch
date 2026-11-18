/**
 * "Konto löschen" on the server (Art. 17 DSGVO). The account, its ways in, its keys, its notebooks
 * with their ciphertext, its school access and its devices' sync state go in one transaction, and
 * its sessions end. What stays: ids in logs until they rotate out, and backups until they expire,
 * whose ciphertext no key opens once the key records are gone. Nothing readable about the student.
 */
import { AccountDeletion } from "@stu/api/AccountDeletion";
import { Ports } from "@stu/sync/server";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as SqlClient from "effect/sql/SqlClient";
import { FreshSignIn } from "../auth/FreshSignIn.ts";

export * as Deletion from "./Deletion.ts";

/**
 * The sessions a deletion ended. Their rows go by SQL, past Better Auth's hooks, so the session
 * resolver hears of them here and the sync server closes their connections.
 */
export class Ended extends Context.Service<Ended, PubSub.PubSub<string>>()("Deletion.Ended") {}

export const ended = Layer.effect(Ended)(PubSub.unbounded<string>());

/** The email-OTP plugin's code types, whose identifier is `<type>-otp-<address>`. */
const codeTypes = ["email-verification", "sign-in", "forget-password", "change-email"];

/**
 * Deletes the account and everything the server keeps of it, and answers the ids of the sessions
 * that ended, for `Ended`. Each session leaves a `deleted_session` row, so its device wipes itself
 * when it comes back. An account that is gone already deletes nothing.
 */
export const run = Effect.fn("Deletion.run")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;

  return yield* sql.withTransaction(
    Effect.gen(function* () {
      const [user] = yield* sql<{ readonly email: string }>`
        select email from auth_user where id = ${account} for update
      `;

      if (user === undefined) return [];

      const notebooks = yield* sql<{ readonly id: string }>`
        select notebook_id as id from school_access where account_id = ${account}
      `;

      const sessions = yield* sql<{ readonly id: string }>`
        with ended as (
          delete from auth_session where "userId" = ${account} returning id, token
        ), kept as (
          insert into deleted_session (token_hash)
          select encode(sha256(convert_to(token, 'UTF8')), 'hex') from ended
          on conflict do nothing
        )
        select id from ended
      `;

      // A device's sync identity and the commands it sent, which no foreign key ties to the account.
      yield* sql`delete from command_log where account_id = ${account}`;
      yield* sql`delete from sync_client where account_id = ${account}`;
      // Its memberships, the course spaces its enrollments granted among them.
      yield* sql`delete from space_member where account_id = ${account}`;
      // Access names the notebook, which goes with its rows and key boxes.
      yield* sql`delete from school_access where account_id = ${account}`;
      yield* sql`delete from space where id = any(${notebooks.map((row) => row.id)})`;
      // The code's use stays spent.
      yield* sql`update access_reservation set spent_by = null where spent_by = ${account}`;
      // Codes for the address, by Better Auth's identifiers for them, and passkey challenges, which
      // carry the account's id.
      yield* sql`
        delete from auth_verification
        where identifier = any(${codeTypes.map((type) => `${type}-otp-${user.email}`)})
          or strpos(value, ${account}) > 0
      `;
      // Only development and preview keep mail.
      yield* sql`delete from captured_mail where lower("to") = ${user.email.toLowerCase()}`;
      // Cascades to its passwords, passkeys, key records, wrappers with their seals, recovery
      // events, sign-ups and demo row.
      yield* sql`delete from auth_user where id = ${account}`;

      return sessions.map((row) => row.id);
    }),
  );
});

/**
 * The sync engine's `Ports.Accounts`: the other half of `run`'s lock on the account's row, so a
 * command waits for a deletion under way and finds the account gone after it.
 */
export const accounts = Layer.effect(
  Ports.Accounts,
  Effect.map(SqlClient.SqlClient, (sql) =>
    Ports.Accounts.of({
      hold: (account) =>
        Effect.map(
          sql`select 1 from auth_user where id = ${account} for share`,
          (rows) => rows.length > 0,
        ),
    }),
  ),
);

/** Ends the sessions for the resolver, once their rows are gone. */
export const announce = (sessions: ReadonlyArray<string>) =>
  Effect.flatMap(Ended, (pubsub) => PubSub.publishAll(pubsub, sessions));

/**
 * The session token in a request's `Authorization`, as Better Auth's bearer plugin reads it: the
 * part before the signature, URL-decoded if it is encoded.
 */
const tokenOf = (headers: Headers.Headers) =>
  Option.flatMap(Headers.get(headers, "authorization"), (value) => {
    if (value.slice(0, 7).toLowerCase() !== "bearer ") return Option.none();

    const raw = value.slice(7).trim();

    const decoded = raw.includes("%")
      ? Option.liftThrowable(decodeURIComponent)(raw)
      : Option.some(raw);

    return Option.filter(
      Option.map(decoded, (signed) => signed.split(".")[0] ?? ""),
      (token) => token !== "",
    );
  });

/** Whether the token belonged to a session of a deleted account. */
export const wasDeleted = Effect.fn("Deletion.wasDeleted")(function* (token: string) {
  const sql = yield* SqlClient.SqlClient;

  const [found] = yield* sql`
    select 1 from deleted_session
    where token_hash = encode(sha256(convert_to(${token}, 'UTF8')), 'hex')
  `;

  return found !== undefined;
});

export const handlers = AccountDeletion.Rpcs.toLayer(
  Effect.gen(function* () {
    const sessions = yield* Ports.SessionResolver;
    const sql = yield* SqlClient.SqlClient;
    const pubsub = yield* Ended;

    // A failing database fails the call as a defect, without a reason the device could act on.
    return AccountDeletion.Rpcs.of({
      "AccountDeletion.delete": Effect.fn("Deletion.delete")(
        function* (_, { headers }) {
          const session = yield* sessions.resolve(headers);

          if (Option.isNone(session)) return yield* new AccountDeletion.SignedOut();

          const { accountId, sessionId } = session.value;

          const ended = yield* sql.withTransaction(
            Effect.gen(function* () {
              if (!(yield* FreshSignIn.isFresh(accountId, sessionId))) {
                return yield* new AccountDeletion.NotFresh();
              }

              return yield* run(accountId);
            }),
          );

          yield* announce(ended).pipe(Effect.provideService(Ended, pubsub));
        },
        Effect.catchTags({ SqlError: Effect.die }),
      ),
      "AccountDeletion.deleted": Effect.fn("Deletion.deleted")(
        function* (_, { headers }) {
          const token = tokenOf(headers);

          return Option.isSome(token) && (yield* wasDeleted(token.value));
        },
        Effect.catchTags({ SqlError: Effect.die }),
      ),
    });
  }),
);
