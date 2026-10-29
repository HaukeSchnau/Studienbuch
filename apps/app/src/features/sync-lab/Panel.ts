import type { Inspect } from "@stu/sync";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { LabAccounts } from "./LabAccounts.ts";
import { LabDevice } from "./LabDevice.ts";

// What the server panel shows: the server's spaces, its command log and the rows of each notebook,
// named the way the Lab names its devices. Next to each encrypted row it puts the plaintext the
// devices show for it, which only the devices have.

export * as Panel from "./Panel.ts";

/** One device as the panel knows it: who it plays, and what it holds once its engine ran. */
export interface Device {
  readonly id: LabDevice.Id;
  readonly accountId: string | undefined;
  readonly snapshot: LabDevice.Snapshot | undefined;
}

export interface Space {
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

export interface Command {
  readonly key: string;
  /** "A", or "?" for a client no device of the Lab has. */
  readonly device: string;
  readonly mutationId: number;
  /** The mutator, or where a `Seal` wrote. */
  readonly what: string;
  /** `null` once applied, the refusal's tag otherwise. */
  readonly refusal: string | null;
}

export interface Row {
  readonly key: string;
  readonly version: number;
  readonly id: string;
  /** "416 B" for ciphertext, the JSON for a readable row, "gelöscht" for a tombstone. */
  readonly stored: string;
  readonly sealed: boolean;
  /** What the devices show for the row: their letters and its title. */
  readonly seen: ReadonlyArray<{ readonly devices: string; readonly text: string }>;
}

export interface Notebook {
  readonly space: Space;
  readonly rows: ReadonlyArray<Row>;
}

export interface View {
  readonly spaces: ReadonlyArray<Space>;
  readonly commands: ReadonlyArray<Command>;
  readonly notebooks: ReadonlyArray<Notebook>;
}

const letter = (id: LabDevice.Id) => id.toUpperCase();

const short = (id: string) => (id.length > 12 ? `${id.slice(0, 8)}…` : id);

/** A readable row in one line: a key box alone runs to hundreds of characters. */
const brief = (text: string) => (text.length > 90 ? `${text.slice(0, 89)}…` : text);

/** A space's name by its kind and its members: "Notizbuch Lena", "Schule", "Kurs ma-1". */
const nameOf = (space: Inspect.Space, devices: ReadonlyArray<Device>) => {
  if (space.kind === "notebook") {
    const owner = devices.find((device) =>
      space.members.some((member) => member.account === device.accountId),
    );

    return owner === undefined
      ? `Notizbuch ${short(space.id)}`
      : `Notizbuch ${LabAccounts.names[LabDevice.specs[owner.id].persona]}`;
  }

  if (space.kind === "school") return "Schule";

  return `Kurs ${space.key ?? short(space.id)}`;
};

/** The part of a `Seal`'s detail the panel shows: where its writes went (`Inspect.Processed`). */
const decodeSealDetail = Schema.decodeUnknownOption(
  Schema.Struct({ writes: Schema.Array(Schema.Struct({ space: Schema.String })) }),
);

export const describe = (response: Inspect.Response, devices: ReadonlyArray<Device>): View => {
  const named = new Map(
    response.spaces.map((space) => [
      space.id,
      { id: space.id, name: nameOf(space, devices), version: space.version },
    ]),
  );

  const clients = new Map(
    devices.flatMap((device) =>
      device.snapshot === undefined ? [] : [[device.snapshot.clientId, letter(device.id)] as const],
    ),
  );

  const commands = [...response.commands]
    .sort((a, b) => DateTime.toEpochMillis(b.processedAt) - DateTime.toEpochMillis(a.processedAt))
    .map((command): Command => {
      const into =
        command.kind === "Seal"
          ? Option.getOrUndefined(
              Option.flatMap(decodeSealDetail(command.detail), (detail) =>
                Option.fromNullishOr(detail.writes[0]?.space),
              ),
            )
          : undefined;

      return {
        key: `${command.clientId} ${command.mutationId}`,
        device: clients.get(command.clientId) ?? "?",
        mutationId: command.mutationId,
        what:
          command.kind === "Seal"
            ? `Seal → ${into === undefined ? "" : (named.get(into)?.name ?? short(into))}`
            : (command.name ?? ""),
        refusal: command.reason?._tag ?? null,
      };
    });

  const seenBy = (row: Inspect.Row) => {
    const titles = new Map<string, Array<string>>();

    for (const device of devices) {
      const shown = device.snapshot?.homework.find(
        (homework) => homework.space === row.space && homework.id === row.id,
      );

      if (shown !== undefined) {
        titles.set(shown.title, [...(titles.get(shown.title) ?? []), letter(device.id)]);
      }
    }

    return [...titles].map(([text, letters]) => ({ devices: letters.join(", "), text }));
  };

  const kinds = new Map(response.spaces.map((space) => [space.id, space.kind]));

  const notebooks = [...named.values()].flatMap((space) =>
    kinds.get(space.id) !== "notebook"
      ? []
      : [
          {
            space,
            rows: response.rows
              .filter((row) => row.space === space.id)
              .sort((a, b) => b.version - a.version)
              .map((row): Row => ({
                key: `${row.space} ${row.tbl} ${row.id}`,
                version: row.version,
                id: short(row.id),
                stored:
                  row.row._tag === "Sealed"
                    ? `${row.row.bytes} B`
                    : row.row._tag === "Readable"
                      ? brief(`${row.tbl} ${JSON.stringify(row.row.data)}`)
                      : "gelöscht",
                sealed: row.row._tag === "Sealed",
                seen: seenBy(row),
              })),
          },
        ],
  );

  // Notebooks first, then the school, then the courses, as the panes list them.
  const ranks = new Map([
    ["notebook", 0],
    ["school", 1],
  ]);

  const rank = (id: string) => ranks.get(kinds.get(id) ?? "") ?? 2;

  const spaces = [...named.values()].sort(
    (a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, "de"),
  );

  return { spaces, commands, notebooks };
};
