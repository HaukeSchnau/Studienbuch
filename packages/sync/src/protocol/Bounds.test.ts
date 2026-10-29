import { describe, expect, it } from "@effect/vitest";
import { CryptoSuite, SealedRow, SpaceKey } from "@stu/e2ee";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import { Bounds } from "./Bounds.ts";
import { Command } from "./Command.ts";
import { Refusal } from "./Refusal.ts";

const at = DateTime.makeUnsafe(0);

const mutate = (fields: {
  readonly name?: string;
  readonly version?: number;
  readonly args?: Command.Mutate["args"];
}) =>
  Command.Mutate.make({
    mutationId: 1,
    name: fields.name ?? "enrollment.set",
    version: fields.version ?? 1,
    args: fields.args ?? { courseIds: ["ma"] },
    at,
  });

const write = (id: string, author = "lena"): Command.SealedWrite => ({
  space: "notebook",
  id,
  base: Command.Absent.make({}),
  envelope: new SealedRow.Envelope({ format: 1, suite: CryptoSuite.id, keyEpoch: 0, author }),
  ct: new Uint8Array(32),
});

const box = (fields: { readonly space?: string; readonly enc?: number } = {}) =>
  new SpaceKey.KeyBox({
    format: 1,
    suite: CryptoSuite.id,
    space: fields.space ?? "notebook",
    keyEpoch: 0,
    recipient: "lena",
    recipientGeneration: 0,
    author: "lena",
    authorGeneration: 0,
    enc: new Uint8Array(fields.enc ?? 1120),
    ct: new Uint8Array(48),
    signature: new Uint8Array(64),
  });

const seal = (writes: ReadonlyArray<Command.SealedWrite>, boxes: Command.Seal["boxes"] = []) =>
  Command.Seal.make({ mutationId: 1, at, writes, boxes, links: [] });

/** The refusal, or `fits`. */
const answer = (command: Command.Any) =>
  Option.getOrElse(Bounds.refusalOf(command), () => "fits" as const);

const rows = (count: number) => Array.from({ length: count }, (_, index) => write(`row-${index}`));

describe("Bounds.refusalOf", () => {
  it("refuses a command past a bound, or with a value Postgres can't store, and nothing else", () => {
    expect(
      [
        mutate({}),
        mutate({ args: { title: "x".repeat(Bounds.maxArgsBytes) } }),
        mutate({ args: { title: "a\u0000b" } }),
        mutate({ args: { count: 2 ** 53 } }),
        mutate({ name: "enrollment\u0000set" }),
        mutate({ version: Bounds.maxVersion + 1 }),
        seal(rows(Bounds.maxSealedWrites)),
        seal(rows(Bounds.maxSealedWrites + 1)),
        seal([write("row-\ud800")]),
        seal([write("row", "lena\u0000")]),
        seal([], [box({ space: "" })]),
        seal([], [box({ enc: Bounds.maxKeyBytes + 1 })]),
      ].map(answer),
    ).toEqual([
      "fits",
      new Refusal.InvalidArgs({ mutator: "enrollment.set", version: 1 }),
      new Refusal.InvalidArgs({ mutator: "enrollment.set", version: 1 }),
      new Refusal.InvalidArgs({ mutator: "enrollment.set", version: 1 }),
      new Refusal.InvalidArgs({ mutator: "?", version: 1 }),
      new Refusal.InvalidArgs({ mutator: "enrollment.set", version: Bounds.maxVersion + 1 }),
      "fits",
      new Refusal.TooLarge({ space: "notebook", id: "row-0" }),
      new Refusal.BadEnvelope({ space: "notebook", id: "?" }),
      new Refusal.BadEnvelope({ space: "notebook", id: "row" }),
      new Refusal.BadEnvelope({ space: "?", id: "0:lena" }),
      new Refusal.TooLarge({ space: "notebook", id: "0:lena" }),
    ]);
  });
});
