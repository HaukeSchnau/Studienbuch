/**
 * "Konto löschen" on the server (Art. 17 DSGVO). The account, its ways in, its keys, its notebooks
 * with their ciphertext, its school access and its devices' sync state go in one transaction, and
 * its sessions end. What stays: ids in logs until they rotate out, and backups until they expire,
 * whose ciphertext no key opens once the key records are gone. Nothing readable about the student.
 */
import { AccountDeletion } from "@stu/api/AccountDeletion";
import { Ports } from "@stu/sync/server";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as SqlClient from "effect/sql/SqlClient";
import { FreshSignIn } from "../auth/FreshSignIn.ts";
import { DemoAccounts } from "../demo/DemoAccounts.ts";
import { AccountLock } from "./AccountLock.ts";

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
 * Deletes the account's rows in the caller's transaction once `guard` passed, and answers the ids
 * of the sessions that ended. Each session leaves a `deleted_session` row, so its device wipes
 * itself when it comes back. An account that is gone already deletes nothing.
 */
const deleteRows = Effect.fn("Deletion.deleteRows")(function* <E, R>(
  account: string,
  guard: Effect.Effect<void, E, R>,
) {
  const sql = yield* SqlClient.SqlClient;

  const address = yield* AccountLock.take(account);

  if (Option.isNone(address)) return [];
  // Under the lock, so it sees what a path the deletion waited for changed, such as a new card
  // that ended the session asking.
  yield* guard;
  const email = address.value;

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
        where identifier = any(${codeTypes.map((type) => `${type}-otp-${email}`)})
          or strpos(value, ${account}) > 0
      `;
  // Only development and preview keep mail.
  yield* sql`delete from captured_mail where lower("to") = ${email.toLowerCase()}`;
  // Cascades to its passwords, passkeys, key records, wrappers with their seals, retired cards,
  // recovery events, sign-ups and demo row.
  yield* sql`delete from auth_user where id = ${account}`;

  return sessions.map((row) => row.id);
});

/**
 * Deletes the account and everything the server keeps of it in one transaction, after `guard`
 * passed inside it under the account's lock, then ends its sessions for this process's resolver
 * (`Ended`), so no caller can delete without closing the account's connections.
 */
export const run = Effect.fn("Deletion.run")(function* <E = never, R = never>(
  account: string,
  guard: Effect.Effect<void, E, R> = Effect.void,
) {
  const sql = yield* SqlClient.SqlClient;
  const sessions = yield* sql.withTransaction(deleteRows(account, guard));

  yield* Effect.flatMap(Ended, (pubsub) => PubSub.publishAll(pubsub, sessions));
});

/**
 * The sync engine's `Ports.Accounts`: `AccountLock.hold`, so a command waits for a deletion under
 * way and finds the account gone after it.
 */
export const accounts = Layer.effect(
  Ports.Accounts,
  Effect.map(SqlClient.SqlClient, (sql) =>
    Ports.Accounts.of({
      hold: (account) =>
        AccountLock.hold(account, "share").pipe(Effect.provideService(SqlClient.SqlClient, sql)),
    }),
  ),
);

/**
 * The bearer token in a request's `Authorization`, split as Better Auth's bearer plugin splits it:
 * the session token and its signature, URL-decoded if it is encoded.
 */
const bearerOf = (headers: Headers.Headers) =>
  Option.flatMap(Headers.get(headers, "authorization"), (value) => {
    if (value.slice(0, 7).toLowerCase() !== "bearer ") return Option.none();

    const raw = value.slice(7).trim();

    const decoded = raw.includes("%")
      ? Option.liftThrowable(decodeURIComponent)(raw)
      : Option.some(raw);

    return Option.flatMap(decoded, (signed) => {
      const [token = "", signature = ""] = signed.split(".");

      return token === "" || signature === "" ? Option.none() : Option.some({ token, signature });
    });
  });

const encoder = new TextEncoder();

/**
 * The session token of a bearer whose signature `AUTH_SECRET` made, as the bearer plugin checks it
 * (`requireSignature`): a raw token from a dump or a backup answers nothing.
 */
const signedToken = Effect.fn("Deletion.signedToken")(function* (
  headers: Headers.Headers,
  secret: Redacted.Redacted,
) {
  const bearer = bearerOf(headers);

  if (Option.isNone(bearer)) return Option.none<string>();
  const { token, signature } = bearer.value;
  const bytes = Base64.decode(signature);

  if (Result.isFailure(bytes)) return Option.none<string>();

  const valid = yield* Effect.tryPromise(() =>
    crypto.subtle
      .importKey(
        "raw",
        encoder.encode(Redacted.value(secret)),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      )
      .then((key) =>
        crypto.subtle.verify("HMAC", key, new Uint8Array(bytes.success), encoder.encode(token)),
      ),
  ).pipe(Effect.orElseSucceed(() => false));

  return valid ? Option.some(token) : Option.none<string>();
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
    const secret = yield* Config.Redacted("AUTH_SECRET");

    // A failing database fails "delete" as a defect, without a reason the device could act on, and
    // "deleted" with `Unavailable`: the device asks that question again until it gets an answer.
    return AccountDeletion.Rpcs.of({
      "AccountDeletion.delete": Effect.fn("Deletion.delete")(
        function* (_, { headers }) {
          const session = yield* sessions.resolve(headers);

          if (Option.isNone(session)) return yield* new AccountDeletion.SignedOut();

          const { accountId, sessionId } = session.value;

          // Before the sign-in check, so a tester isn't asked to confirm for a refusal.
          if (
            yield* DemoAccounts.isDemo(accountId).pipe(
              Effect.provideService(SqlClient.SqlClient, sql),
            )
          ) {
            return yield* new AccountDeletion.DemoAccount();
          }

          const fresh = Effect.flatMap(FreshSignIn.isFresh(accountId, sessionId), (isFresh) =>
            isFresh ? Effect.void : Effect.fail(new AccountDeletion.NotFresh()),
          );

          yield* run(accountId, fresh).pipe(
            Effect.provideService(Ended, pubsub),
            Effect.provideService(SqlClient.SqlClient, sql),
          );
        },
        Effect.catchTags({ SqlError: Effect.die }),
      ),
      "AccountDeletion.deleted": Effect.fn("Deletion.deleted")(
        function* (_, { headers }) {
          const token = yield* signedToken(headers, secret);

          return Option.isSome(token) && (yield* wasDeleted(token.value));
        },
        Effect.catchTags({
          SqlError: (error) =>
            Effect.andThen(
              Effect.logWarning(
                "A device's question about its deleted account went unanswered",
                error,
              ),
              Effect.fail(new AccountDeletion.Unavailable()),
            ),
        }),
      ),
    });
  }),
);
