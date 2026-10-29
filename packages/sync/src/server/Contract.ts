/**
 * Which clients the server serves, and what it may send them. The server deploys before clients,
 * so it sends a tag only to a client whose protocol knows it (`Protocol.since`), and answers a
 * client below its minimum with `Sync.UpdateRequired`.
 */
import * as Effect from "effect/Effect";
import { Protocol } from "../protocol/Protocol.ts";

export * as Contract from "./Contract.ts";

/** The oldest client contract the server accepts. */
export interface Minimum {
  readonly protocol: number;
  readonly schema: number;
}

export const initialMinimum: Minimum = { protocol: 1, schema: 1 };

/** Fails a client whose protocol or schema is below `minimum`. */
export const admit = (contract: Protocol.Contract, minimum: Minimum) =>
  contract.protocol < minimum.protocol || contract.schema < minimum.schema
    ? Effect.fail(new Protocol.UpdateRequired({ minimum }))
    : Effect.void;

type Since = { readonly [tag: string]: number | undefined };

/**
 * The protocol version a client needs to decode every tag in `tags`. Tags outside `since`, such as
 * a mutator's own refusal tags, travel in open records that every version decodes.
 */
export const needed = (tags: Iterable<string>, since: Since = Protocol.since) => {
  let version = 1;

  for (const tag of tags) version = Math.max(version, since[tag] ?? 1);

  return version;
};

/**
 * Fails with `Sync.UpdateRequired` when a response carries a tag the client's protocol doesn't
 * know, instead of sending a message the client can't decode.
 */
export const sendable = (
  contract: Protocol.Contract,
  minimum: Minimum,
  tags: Iterable<string>,
  since?: Since,
) => {
  const protocol = needed(tags, since);

  return protocol > contract.protocol
    ? Effect.fail(
        new Protocol.UpdateRequired({
          minimum: { protocol: Math.max(protocol, minimum.protocol), schema: minimum.schema },
        }),
      )
    : Effect.void;
};

/**
 * `effect`, with a failure the client can't decode turned into `Sync.UpdateRequired`, as
 * `sendable` does for an answer.
 */
export const failSendable = <A, E extends { readonly _tag: string }, R>(
  effect: Effect.Effect<A, E, R>,
  contract: Protocol.Contract,
  minimum: Minimum,
  since?: Since,
) =>
  Effect.catch(effect, (error) =>
    Effect.andThen(sendable(contract, minimum, [error._tag], since), Effect.fail(error)),
  );
