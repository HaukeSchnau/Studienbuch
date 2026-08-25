import { Organization } from "@stu/core";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as DateTime from "effect/DateTime";
import * as Encoding from "effect/Encoding";
import * as Schema from "effect/Schema";
import { users } from "../auth/schema.ts";
import { Database } from "../database/client.ts";
import {
  notebookProfiles,
  operatorGrants,
  schoolAccessCodes,
  schoolAccessReservations,
  schoolAccesses,
  schools,
} from "./schema.ts";

const reservationLifetimeMilliseconds = 2 * 60 * 60 * 1_000;

const textEncoder = new TextEncoder();

export const digestSecret = Effect.fn("SchoolAccess.digestSecret")(function* (secret: string) {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto.digest("SHA-256", textEncoder.encode(secret)).pipe(Effect.orDie);
  return Encoding.encodeHex(digest);
});

const randomToken = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto;
  return Encoding.encodeBase64Url(yield* crypto.randomBytes(32).pipe(Effect.orDie));
});

export const generatePlaintextAccessCode = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto;
  const bytes = yield* crypto.randomBytes(Organization.accessCodeLength).pipe(Effect.orDie);
  const characters = [...bytes].map((byte) => Organization.accessCodeAlphabet[byte & 31] ?? "");
  return Organization.formatAccessCode(characters.join(""));
});

export class OperatorRequired extends Schema.TaggedError<OperatorRequired>()(
  "SchoolAccess.OperatorRequired",
  {},
) {}

export const generateCodes = Effect.fn("SchoolAccess.generateCodes")(function* (input: {
  readonly schoolId: string;
  readonly schoolName: string;
  readonly kind: Organization.SchoolAccessKind;
  readonly count: number;
  readonly createdByUserId: string;
  readonly expiresAt?: Date;
}) {
  const database = yield* Database.Service;
  const schoolId = input.schoolId.trim();
  const schoolName = input.schoolName.trim();
  const count = Math.floor(input.count);

  if (schoolId.length === 0 || schoolName.length === 0 || count < 1 || count > 1_000) {
    return yield* Organization.CodeUnavailable.make();
  }

  const [operator] = yield* database.drizzle
    .select({ userId: operatorGrants.userId })
    .from(operatorGrants)
    .where(and(eq(operatorGrants.userId, input.createdByUserId), isNull(operatorGrants.revokedAt)))
    .limit(1);
  if (operator === undefined) return yield* OperatorRequired.make();

  const plaintextCodes = yield* Effect.all(
    Array.from({ length: count }, () => generatePlaintextAccessCode),
    { concurrency: "unbounded" },
  );
  const codeRecords = yield* Effect.all(
    plaintextCodes.map((code) =>
      digestSecret(Organization.normalizeAccessCode(code)).pipe(
        Effect.map((secretHash) => ({ code, secretHash })),
      ),
    ),
    { concurrency: "unbounded" },
  );
  yield* database.drizzle.transaction((transaction) =>
    Effect.gen(function* () {
      yield* transaction
        .insert(schools)
        .values({ id: schoolId, name: schoolName })
        .onConflictDoUpdate({
          target: schools.id,
          set: { name: schoolName, updatedAt: sql`now()` },
        });
      yield* transaction.insert(schoolAccessCodes).values(
        codeRecords.map(({ secretHash }) => ({
          schoolId,
          kind: input.kind,
          secretHash,
          createdByUserId: input.createdByUserId,
          expiresAt: input.expiresAt,
        })),
      );
    }),
  );

  return plaintextCodes;
});

