import { describe, expect, it } from "@effect/vitest";
import { findMigrationHistoryMismatch } from "./migrate.ts";

describe("migration history", () => {
  const local = [
    { name: "20260828120000_first", hash: "first-hash" },
    { name: "20260828130000_second", hash: "second-hash" },
  ];

  it("accepts applied migrations whose names and hashes match", () => {
    expect(findMigrationHistoryMismatch(local, local)).toBeUndefined();
  });

  it("rejects an edited applied migration", () => {
    expect(
      findMigrationHistoryMismatch(local, [
        { name: "20260828120000_first", hash: "previous-hash" },
      ]),
    ).toEqual({
      name: "20260828120000_first",
      appliedHash: "previous-hash",
      localHash: "first-hash",
    });
  });

  it("rejects a deleted applied migration", () => {
    expect(
      findMigrationHistoryMismatch(local, [
        { name: "20260828110000_deleted", hash: "deleted-hash" },
      ]),
    ).toEqual({
      name: "20260828110000_deleted",
      appliedHash: "deleted-hash",
      localHash: null,
    });
  });
});
