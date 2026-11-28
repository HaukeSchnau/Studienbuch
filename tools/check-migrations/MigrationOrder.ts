// Migrations apply in name order, and a name starts with drizzle-kit's timestamp. A database that
// applied main's newest migration and then meets an older name applies it out of order, and a
// release without it then fails `prepare` there (Migrations.HistoryMismatch).
const NAME = /^(?<stamp>\d{14})_(?<rest>.+)$/u;

/** The name's timestamp in seconds and the rest of the name, or null without a valid timestamp. */
function parse(name: string) {
  const { stamp, rest } = NAME.exec(name)?.groups ?? {};

  if (stamp === undefined || rest === undefined) return null;

  const at = Date.parse(
    `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12)}Z`,
  );

  return Number.isNaN(at) ? null : { seconds: at / 1000, rest };
}

const stampOf = (seconds: number) =>
  new Date(seconds * 1000).toISOString().replaceAll(/\D/gu, "").slice(0, 14);

export interface Late {
  readonly name: string;
  /** A name after main's newest that keeps this tree's order, or null when the name has no stamp. */
  readonly rename: string | null;
}

/**
 * The migrations this tree adds to main's that sort before main's newest, each with a name to
 * rename it to. One that sorts after main's newest stays, unless a renamed one before it would then
 * sort after it.
 */
export function late(local: ReadonlyArray<string>, main: ReadonlyArray<string>) {
  const onMain = new Set(main);
  const newest = main.toSorted().at(-1) ?? null;
  const added = local.filter((name) => !onMain.has(name)).toSorted();
  const renamed: Array<Late> = [];

  if (newest === null) return { newest, late: renamed };

  let floor = newest;

  for (const name of added) {
    if (name > floor) {
      floor = name;
      continue;
    }

    const before = parse(floor);
    const own = parse(name);

    if (before === null || own === null) {
      renamed.push({ name, rename: null });
      continue;
    }

    floor = `${stampOf(before.seconds + 1)}_${own.rest}`;
    renamed.push({ name, rename: floor });
  }

  return { newest, late: renamed };
}

export * as MigrationOrder from "./MigrationOrder.ts";
