import { and, eq, isNull } from "drizzle-orm";
import { Organization } from "@stu/core";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { users } from "../auth/schema.ts";
import { Database } from "../database/client.ts";
import { operatorGrants } from "./schema.ts";

export class OperatorUnavailable extends Schema.TaggedError<OperatorUnavailable>()(
  "Operator.Unavailable",
  {},
) {}

const EmailAddress = Schema.Trim.pipe(Schema.check(Schema.isPattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)));

const decodeIdentity = (input: { readonly name: string; readonly email: string }) =>
  Schema.decodeEffect(Schema.Struct({ name: Organization.AccountName, email: EmailAddress }))(
    input,
  ).pipe(Effect.mapError(() => OperatorUnavailable.make()));

/** Create the first ordinary account that holds platform operator authority. */
export const bootstrap = Effect.fn("Operator.bootstrap")(function* (input: {
  readonly name: string;
  readonly email: string;
}) {
  const identity = yield* decodeIdentity(input);
  const database = yield* Database.Service;
  return yield* database.drizzle.transaction((transaction) =>
    Effect.gen(function* () {
      const [user] = yield* transaction
        .insert(users)
        .values({
          name: identity.name,
          email: identity.email.toLowerCase(),
          emailVerified: true,
        })
        .returning({ id: users.id });
      if (user === undefined) return yield* Effect.die("Operator account insert returned no row");
      yield* transaction.insert(operatorGrants).values({ userId: user.id });
      return { userId: user.id, email: identity.email.toLowerCase() } as const;
    }),
  );
});

/** Give an existing account platform operator authority. */
export const grant = Effect.fn("Operator.grant")(function* (emailInput: string) {
  const email = yield* Schema.decodeEffect(EmailAddress)(emailInput).pipe(
    Effect.mapError(() => OperatorUnavailable.make()),
  );
  const database = yield* Database.Service;
  const [user] = yield* database.drizzle
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  if (user === undefined) return yield* OperatorUnavailable.make();
  yield* database.drizzle
    .insert(operatorGrants)
    .values({ userId: user.id })
    .onConflictDoUpdate({ target: operatorGrants.userId, set: { revokedAt: null } });
  return { userId: user.id, email: email.toLowerCase() } as const;
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
