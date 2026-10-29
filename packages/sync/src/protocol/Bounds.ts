/**
 * How large a command may be, and which values the server can store. The server refuses a command
 * past a bound with the refusal `refusalOf` names, and a device runs the same check before a
 * command enters its outbox.
 */
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";
import type { Command } from "./Command.ts";
import { Ids } from "./Ids.ts";
import { Protocol } from "./Protocol.ts";
import { Refusal } from "./Refusal.ts";

export * as Bounds from "./Bounds.ts";

/** At most this many rows one `Seal` writes: 64 rows at `Command.maxSealedBytes` are 4 MiB. */
export const maxSealedWrites = 64;

/** At most this many key boxes one `Seal` carries: one per member, a whole cohort included. */
export const maxKeyBoxes = 512;

/** At most this many history links one `Seal` carries: one per epoch it opens. */
export const maxHistoryLinks = 8;

/**
 * The largest byte field of a key box or history link. An X-Wing encapsulation has 1,120 bytes, a
 * signature 64, and a box with every older epoch's key a few kilobytes.
 */
export const maxKeyBytes = 65_536;

/** The largest `Mutate.args`, in UTF-8 bytes of its canonical JSON. */
export const maxArgsBytes = 16_384;

/** The largest mutator version a command may name, which the server's command log stores. */
export const maxVersion = 2_147_483_647;

const isId = Schema.is(Ids.Id);

const utf8 = new TextEncoder();

/** Text the server can store: no U+0000 and no lone surrogate, which Postgres rejects. */
const storable = (text: string) => Result.isSuccess(CanonicalJson.encode(text));

const storableId = (text: string) => isId(text) && storable(text);

/** An id for a refusal's fields, which must decode as `Ids.Id` wherever the refusal goes. */
const named = (text: string) => (storableId(text) ? text : "?");

const sealedRefusal = (
  refusal: typeof Refusal.TooLarge | typeof Refusal.BadEnvelope,
  space: string,
  id: string,
) => new refusal({ space: named(space), id: named(id) });

const sealedProblem = (
  command: Command.Seal,
): Refusal.TooLarge | Refusal.BadEnvelope | undefined => {
  const [first] = command.writes;
  const [box] = command.boxes;
  const [link] = command.links;

  if (command.writes.length > maxSealedWrites && first !== undefined) {
    return sealedRefusal(Refusal.TooLarge, first.space, first.id);
  }

  if (command.boxes.length > maxKeyBoxes && box !== undefined) {
    return sealedRefusal(Refusal.TooLarge, box.space, Protocol.keyBoxId(box));
  }

  if (command.links.length > maxHistoryLinks && link !== undefined) {
    return sealedRefusal(Refusal.TooLarge, link.space, Protocol.historyLinkId(link));
  }

  for (const write of command.writes) {
    if (!storableId(write.space) || !storableId(write.id) || !storableId(write.envelope.author)) {
      return sealedRefusal(Refusal.BadEnvelope, write.space, write.id);
    }
  }

  for (const each of command.boxes) {
    const id = Protocol.keyBoxId(each);

    if (![each.space, each.recipient, each.author].every(storableId)) {
      return sealedRefusal(Refusal.BadEnvelope, each.space, id);
    }

    if ([each.enc, each.ct, each.signature].some((bytes) => bytes.length > maxKeyBytes)) {
      return sealedRefusal(Refusal.TooLarge, each.space, id);
    }
  }

  for (const each of command.links) {
    const id = Protocol.historyLinkId(each);

    if (![each.space, each.author].every(storableId)) {
      return sealedRefusal(Refusal.BadEnvelope, each.space, id);
    }

    if ([each.ct, each.signature].some((bytes) => bytes.length > maxKeyBytes)) {
      return sealedRefusal(Refusal.TooLarge, each.space, id);
    }
  }

  return undefined;
};

const mutateProblem = (command: Command.Mutate): Refusal.InvalidArgs | undefined => {
  const args = CanonicalJson.encode(command.args);

  const fits =
    storable(command.name) &&
    command.version <= maxVersion &&
    Result.isSuccess(args) &&
    utf8.encode(args.success).length <= maxArgsBytes;

  return fits
    ? undefined
    : new Refusal.InvalidArgs({ mutator: named(command.name), version: command.version });
};

/** The refusals `refusalOf` answers with. */
export type Refused = Refusal.InvalidArgs | Refusal.TooLarge | Refusal.BadEnvelope;

/**
 * The refusal for a command past a bound, or with a value the server can't store, which the
 * server answers before it looks at its rows. A sealed row's ciphertext above `Command.maxSealedBytes`
 * is refused later, after the checks on membership, role and base.
 */
export const refusalOf = (command: Command.Any): Option.Option<Refused> =>
  Option.fromUndefinedOr(
    command._tag === "Mutate" ? mutateProblem(command) : sealedProblem(command),
  );
