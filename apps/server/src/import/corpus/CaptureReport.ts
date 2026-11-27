/**
 * What a person looks at before a corpus is pushed (m2-import-corpus.md, section 4, check 3): one
 * class week, one teacher week and one student week as the harness sees them, and every phrase and
 * word the pseudonymizer kept. It reads the pseudonymized corpus only, so it shows tokens.
 */
import { TimetableEntriesSchema, type TimetableEntry } from "@schnau/webuntis-api/schemas";
import { CivilTime } from "@stu/core";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import type { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { WebUntisEntry } from "../WebUntisEntry.ts";
import type { Corpus } from "./Corpus.ts";

export * as CaptureReport from "./CaptureReport.ts";

const decodeEntries = Schema.decodeUnknownOption(TimetableEntriesSchema);
const decodeDate = Schema.decodeEffect(CivilTime.PlainDate);
const encodeDate = Schema.encodeEffect(CivilTime.PlainDate);

const shown = ["CLASS", "TEACHER", "STUDENT"] as const;

interface Lesson {
  readonly date: string;
  readonly entry: TimetableEntry;
}

/** The lessons of one view in `week`, from the last version that holds each day. */
const lessonsIn = (read: RecordedWebUntis.Read, week: ReadonlySet<string>) => {
  const byDay = new Map<string, ReadonlyArray<TimetableEntry>>();

  for (const version of read.versions) {
    const decoded = decodeEntries(version.body);

    if (Option.isNone(decoded)) continue;

    for (const day of decoded.value.days) {
      const date = day.date.slice(0, 10);

      if (week.has(date)) byDay.set(date, [...day.dayEntries, ...day.gridEntries]);
    }
  }

  return [...byDay]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .flatMap(([date, entries]): Array<Lesson> =>
      entries
        .toSorted((a, b) => a.duration.start.localeCompare(b.duration.start))
        .map((entry) => ({ date, entry })),
    );
};

/** `08:00` from `08:00` or `2026-11-04T08:00`, the two shapes WebUntis writes a time in. */
const clock = (text: string) => /\d{2}:\d{2}/u.exec(text)?.[0] ?? text;

const line = ({ date, entry }: Lesson) => {
  const resources = ["SUBJECT", "TEACHER", "ROOM", "CLASS"].map((type) => {
    const { current, removed } = WebUntisEntry.names(entry, type);
    const was = removed.length === 0 ? "" : ` (was ${removed.join(", ")})`;

    return `${current.join(", ") || "-"}${was}`;
  });

  const texts = [
    entry.substitutionText,
    entry.lessonText,
    entry.notesAll,
    entry.lessonInfo,
  ].flatMap((text) =>
    text === null || text === undefined || text.trim() === "" ? [] : [`"${text}"`],
  );

  return `| ${date} | ${clock(entry.duration.start)}-${clock(entry.duration.end)} | ${resources.join(" | ")} | ${entry.status} | ${texts.join(" ")} |`;
};

/** The school days of the last full week before the capture, as its lessons were then. */
const weekBefore = Effect.fn("CaptureReport.weekBefore")(function* (manifest: Corpus.Manifest) {
  const captured = yield* decodeDate(DateTime.formatIsoDate(manifest.capturedAt));
  const monday = CivilTime.addDays(captured, 1 - CivilTime.dayOfWeek(captured) - 7);

  return yield* Effect.forEach([0, 1, 2, 3, 4], (offset) =>
    encodeDate(CivilTime.addDays(monday, offset)),
  );
});

export const make = Effect.fn("CaptureReport.make")(function* <E, R>(input: {
  readonly manifest: Corpus.Manifest;
  readonly reads: Stream.Stream<readonly [string, RecordedWebUntis.Read], E, R>;
}) {
  const week = yield* weekBefore(input.manifest);
  const days = new Set(week);

  const busiest = new Map<
    string,
    { readonly read: string; readonly lessons: ReadonlyArray<Lesson> }
  >();

  yield* Stream.runForEach(input.reads, ([name, read]) =>
    Effect.sync(() => {
      const type = shown.find((each) => name.includes(`/entries/${each}/`));

      if (type === undefined) return;

      const lessons = lessonsIn(read, days);
      const best = busiest.get(type);

      if (lessons.length > (best?.lessons.length ?? 0)) busiest.set(type, { read: name, lessons });
    }),
  );

  const counted = (title: string, values: ReadonlyArray<{ value: string; count: number }>) => [
    `## ${title} (${values.length})`,
    "",
    ...values.map(({ value, count }) => `- ${count} × \`${value}\``),
    "",
  ];

  return [
    `# Capture ${input.manifest.id}`,
    "",
    `Captured ${DateTime.formatIso(input.manifest.capturedAt)}, policy ${input.manifest.policy}, ${input.manifest.requests ?? 0} requests, ${input.manifest.decodeFailures ?? 0} bodies webuntis-api couldn't decode.`,
    `Days: ${input.manifest.ranges.map(({ start, end }) => `${start}..${end}`).join(", ")}.`,
    "",
    ...shown.flatMap((type) => {
      const best = busiest.get(type);

      return [
        `## One ${type.toLowerCase()} week, ${week[0]} to ${week[4]}`,
        "",
        best === undefined
          ? "No view of this kind has lessons that week."
          : `\`${best.read}\`, the busiest view of its kind that week.`,
        "",
        "| Day | Time | Subject | Teacher | Room | Class | Status | Texts |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ...(best?.lessons.map(line) ?? []),
        "",
      ];
    }),
    ...counted("Kept phrases", input.manifest.kept?.phrases ?? []),
    ...counted("Kept vocabulary", input.manifest.kept?.vocabulary ?? []),
  ].join("\n");
});