export const reserve = Effect.fn("SchoolAccess.reserve")(function* (plaintextCode: string) {
  const normalized = Organization.normalizeAccessCode(plaintextCode);
  if (!Organization.isAccessCode(normalized)) {
    return yield* Organization.CodeUnavailable.make();
  }

  const database = yield* Database.Service;
  const secretHash = yield* digestSecret(normalized);
  const token = yield* randomToken;
  const tokenHash = yield* digestSecret(token);
  const now = yield* DateTime.now;
  const nowDate = DateTime.toDateUtc(now);
  const expiresAt = DateTime.toDateUtc(
    DateTime.add(now, { milliseconds: reservationLifetimeMilliseconds }),
  );

  const reservation = yield* database.drizzle.transaction((transaction) =>
    Effect.gen(function* () {
      yield* transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${secretHash}, 0))`,
      );
      const [code] = yield* transaction
        .select({
          id: schoolAccessCodes.id,
          schoolId: schoolAccessCodes.schoolId,
          schoolName: schools.name,
          kind: schoolAccessCodes.kind,
          expiresAt: schoolAccessCodes.expiresAt,
          revokedAt: schoolAccessCodes.revokedAt,
        })
        .from(schoolAccessCodes)
        .innerJoin(schools, eq(schools.id, schoolAccessCodes.schoolId))
        .where(eq(schoolAccessCodes.secretHash, secretHash))
        .limit(1);
      if (
        code === undefined ||
        code.revokedAt !== null ||
        (code.expiresAt !== null && code.expiresAt <= nowDate)
      ) {
        return yield* Organization.CodeUnavailable.make();
      }

      const [redeemed] = yield* transaction
        .select({ id: schoolAccesses.id })
        .from(schoolAccesses)
        .where(eq(schoolAccesses.sourceCodeId, code.id))
        .limit(1);
      if (redeemed !== undefined) return yield* Organization.CodeUnavailable.make();

      yield* transaction
        .delete(schoolAccessReservations)
        .where(
          and(
            eq(schoolAccessReservations.accessCodeId, code.id),
            lt(schoolAccessReservations.expiresAt, nowDate),
          ),
        );
      const [activeReservation] = yield* transaction
        .select({ id: schoolAccessReservations.id })
        .from(schoolAccessReservations)
        .where(eq(schoolAccessReservations.accessCodeId, code.id))
        .limit(1);
      if (activeReservation !== undefined) return yield* Organization.CodeUnavailable.make();

      yield* transaction.insert(schoolAccessReservations).values({
        accessCodeId: code.id,
        tokenHash,
        expiresAt,
      });
      return {
        token,
        expiresAt,
        school: { id: code.schoolId, name: code.schoolName },
        kind: code.kind,
      } as const;
    }),
  );
  return reservation;
});

export const inspectReservation = Effect.fn("SchoolAccess.inspectReservation")(function* (
  token: string,
) {
  const database = yield* Database.Service;
  const now = DateTime.toDateUtc(yield* DateTime.now);
  const tokenHash = yield* digestSecret(token);
  const [reservation] = yield* database.drizzle
    .select({
      expiresAt: schoolAccessReservations.expiresAt,
      schoolId: schoolAccessCodes.schoolId,
      schoolName: schools.name,
      kind: schoolAccessCodes.kind,
    })
    .from(schoolAccessReservations)
    .innerJoin(schoolAccessCodes, eq(schoolAccessCodes.id, schoolAccessReservations.accessCodeId))
    .innerJoin(schools, eq(schools.id, schoolAccessCodes.schoolId))
    .leftJoin(schoolAccesses, eq(schoolAccesses.sourceCodeId, schoolAccessCodes.id))
    .where(
      and(
        eq(schoolAccessReservations.tokenHash, tokenHash),
        gt(schoolAccessReservations.expiresAt, now),
        isNull(schoolAccessCodes.revokedAt),
        or(isNull(schoolAccessCodes.expiresAt), gt(schoolAccessCodes.expiresAt, now)),
        isNull(schoolAccesses.id),
      ),
    )
    .limit(1);
  if (reservation === undefined) return yield* Organization.ReservationUnavailable.make();
  return {
    expiresAt: reservation.expiresAt,
    school: { id: reservation.schoolId, name: reservation.schoolName },
    kind: reservation.kind,
  } as const;
});

export const completeReservation = Effect.fn("SchoolAccess.completeReservation")(function* (
  userId: string,
  token: string,
) {
  const database = yield* Database.Service;
  const tokenHash = yield* digestSecret(token);
  return yield* database.drizzle.transaction((transaction) =>
    Effect.gen(function* () {
      const now = DateTime.toDateUtc(yield* DateTime.now);
      yield* transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${tokenHash}, 0))`,
      );
      const [user] = yield* transaction
        .select({ emailVerified: users.emailVerified })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (user?.emailVerified !== true) return yield* Organization.EmailNotVerified.make();

      const [reservation] = yield* transaction
        .select({
          id: schoolAccessReservations.id,
          accessCodeId: schoolAccessReservations.accessCodeId,
          expiresAt: schoolAccessReservations.expiresAt,
          schoolId: schoolAccessCodes.schoolId,
          schoolName: schools.name,
          kind: schoolAccessCodes.kind,
          codeExpiresAt: schoolAccessCodes.expiresAt,
          codeRevokedAt: schoolAccessCodes.revokedAt,
        })
        .from(schoolAccessReservations)
        .innerJoin(
          schoolAccessCodes,
          eq(schoolAccessCodes.id, schoolAccessReservations.accessCodeId),
        )
        .innerJoin(schools, eq(schools.id, schoolAccessCodes.schoolId))
        .where(eq(schoolAccessReservations.tokenHash, tokenHash))
        .limit(1);
      if (reservation === undefined) return yield* Organization.ReservationUnavailable.make();

      const [redeemed] = yield* transaction
        .select({
          id: schoolAccesses.id,
          userId: schoolAccesses.userId,
          createdAt: schoolAccesses.createdAt,
          revokedAt: schoolAccesses.revokedAt,
        })
        .from(schoolAccesses)
        .where(eq(schoolAccesses.sourceCodeId, reservation.accessCodeId))
        .limit(1);
      if (redeemed !== undefined) {
        if (redeemed.userId !== userId || redeemed.revokedAt !== null) {
          return yield* Organization.ReservationUnavailable.make();
        }
        return {
          id: redeemed.id,
          createdAt: redeemed.createdAt,
          school: { id: reservation.schoolId, name: reservation.schoolName },
          kind: reservation.kind,
        } as const;
      }

      if (
        reservation.expiresAt <= now ||
        reservation.codeRevokedAt !== null ||
        (reservation.codeExpiresAt !== null && reservation.codeExpiresAt <= now)
      ) {
        return yield* Organization.ReservationUnavailable.make();
      }

      const [existing] = yield* transaction
        .select({ id: schoolAccesses.id })
        .from(schoolAccesses)
        .where(
          and(
            eq(schoolAccesses.userId, userId),
            eq(schoolAccesses.schoolId, reservation.schoolId),
            eq(schoolAccesses.kind, reservation.kind),
            isNull(schoolAccesses.revokedAt),
          ),
        )
        .limit(1);
      if (existing !== undefined) {
        yield* transaction
          .delete(schoolAccessReservations)
          .where(eq(schoolAccessReservations.id, reservation.id));
        return yield* Organization.AccessAlreadyExists.make();
      }

      const [access] = yield* transaction
        .insert(schoolAccesses)
        .values({
          userId,
          schoolId: reservation.schoolId,
          kind: reservation.kind,
          sourceCodeId: reservation.accessCodeId,
        })
        .returning({ id: schoolAccesses.id, createdAt: schoolAccesses.createdAt });
      if (access === undefined) return yield* Effect.die("School access insert returned no row");
      return {
        id: access.id,
        createdAt: access.createdAt,
        school: { id: reservation.schoolId, name: reservation.schoolName },
        kind: reservation.kind,
      } as const;
    }),
  );
});

