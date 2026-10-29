import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Evolution } from "./Evolution.ts";
import { Sync } from "./Sync.ts";

const Notebook = Sync.spaceKind("notebook", { encryption: "sealed", roles: ["owner"] });

const definitionWith = (
  fields: Sync.Fields,
  args: Sync.Fields = { id: Schema.String },
  version = 1,
) => {
  const Homework = Sync.table("Homework", {
    class: "encrypted",
    fields,
    writableBy: { notebook: ["owner"] },
  });

  return Sync.schema({
    version: 1,
    spaceKinds: [Notebook],
    tables: [Homework],
    mutators: [
      Sync.mutator("homework.create", {
        version,
        args: Schema.Struct(args),
        writes: [Homework],
        spaces: () => [],
        run: () => Effect.void,
      }),
    ],
  });
};

const before = Evolution.snapshot(
  definitionWith({ title: Schema.String, doneOn: Schema.optionalKey(Schema.String) }),
);

interface Case {
  readonly name: string;
  readonly fields: Sync.Fields;
  readonly expected: ReadonlyArray<string>;
}

describe("Evolution.breakingChanges", () => {
  it.each<Case>([
    {
      name: "a new optional field",
      fields: {
        title: Schema.String,
        doneOn: Schema.optionalKey(Schema.String),
        note: Schema.optionalKey(Schema.String),
      },
      expected: [],
    },
    {
      name: "a field that changed its type",
      fields: { title: Schema.Finite, doneOn: Schema.optionalKey(Schema.String) },
      expected: ["Homework.title changed its type"],
    },
    {
      name: "a removed field",
      fields: { title: Schema.String },
      expected: ["Homework.doneOn was removed"],
    },
    {
      name: "an optional field that became required",
      fields: { title: Schema.String, doneOn: Schema.String },
      expected: ["Homework.doneOn changed its type", "Homework.doneOn is newly required"],
    },
    {
      name: "a new required field",
      fields: {
        title: Schema.String,
        doneOn: Schema.optionalKey(Schema.String),
        dueOn: Schema.String,
      },
      expected: ["Homework.dueOn is newly required"],
    },
  ])("$name", ({ fields, expected }) => {
    expect(Evolution.breakingChanges(before, Evolution.snapshot(definitionWith(fields)))).toEqual(
      expected,
    );
  });

  it("allows new arguments only with a new mutator version", () => {
    const fields = { title: Schema.String, doneOn: Schema.optionalKey(Schema.String) };
    const args = { id: Schema.String, title: Schema.String };
    const sameVersion = Evolution.snapshot(definitionWith(fields, args));
    const newVersion = Evolution.snapshot(definitionWith(fields, args, 2));

    expect([
      Evolution.breakingChanges(before, sameVersion),
      Evolution.breakingChanges(before, newVersion),
    ]).toEqual([["homework.create@1 changed its arguments without a new version"], []]);
  });
});
