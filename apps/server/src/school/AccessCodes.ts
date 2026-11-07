/**
 * Zugangscodes, from the legacy server's `access/school-access.ts`. A sign-up carries a code's
 * reservation, and confirming its address spends a use while `Access.admit` runs, under the code
 * row's lock, so a code is never spent past its uses. Only SHA-256 digests are stored.
 */
import { Access as Api } from "@stu/api/Access";
import { School } from "@stu/core";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Hex from "effect/encoding/Hex";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import { Access } from "./Access.ts";

export * as AccessCodes from "./AccessCodes.ts";

/** Long enough to sign up and confirm the address. A reservation holds no use meanwhile. */
const reservationLifetime = Duration.hours(2);

/**
 * How many accounts one reservation may create. A use is spent at confirmation, long after the
 * sign-up returns, so without a budget a reservation would allow any number of sign-ups and mails.
 * Three lets someone who mistyped their own address try twice more.
 */
export const signUpBudget = 3;

const encoder = new TextEncoder();

const digest = Effect.fn("AccessCodes.digest")(function* (secret: string) {
  const crypto = yield* Crypto.Crypto;

  return Hex.encode(yield* Effect.orDie(crypto.digest("SHA-256", encoder.encode(secret))));
});

const random = (bytes: number) =>
  Effect.flatMap(Crypto.Crypto, (crypto) => Effect.orDie(crypto.randomBytes(bytes)));

/** A new code: each random byte picks one of the 32 characters, an even 3 bits to spare. */
const generate = Effect.map(random(Api.length), (bytes) =>
  Api.format(Array.from(bytes, (byte) => Api.alphabet[byte & 31] ?? "").join("")),
);

const at = (date: DateTime.Utc) => DateTime.toDateUtc(date);

export interface Minting {
  readonly school: School.Id;
  readonly kind: Api.Kind;
  /** None for any number of admissions. */
  readonly maxUses: Option.Option<number>;
  readonly expiresAt?: Option.Option<Date>;
}

/** Stores the code, or finds it stored, and answers its id. */
const store = Effect.fn("AccessCodes.store")(function* (minting: Minting, code: string) {
  const sql = yield* SqlClient.SqlClient;
  const secretHash = yield* digest(Api.canonical(code));

  yield* sql`
    insert into access_code (school_id, kind, secret_hash, max_uses, expires_at)
    values (
      ${minting.school}, ${minting.kind}, ${secretHash},
      ${Option.getOrNull(minting.maxUses)},
      ${Option.getOrNull(minting.expiresAt ?? Option.none())}
    )
    on conflict (secret_hash) do nothing
  `;

  const [row] = yield* sql<{ readonly id: string }>`
    select id from access_code where secret_hash = ${secretHash}
  `;

  if (row === undefined) return yield* Effect.die("An access code vanished after its insert");

  return { id: row.id, code: Api.format(code) };
});

/** A new random code. Its plaintext exists only in the answer. */
export const mint = Effect.fn("AccessCodes.mint")(function* (minting: Minting) {
  return yield* store(minting, yield* generate);
});

/**
 * A code chosen in advance, such as the demo school's on development and preview servers, stored
 * once however often this runs.
 */
export const ensure = Effect.fn("AccessCodes.ensure")(function* (minting: Minting, code: string) {
  return yield* store(minting, code);
});