export const listForUser = Effect.fn("SchoolAccess.listForUser")(function* (userId: string) {
  const database = yield* Database.Service;
  return yield* database.drizzle
    .select({
      id: schoolAccesses.id,
      kind: schoolAccesses.kind,
      createdAt: schoolAccesses.createdAt,
      schoolId: schools.id,
      schoolName: schools.name,
      displayName: notebookProfiles.displayName,
      cohort: notebookProfiles.cohort,
      className: notebookProfiles.className,
    })
    .from(schoolAccesses)
    .innerJoin(schools, eq(schools.id, schoolAccesses.schoolId))
    .leftJoin(notebookProfiles, eq(notebookProfiles.schoolAccessId, schoolAccesses.id))
    .where(and(eq(schoolAccesses.userId, userId), isNull(schoolAccesses.revokedAt)));
});

export const saveProfile = Effect.fn("SchoolAccess.saveProfile")(function* (
  userId: string,
  input: Organization.NotebookProfileInput,
) {
  const database = yield* Database.Service;
  const [access] = yield* database.drizzle
    .select({ id: schoolAccesses.id })
    .from(schoolAccesses)
    .where(
      and(
        eq(schoolAccesses.id, input.schoolAccessId),
        eq(schoolAccesses.userId, userId),
        isNull(schoolAccesses.revokedAt),
      ),
    )
    .limit(1);
  if (access === undefined) return yield* Organization.ProfileUnavailable.make();

  const profile = {
    displayName: input.displayName,
    cohort: input.cohort === "" ? undefined : input.cohort,
    className: input.className === "" ? undefined : input.className,
  };
  yield* database.drizzle
    .insert(notebookProfiles)
    .values({ schoolAccessId: access.id, ...profile })
    .onConflictDoUpdate({
      target: notebookProfiles.schoolAccessId,
      set: { ...profile, updatedAt: sql`now()` },
    });
  return profile;
});

