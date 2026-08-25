import { and, eq, isNull, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";
import { randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { users } from "../auth/schema.ts";
import { Database } from "../database/client.ts";
import { digestSecret } from "./school-access.ts";
import { operatorGrants, operatorSetupTokens } from "./schema.ts";

const setupLifetimeMilliseconds = 30 * 60 * 1_000;

export class OperatorUnavailable extends Schema.TaggedError<OperatorUnavailable>()(
  "Operator.Unavailable",
  {},
) {}

const issueToken = Effect.fn("Operator.issueToken")(function* (userId: string) {
  const database = yield* Database.Service;
  const token = randomBytes(32).toString("base64url");
  const now = yield* DateTime.now;
  const expiresAt = DateTime.toDateUtc(
    DateTime.add(now, { milliseconds: setupLifetimeMilliseconds }),
  );
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
        tokenHash: digestSecret(token),
        expiresAt,
      });
    }),
  );
  return { token, expiresAt, userId } as const;
});

export const bootstrap = Effect.fn("Operator.bootstrap")(function* (nameInput: string) {
  const name = nameInput.trim().slice(0, 120);
  if (name.length === 0) return yield* OperatorUnavailable.make();
  const database = yield* Database.Service;
  const userId = randomUUID();
  yield* database.drizzle.transaction((transaction) =>
    Effect.gen(function* () {
      yield* transaction.insert(users).values({
        id: userId,
        name,
        email: `operator-${userId}@accounts.invalid`,
        emailVerified: true,
      });
      yield* transaction.insert(operatorGrants).values({ userId });
    }),
  );
  return yield* issueToken(userId);
});

export const recover = issueToken;

export const resolveSetupUser = async (pool: Pool, token: string | null) => {
  if (token === null || token.length < 32) return null;
  const result = await pool.query<{ id: string; name: string }>(
    `select users."id", users."name"
       from operator_setup_tokens setup
       join users on users."id" = setup."userId"
       join operator_grants grant_row on grant_row."userId" = users."id"
      where setup."tokenHash" = $1
        and setup."expiresAt" > now()
        and setup."usedAt" is null
        and grant_row."revokedAt" is null
      limit 1`,
    [digestSecret(token)],
  );
  const user = result.rows[0];
  return user === undefined ? null : { id: user.id, name: user.name, displayName: user.name };
};

export const consumeSetupToken = async (pool: Pool, token: string) => {
  const result = await pool.query<{ userId: string }>(
    `update operator_setup_tokens
        set "usedAt" = now()
      where "tokenHash" = $1
        and "expiresAt" > now()
        and "usedAt" is null
      returning "userId"`,
    [digestSecret(token)],
  );
  return result.rows[0]?.userId;
};

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
