/**
 * A readable table's command on the server: the same mutator runs again on the server's rows,
 * after the declared spaces are locked and the account's role in each is checked, and it may
 * refuse. Then the membership rules of the tables it wrote apply.
 */
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SqlError from "effect/sql/SqlError";
import { Sync } from "../definition/Sync.ts";
import type { Command } from "../protocol/Command.ts";
import { Refusal } from "../protocol/Refusal.ts";
import { Tx } from "../transaction/Tx.ts";
import { Decision } from "./Decision.ts";
import { Membership } from "./Membership.ts";
import { PostgresTx } from "./PostgresTx.ts";
import { SyncSchema } from "./SyncSchema.ts";

export * as MutateCommand from "./MutateCommand.ts";

const isTxRefusal = Schema.is(Tx.Refused);

const encodeTxRefusal = Schema.encodeEffect(Schema.toCodecJson(Tx.Refused));

/** The role may write every declared table that the space's kind takes, and one at least. */
const mayWrite = (mutator: Sync.AnyMutator, space: Decision.Locked) => {
  const allowed = mutator.writes.flatMap((table) => {
    const roles = table.writableBy[space.kind.name];

    return roles === undefined ? [] : [space.role !== null && roles.includes(space.role)];
  });

  return allowed.length > 0 && allowed.every(Boolean);
};

/** A mutator's own refusal through its error codec, or a `Tx` refusal from running it again. */
const refusal = (mutator: Sync.AnyMutator, error: { readonly _tag: string }) =>
  (isTxRefusal(error)
    ? encodeTxRefusal(error)
    : Schema.encodeUnknownEffect(mutator.error)(error)
  ).pipe(
    // A refusal outside the mutator's own codec is the mutator's bug, like a defect.
    Effect.orDie,
    Effect.flatMap(Decision.reason),
    Effect.map((reason) => Decision.Refused({ reason })),
  );

export const decide = Effect.fn("MutateCommand.decide")(function* (
  account: string,
  command: Command.Mutate,
) {
  const definition = yield* SyncSchema.Service;
  const mutator = definition.byName.mutators.Mutate.get(command.name);

  if (mutator === undefined) {
    return yield* Decision.refuse(new Refusal.UnknownMutator({ mutator: command.name }));
  }

  const invoked = yield* Effect.result(Sync.invoke(mutator, command.version, command.args));

  if (Result.isFailure(invoked)) {
    // A newer app reached the server before its release did. Older versions wait for upgrade
    // chains, which arrive with the first version 2 mutator.
    return invoked.failure._tag === "Sync.NewerVersion"
      ? Decision.Retry()
      : yield* Decision.refuse(
          new Refusal.InvalidArgs({ mutator: command.name, version: command.version }),
        );
  }

  const { spaces, run } = invoked.success;
  const locked = yield* Decision.lock(account, spaces);

  for (const space of [...new Set(spaces)].sort()) {
    const held = locked.get(space);

    if (held?.role === undefined || held.role === null) {
      return yield* Decision.refuse(new Refusal.NotMember({ space }));
    }

    if (!mayWrite(mutator, held)) return yield* Decision.refuse(new Refusal.NotAllowed({ space }));
  }

  const tx = yield* PostgresTx.make({
    actor: account,
    writes: mutator.writes,
    spaces,
    asMember: true,
  });

  const ran = yield* run.pipe(
    Effect.provideService(Tx.Service, tx),
    Effect.result,
    // A defect is the server's bug, not the command's, so the command waits for a fix.
    Effect.catchDefect((defect) =>
      Effect.as(
        Effect.logError("A mutator died on the server").pipe(
          Effect.annotateLogs({ mutator: command.name, defect: String(defect) }),
        ),
        undefined,
      ),
    ),
  );

  if (ran === undefined) return Decision.Retry();

  if (Result.isFailure(ran)) {
    return SqlError.isSqlError(ran.failure)
      ? yield* ran.failure
      : yield* refusal(mutator, ran.failure);
  }

  const advanced = yield* Decision.advanced(locked);
  const accounts = new Set<string>();

  for (const { space } of advanced) {
    const changed = yield* Membership.apply(definition, space, mutator.writes).pipe(
      Effect.provideService(Tx.Service, tx),
      // The rows it reads are the ones the command just wrote through their codec.
      Effect.catchIf(isTxRefusal, Effect.die),
    );

    for (const account of changed) accounts.add(account);
  }

  return Decision.Applied({ spaces: advanced, accounts: [...accounts].sort() });
});