export interface Listed {
  readonly id: string;
  readonly kind: string;
  readonly uses: number;
  readonly maxUses: number | null;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

/** The school's codes, newest first. Their plaintext is nowhere to list. */
export const list = Effect.fn("AccessCodes.list")(function* (school: School.Id) {
  const sql = yield* SqlClient.SqlClient;

  return yield* sql<Listed>`
    select id, kind, uses, max_uses as "maxUses",
      expires_at as "expiresAt", revoked_at as "revokedAt", created_at as "createdAt"
    from access_code where school_id = ${school} order by created_at desc, id
  `;
});

/** Ends the code for new reservations and for every reservation not yet spent. */
export const revoke = Effect.fn("AccessCodes.revoke")(function* (id: string) {
  const sql = yield* SqlClient.SqlClient;
  const now = at(yield* DateTime.now);

  const revoked = yield* sql`
    update access_code set revoked_at = ${now} where id = ${id} and revoked_at is null returning 1
  `;

  return revoked.length > 0;
});

interface Locked {
  readonly id: string;
  readonly schoolId: string;
  readonly kind: Api.Kind;
  readonly maxUses: number | null;
  readonly uses: number;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
}

const open = (code: Locked, now: Date) =>
  code.revokedAt === null && (code.expiresAt === null || code.expiresAt > now);

const spent = (code: Locked) => code.maxUses !== null && code.uses >= code.maxUses;

/**
 * Answers a reservation's token with the school's name, for the sign-up that follows. A code that
 * is unknown, revoked, expired or spent to its limit is unavailable. Redeeming holds no use, so
 * nobody blocks a code by redeeming it or signing up with it.
 */
export const reserve = Effect.fn("AccessCodes.reserve")(function* (typed: string) {
  const sql = yield* SqlClient.SqlClient;

  if (!Api.isCode(typed)) return yield* new Api.CodeUnavailable();

  const secretHash = yield* digest(Api.canonical(typed));
  const token = Base64Url.encode(yield* random(32));
  const tokenHash = yield* digest(token);
  const now = yield* DateTime.now;
  const expiresAt = DateTime.addDuration(now, reservationLifetime);

  const [code] = yield* sql<Locked & { readonly schoolName: string | null }>`
    select c.id, c.school_id as "schoolId", c.kind, c.max_uses as "maxUses", c.uses,
      c.expires_at as "expiresAt", c.revoked_at as "revokedAt",
      (select r.data ->> 'name' from sync_row r
        where r.space_id = c.school_id and r.tbl = 'School' and r.id = c.school_id) as "schoolName"
    from access_code c where c.secret_hash = ${secretHash}
  `;

  if (code === undefined || !open(code, at(now)) || spent(code)) {
    return yield* new Api.CodeUnavailable();
  }

  yield* sql`
    insert into access_reservation (code_id, token_hash, expires_at)
    values (${code.id}, ${tokenHash}, ${at(expiresAt)})
  `;

  return { token, schoolName: code.schoolName ?? "", kind: code.kind, expiresAt };
});

/** The code a reservation belongs to, with its use limit, whatever became of either since. */
export const codeOf = Effect.fn("AccessCodes.codeOf")(function* (token: string) {
  const sql = yield* SqlClient.SqlClient;

  const [code] = yield* sql<{ readonly id: string; readonly maxUses: number | null }>`
    select c.id, c.max_uses as "maxUses"
    from access_reservation r join access_code c on c.id = r.code_id
    where r.token_hash = ${yield* digest(token)}
  `;

  return Option.fromNullishOr(code);
});

/**
 * Charges one sign-up to the reservation, before Better Auth creates the account, and answers
 * whether the reservation allows it. Atomic, so parallel sign-ups can't all pass a check.
 */
export const claimSignUp = Effect.fn("AccessCodes.claimSignUp")(function* (token: string) {
  const sql = yield* SqlClient.SqlClient;
  const now = at(yield* DateTime.now);

  const claimed = yield* sql`
    update access_reservation r set sign_ups = r.sign_ups + 1
    where r.token_hash = ${yield* digest(token)} and r.spent_at is null and r.expires_at > ${now}
      and r.sign_ups < ${signUpBudget}
      and exists (
        select 1 from access_code c
        where c.id = r.code_id and c.revoked_at is null
          and (c.expires_at is null or c.expires_at > ${now})
          and (c.max_uses is null or c.uses < c.max_uses)
      )
    returning 1
  `;

  return claimed.length > 0;
});

/** Gives a claimed sign-up back when Better Auth refused the request before making an account. */
export const releaseSignUp = Effect.fn("AccessCodes.releaseSignUp")(function* (token: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    update access_reservation set sign_ups = sign_ups - 1
    where token_hash = ${yield* digest(token)} and sign_ups > 0
  `;
});

/**
 * Notes the reservation a sign-up for `email` carried, beside those of earlier sign-ups for that
 * address. A confirmed address keeps its school.
 */
export const rememberSignUp = Effect.fn("AccessCodes.rememberSignUp")(function* (
  token: string,
  email: string,
) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    insert into access_sign_up (account_id, reservation_id)
    select u.id, r.id from access_reservation r, auth_user u
    where r.token_hash = ${yield* digest(token)} and lower(u.email) = lower(${email})
      and not u."emailVerified"
    on conflict do nothing
  `;
});

/**
 * Admits an account whose address was just confirmed to the school of the reservation the
 * confirming device carries, and spends that code's use in the same transaction. The reservation
 * must be one a sign-up for this address carried. Without one, or with one that lapsed, was spent
 * or names a code that ended or is used up, the account gets nothing and works without a school.
 */
export const admitConfirmed = Effect.fn("AccessCodes.admitConfirmed")(function* (
  account: string,
  token: Option.Option<string>,
) {
  const sql = yield* SqlClient.SqlClient;
  const now = at(yield* DateTime.now);
  const tokenHash = Option.isNone(token) ? null : yield* digest(token.value);

  return yield* sql.withTransaction(
    Effect.gen(function* () {
      const signedUp = yield* sql<{ readonly reservation: string }>`
        delete from access_sign_up where account_id = ${account}
        returning reservation_id as reservation
      `;

      const [held] =
        tokenHash === null || signedUp.length === 0
          ? []
          : yield* sql<
              Locked & {
                readonly reservation: string;
                readonly expires: Date;
                readonly spentAt: Date | null;
              }
            >`
              select r.id as reservation, r.expires_at as expires, r.spent_at as "spentAt", c.id,
                c.school_id as "schoolId", c.kind, c.max_uses as "maxUses", c.uses,
                c.expires_at as "expiresAt", c.revoked_at as "revokedAt"
              from access_reservation r join access_code c on c.id = r.code_id
              where r.token_hash = ${tokenHash}
                and r.id in ${sql.in(signedUp.map(({ reservation }) => reservation))}
              for update of r, c
            `;

      if (
        held === undefined ||
        held.spentAt !== null ||
        held.expires <= now ||
        !open(held, now) ||
        spent(held)
      ) {
        return Option.none<Access.Admission>();
      }

      const school = School.Id.make(held.schoolId);

      const refused = (reason: string) =>
        Effect.as(
          Effect.logWarning("A confirmed sign-up wasn't admitted", { reason }),
          Option.none<Access.Admission>(),
        );

      // A demo account, a school that went away or a choice its rules refuse admits nothing.
      // Onboarding chooses the courses right after the first sign-in.
      const admitted = yield* Access.admit(account, school, Option.none()).pipe(
        Effect.asSome,
        Effect.catchTags({
          "Access.UnknownSchool": (error) => refused(error._tag),
          "Access.DemoAccount": (error) => refused(error._tag),
          "Enrollment.UnknownTerm": (error) => refused(error._tag),
          "Enrollment.ClassRequired": (error) => refused(error._tag),
          "Enrollment.CourseNotOffered": (error) => refused(error._tag),
          "Enrollment.TwoInOneGroup": (error) => refused(error._tag),
        }),
      );

      // An account that had access already used up nothing.
      if (Option.isSome(admitted) && admitted.value.created) {
        yield* sql`update access_code set uses = uses + 1 where id = ${held.id}`;
        yield* sql`
          update access_reservation set spent_at = ${now}, spent_by = ${account}
          where id = ${held.reservation}
        `;
      }

      return admitted;
    }),
  );
});
