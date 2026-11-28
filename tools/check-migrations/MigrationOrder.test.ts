import { expect, it } from "@effect/vitest";

import { MigrationOrder } from "./MigrationOrder.ts";

const main = [
  "20261118222158_import_source",
  "20261127204940_retention_sweep",
  "20261127122236_self_check",
];

it("passes a tree that adds nothing, or adds after main's newest", () => {
  expect(MigrationOrder.late(main, main).late).toEqual([]);
  expect(MigrationOrder.late([...main, "20261128061500_event_courses"], main).late).toEqual([]);
  // A tree behind main lacks main's newest, which is no migration of its own.
  expect(MigrationOrder.late(main.slice(0, 1), main).late).toEqual([]);
});

it("names a rename after main's newest for each migration that sorts before it", () => {
  // A sibling merged a newer migration first.
  expect(MigrationOrder.late([...main, "20261127200000_import_export"], main)).toEqual({
    newest: "20261127204940_retention_sweep",
    late: [{ name: "20261127200000_import_export", rename: "20261127204941_import_export" }],
  });
});

it("keeps the tree's own order, renaming a later one when a renamed one would pass it", () => {
  const added = ["20261101000000_a", "20261102000000_b", "20261127204941_c", "20261201000000_d"];

  expect(MigrationOrder.late([...main, ...added], main).late).toEqual([
    { name: "20261101000000_a", rename: "20261127204941_a" },
    { name: "20261102000000_b", rename: "20261127204942_b" },
    { name: "20261127204941_c", rename: "20261127204943_c" },
  ]);
});

it("carries a rename over midnight, and names no rename without a timestamp", () => {
  const year = ["20261231235959_last"];

  expect(MigrationOrder.late([...year, "20261230000000_a", "0_init"], year).late).toEqual([
    { name: "0_init", rename: null },
    { name: "20261230000000_a", rename: "20270101000000_a" },
  ]);
  expect(MigrationOrder.late(["20261230000000_a"], [])).toEqual({ newest: null, late: [] });
});
