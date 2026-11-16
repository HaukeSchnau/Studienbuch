/**
 * A readable table's command on the server: the same mutator runs again on the server's rows,
 * after the declared spaces are locked and the account's membership in each is checked, and it
 * may refuse. As on the device, the account's role decides on the rows it wrote. Then the
 * membership rules of the tables it wrote apply.
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

/**
 * A mutator's own refusal, or a `Tx` refusal from running it again. A failure outside its codecs
 * is the mutator's bug, like a defect, so the command waits for a fix.
 */
const refusal = (mutator: Sync.AnyMutator, error: { readonly _tag: string }) =>
  Sync.encodeRefusal(mutator, error).pipe(
    Effect.map((reason) => Decision.Refused({ reason })),
    Effect.catchTags({
      SchemaError: () =>
        Effect.as(
          Effect.logError("A mutator refused with an error its codec doesn't encode").pipe(
            Effect.annotateLogs({ mutator: mutator.name, refusal: error._tag }),
          ),
          Decision.Retry(),
        ),
    }),
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
  }

  const { tx, written } = yield* PostgresTx.tracked({
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

  // `PostgresTx` dies on a write outside the declared spaces, so each row's space is locked.
  for (const row of written()) {
    const held = locked.get(row.space);

    if (
      held?.role === undefined ||
      held.role === null ||
      !Sync.mayWrite(definition, held.role, held.kind.name, row.table)
    ) {
      return yield* Decision.refuse(new Refusal.NotAllowed({ space: row.space }));
    }
  }

  const advanced = yield* Decision.advanced(locked);

  const accounts = yield* Membership.apply(
    definition,
    advanced.map(({ space }) => space),
    mutator.writes,
  ).pipe(
    Effect.provideService(Tx.Service, tx),
    // The rows it reads are the ones the command just wrote through their codec.
    Effect.catchIf(isTxRefusal, Effect.die),
  );

  return Decision.Applied({ spaces: advanced, accounts });
});