/**
 * How many accounts one reservation may create.
 *
 * Signup does not consume the reservation — redemption does, and it needs a verified address, which
 * arrives long after the signup request returns. Without a budget the reservation would instead
 * authorise every signup made in its lifetime, so one code would buy two hours of account creation
 * and verification mail. Three lets someone who mistyped their own address try again twice.
 */
export const reservationSignupBudget = 3;

/**
 * The reservation a signup token names, if it is still usable and has signups left.
 */
const usableReservationPredicate = `reservation."expiresAt" > now()
        and reservation."signupCount" < $2
        and exists (
          select 1
          from school_access_codes code
          where code."id" = reservation."accessCodeId"
            and code."revokedAt" is null
            and (code."expiresAt" is null or code."expiresAt" > now())
            and not exists (
              select 1 from school_accesses access where access."sourceCodeId" = code."id"
            )
        )`;

/** Atomically claims one signup attempt before Better Auth starts creating the account. */
export const claimRegistrationSignup = Effect.fn("SchoolAccess.claimRegistrationSignup")(function* (
  token: string | null,
) {
  if (token === null || token.length < 32) return false;
  const database = yield* Database.Service;
  const tokenHash = yield* digestSecret(token);
  const result = yield* Effect.tryPromise({
    try: () =>
      database.pool.query(
        `update school_access_reservations reservation
              set "signupCount" = reservation."signupCount" + 1,
                  "updatedAt" = now()
            where reservation."tokenHash" = $1
              and ${usableReservationPredicate}`,
        [tokenHash, reservationSignupBudget],
      ),
    catch: (cause) =>
      Database.Unavailable.make({ reason: cause instanceof Error ? cause.message : String(cause) }),
  });
  return result.rowCount === 1;
});

/**
 * Returns a claimed attempt when Better Auth rejects it before it creates or masks an account.
 */
export const releaseRegistrationSignup = Effect.fn("SchoolAccess.releaseRegistrationSignup")(
  function* (token: string | null) {
    if (token === null || token.length < 32) return false;
    const database = yield* Database.Service;
    const tokenHash = yield* digestSecret(token);
    const result = yield* Effect.tryPromise({
      try: () =>
        database.pool.query(
          `update school_access_reservations
              set "signupCount" = "signupCount" - 1,
                  "updatedAt" = now()
            where "tokenHash" = $1
              and "signupCount" > 0`,
          [tokenHash],
        ),
      catch: (cause) =>
        Database.Unavailable.make({
          reason: cause instanceof Error ? cause.message : String(cause),
        }),
    });
    return result.rowCount === 1;
  },
);

export {
  AccessAlreadyExists,
  CodeUnavailable,
  EmailNotVerified,
  ProfileUnavailable,
  ReservationUnavailable,
} from "@stu/core/organization";

export * as SchoolAccess from "./school-access.ts";
