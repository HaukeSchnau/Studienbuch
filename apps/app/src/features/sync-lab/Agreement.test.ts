import { describe, expect, it } from "@effect/vitest";
import { CivilTime } from "@stu/core";
import { Inspect } from "@stu/sync";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import { Agreement } from "./Agreement.ts";
import type { LabDevice } from "./LabDevice.ts";

const lena = "lena";

const space = (id: string, version: number, members: ReadonlyArray<string>): Inspect.Space => ({
  id,
  kind: "notebook",
  parent: null,
  key: null,
  version,
  keyEpoch: 0,
  members: members.map((account) => ({ account, role: "owner", grantedBy: null })),
});

const sealed = (spaceId: string, id: string, version: number): Inspect.Row => ({
  space: spaceId,
  tbl: "",
  id,
  version,
  row: Inspect.Sealed.make({ envelope: {}, bytes: 416 }),
  writtenBy: null,
});

const snapshot = (
  cursors: Record<string, number | null>,
  held: ReadonlyArray<LabDevice.Held>,
  waiting = 0,
): LabDevice.Snapshot => ({
  clientId: "client",
  lastMutationId: waiting,
  today: CivilTime.dateIn(0, CivilTime.TimeZone.make("Europe/Berlin")),
  spaces: Object.entries(cursors).map(([id, version]) => ({
    id,
    kind: "notebook",
    role: "owner",
    version,
    syncedAt: DateTime.makeUnsafe(0),
  })),
  held,
  homework: [],
  enrollment: Option.none(),
  outbox: Array.from({ length: waiting }, (_, index) => ({
    mutationId: index + 1,
    name: "homework.create",
    version: 1,
    args: {},
    at: 0,
    mode: "Seal" as const,
    writes: null,
    failure: null,
    sealed: null,
  })),
  refusals: [],
});

const server: Inspect.Response = {
  spaces: [space("n-lena", 3, [lena]), space("n-tom", 9, ["tom"])],
  rows: [
    sealed("n-lena", "h1", 2),
    sealed("n-lena", "h2", 3),
    { ...sealed("n-lena", "h0", 1), row: Inspect.Deleted.make({ envelope: null }) },
    sealed("n-tom", "t1", 9),
  ],
  commands: [],
};

const gapsOf = (device: Omit<Agreement.Device, "id" | "accountId">) =>
  Agreement.judge([{ id: "a", accountId: lena, ...device }], server)[0]?.gaps.map(
    (gap) => gap._tag,
  );

const both = [
  { space: "n-lena", id: "h1", version: 2 },
  { space: "n-lena", id: "h2", version: 3 },
];

describe("Agreement.judge", () => {
  // Tom's notebook and the tombstone don't count against Lena's device.
  it("agrees with a device that holds the live rows of its own spaces at their versions", () => {
    expect(gapsOf({ online: true, snapshot: snapshot({ "n-lena": 3 }, both) })).toEqual([]);
  });

  it("names an offline device with waiting changes", () => {
    expect(gapsOf({ online: false, snapshot: snapshot({ "n-lena": 3 }, both, 2) })).toEqual([
      "Offline",
      "Waiting",
    ]);
  });

  it("finds a device behind the server's version, or without the space at all", () => {
    expect(gapsOf({ online: true, snapshot: snapshot({ "n-lena": 2 }, both) })).toEqual(["Behind"]);
    expect(gapsOf({ online: true, snapshot: snapshot({ "n-tom": 9 }, []) })).toEqual(["Behind"]);
  });

  it("never agrees with a device that reads no space yet", () => {
    expect(gapsOf({ online: true, snapshot: snapshot({}, []) })).toEqual(["Empty"]);
  });

  it("finds rows that differ even when the cursor matches", () => {
    const stale = [both[0], { space: "n-lena", id: "h2", version: 2 }].flatMap((row) =>
      row === undefined ? [] : [row],
    );

    expect(gapsOf({ online: true, snapshot: snapshot({ "n-lena": 3 }, stale) })).toEqual([
      "Differs",
    ]);
  });
});
