import type { Inspect } from "@stu/sync";
import * as Data from "effect/Data";

import type { LabDevice } from "./LabDevice.ts";

// Whether the Lab's devices agree with the server, which turns its bar green. A device agrees when
// it is online with an empty outbox, reads a space, and of every space the Lab asked about whose
// member the server lists it as, holds exactly the server's rows at the server's versions.

export * as Agreement from "./Agreement.ts";

export interface Device {
  readonly id: LabDevice.Id;
  readonly accountId: string;
  readonly online: boolean;
  readonly snapshot: LabDevice.Snapshot;
}

export type Gap = Data.TaggedEnum<{
  Offline: {};
  /** The device reads no space yet, so it can't agree with anything. */
  Empty: {};
  Waiting: { readonly commands: number };
  /** The device hasn't pulled the space's newest rows, or doesn't read it yet. */
  Behind: { readonly space: string };
  /** The device's cursor matches the server, but its rows don't. */
  Differs: { readonly space: string };
}>;

export const Gap = Data.taggedEnum<Gap>();

export interface Judged {
  readonly id: LabDevice.Id;
  readonly gaps: ReadonlyArray<Gap>;
}

const rowKeys = (rows: ReadonlyArray<{ readonly id: string; readonly version: number }>) =>
  rows
    .map((row) => `${row.id}@${row.version}`)
    .sort()
    .join(" ");

/** What keeps each device from agreeing with the server, none for a device that agrees. */
export const judge = (
  devices: ReadonlyArray<Device>,
  server: Inspect.Response,
): ReadonlyArray<Judged> =>
  devices.map(({ id, accountId, online, snapshot }) => {
    const gaps: Array<Gap> = [];

    if (!online) gaps.push(Gap.Offline());

    if (snapshot.outbox.length > 0) gaps.push(Gap.Waiting({ commands: snapshot.outbox.length }));

    if (snapshot.spaces.length === 0) return { id, gaps: [...gaps, Gap.Empty()] };

    const cursors = new Map(snapshot.spaces.map((space) => [space.id, space.version ?? 0]));

    for (const space of server.spaces) {
      if (!space.members.some((member) => member.account === accountId)) continue;

      const live = server.rows.filter(
        (row) => row.space === space.id && row.row._tag !== "Deleted",
      );

      const held = snapshot.held.filter((row) => row.space === space.id);

      if (cursors.get(space.id) !== space.version) {
        gaps.push(Gap.Behind({ space: space.id }));
      } else if (rowKeys(live) !== rowKeys(held)) {
        gaps.push(Gap.Differs({ space: space.id }));
      }
    }

    return { id, gaps };
  });
