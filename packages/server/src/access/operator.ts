import { and, eq, isNull, sql } from "drizzle-orm";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as DateTime from "effect/DateTime";
import * as Encoding from "effect/Encoding";
import * as Schema from "effect/Schema";
import { users } from "../auth/schema.ts";
import { Database } from "../database/client.ts";
import { digestSecret } from "./school-access.ts";
import { operatorGrants, operatorSetupTokens } from "./schema.ts";

const setupLifetimeMilliseconds = 30 * 60 * 1_000;

export class OperatorUnavailable extends Schema.TaggedError<OperatorUnavailable>()(
  "Operator.Unavailable",
  {},
) {}

const makeSetupToken = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto;
  const token = Encoding.encodeBase64Url(yield* crypto.randomBytes(32).pipe(Effect.orDie));
  const now = yield* DateTime.now;
  return {
    token,
    tokenHash: yield* digestSecret(token),
    expiresAt: DateTime.toDateUtc(DateTime.add(now, { milliseconds: setupLifetimeMilliseconds })),
  } as const;
});

const issueToken = Effect.fn("Operator.issueToken")(function* (userId: string) {
  const database = yield* Database.Service;
  const setup = yield* makeSetupToken;
  yield* database.drizzle.transaction((transaction) =>
    Effect.gen(function* () {
      const [operator] = yield* transaction
        .select({ userId: operatorGrants.userId })
        .from(operatorGrants)
        .where(and(eq(operatorGrants.userId, userId), isNull(operatorGrants.revokedAt)))
        .limit(1);
      if (operator === undefined) return yield* OperatorUnavailable.make();
      yield* transaction
        .update(operatorSetupTokens)
        .set({ expiresAt: sql`now()` })
        .where(and(eq(operatorSetupTokens.userId, userId), isNull(operatorSetupTokens.usedAt)));
      yield* transaction.insert(operatorSetupTokens).values({
        userId,
        tokenHash: setup.tokenHash,
        expiresAt: setup.expiresAt,
      });
    }),
  );
  return { token: setup.token, expiresAt: setup.expiresAt, userId } as const;
});

export const bootstrap = Effect.fn("Operator.bootstrap")(function* (nameInput: string) {
  const name = nameInput.trim().slice(0, 120);
  if (name.length === 0) return yield* OperatorUnavailable.make();
  const database = yield* Database.Service;
  const crypto = yield* Crypto.Crypto;
  const userId = yield* crypto.randomUUIDv4.pipe(Effect.orDie);
  const setup = yield* makeSetupToken;
  yield* database.drizzle.transaction((transaction) =>
    Effect.gen(function* () {
      yield* transaction.insert(users).values({
        id: userId,
        name,
        email: `operator-${userId}@accounts.invalid`,
        emailVerified: true,
      });
      yield* transaction.insert(operatorGrants).values({ userId });
      yield* transaction.insert(operatorSetupTokens).values({
        userId,
        tokenHash: setup.tokenHash,
        expiresAt: setup.expiresAt,
      });
    }),
  );
  return { token: setup.token, expiresAt: setup.expiresAt, userId } as const;
});

export const recover = issueToken;

export const resolveSetupUser = Effect.fn("Operator.resolveSetupUser")(function* (
  token: string | null,
) {
  if (token === null || token.length < 32) return null;
  const database = yield* Database.Service;
  const tokenHash = yield* digestSecret(token);
  const result = yield* Effect.tryPromise({
    try: () =>
      database.pool.query<{ id: string; name: string }>(
        `select users."id", users."name"
       from operator_setup_tokens setup
       join users on users."id" = setup."userId"
       join operator_grants grant_row on grant_row."userId" = users."id"
      where setup."tokenHash" = $1
        and setup."expiresAt" > now()
        and setup."usedAt" is null
        and grant_row."revokedAt" is null
      limit 1`,
        [tokenHash],
      ),
    catch: (cause) =>
      Database.Unavailable.make({ reason: cause instanceof Error ? cause.message : String(cause) }),
  });
  const user = result.rows[0];
  return user === undefined ? null : { id: user.id, name: user.name, displayName: user.name };
});

export const consumeSetupToken = Effect.fn("Operator.consumeSetupToken")(function* (token: string) {
  const database = yield* Database.Service;
  const tokenHash = yield* digestSecret(token);
  const result = yield* Effect.tryPromise({
    try: () =>
      database.pool.query<{ userId: string }>(
        `update operator_setup_tokens
        set "usedAt" = now()
      where "tokenHash" = $1
        and "expiresAt" > now()
        and "usedAt" is null
      returning "userId"`,
        [tokenHash],
      ),
    catch: (cause) =>
      Database.Unavailable.make({ reason: cause instanceof Error ? cause.message : String(cause) }),
  });
  return result.rows[0]?.userId;
});

export const isActive = Effect.fn("Operator.isActive")(function* (userId: string) {
  const database = yield* Database.Service;
  const [operator] = yield* database.drizzle
    .select({ active: operatorGrants.userId })
    .from(operatorGrants)
    .where(and(eq(operatorGrants.userId, userId), isNull(operatorGrants.revokedAt)))
    .limit(1);
  return operator !== undefined;
});

export * as Operator from "./operator.ts";
