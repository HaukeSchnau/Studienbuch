import {
  CivilTime,
  Course,
  CourseOffering,
  Enrollment,
  Notebook,
  NotebookProfile,
  School,
  SchoolClass,
  Subject,
  Term,
} from "@stu/core";
import { DeviceDatabase, DeviceSchema, SyncClient } from "@stu/sync/client";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import * as Struct from "effect/Struct";

import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Schema as Device } from "../../infra/sqlite/Schema.ts";
import { Onboarding } from "./Onboarding.ts";

// The first start as atoms for its screen, on the account's engine: what the device holds of the
// notebook and its school, the answers typed so far, and the two writes that finish it.

export * as OnboardingState from "./OnboardingState.ts";

// The drafts live in the account's own database, encrypted at rest on phones; on the web the
// account database is plain OPFS, like every decrypted row. A public computer keeps it in memory,
// and sign-out deletes it with the account.
const runtime = Atom.family((accountId: string) =>
  Atom.runtime(KeyValueStore.layerSql().pipe(Layer.provideMerge(AccountEngine.app(accountId)))),
);

const decode = {
  notebook: DeviceSchema.decodeView(Notebook.Row),
  profile: DeviceSchema.decodeView(NotebookProfile.Row),
  school: DeviceSchema.decodeView(School.Row),
  term: DeviceSchema.decodeView(Term.Row),
  schoolClass: DeviceSchema.decodeView(SchoolClass.Row),
  offering: DeviceSchema.decodeView(CourseOffering.Row),
  course: DeviceSchema.decodeView(Course.Row),
  subject: DeviceSchema.decodeView(Subject.Row),
  enrollment: DeviceSchema.decodeView(Enrollment.Row),
};

/** A view's row without the place it's kept, as core's row types have it. */
const fields = <A extends { readonly space: string; readonly id: string }>(row: A) =>
  Struct.omit(row, ["space", "id"]);

/** The device holds a handful of rows per table here, so each is read whole and picked in memory. */
const read = Effect.gen(function* () {
  const db = yield* DeviceDatabase.make;

  const [notebook] = yield* Effect.flatMap(db.select().from(Device.Notebook), decode.notebook);
  const spaces = yield* SyncClient.spaces.run();

  // Until the notebook's and the school's first rows arrived, an answer could only be a guess.
  const pulled = (kind: string, id?: string) =>
    spaces.some(
      (space) =>
        space.kind === kind && space.version !== null && (id === undefined || space.id === id),
    );

  if (notebook === undefined) {
    return pulled(Notebook.Space.name) ? waiting : noSchool;
  }

  const school = notebook.schoolId;

  if (!pulled(School.Space.name, school)) return waiting;

  const inSchool = <A extends { readonly space: string }>(rows: ReadonlyArray<A>) =>
    rows.filter((row) => row.space === school);

  const [schoolRow] = inSchool(
    yield* Effect.flatMap(db.select().from(Device.School), decode.school),
  );

  const profile = (yield* Effect.flatMap(
    db.select().from(Device.NotebookProfile),
    decode.profile,
  )).find((row) => row.space === notebook.id);

  const today = CivilTime.dateIn(
    yield* Clock.currentTimeMillis,
    schoolRow?.timeZone ?? CivilTime.TimeZone.make("Europe/Berlin"),
  );

  const terms = inSchool(yield* Effect.flatMap(db.select().from(Device.Term), decode.term));

  const term = Term.containing(
    terms.map((row) => ({ id: row.id, row: fields(row) })),
    today,
  );

  const choices = Option.isNone(term)
    ? Option.none<Onboarding.TermChoices>()
    : Option.some<Onboarding.TermChoices>({
        id: Term.Id.make(term.value.id),
        classes: inSchool(
          yield* Effect.flatMap(db.select().from(Device.SchoolClass), decode.schoolClass),
        ).flatMap((row) =>
          row.schoolYearId === term.value.row.schoolYearId
            ? [{ ...fields(row), id: SchoolClass.Id.make(row.id) }]
            : [],
        ),
        offerings: inSchool(
          yield* Effect.flatMap(db.select().from(Device.CourseOffering), decode.offering),
        ).flatMap((row) => (row.termId === term.value.id ? [fields(row)] : [])),
        courses: new Map(
          inSchool(yield* Effect.flatMap(db.select().from(Device.Course), decode.course)).map(
            (row) => [row.id, fields(row)],
          ),
        ),
        subjects: new Map(
          inSchool(yield* Effect.flatMap(db.select().from(Device.Subject), decode.subject)).map(
            (row) => [row.id, fields(row)],
          ),
        ),
        enrollment: Option.fromNullishOr(
          (yield* Effect.flatMap(db.select().from(Device.Enrollment), decode.enrollment)).find(
            (row) => row.space === notebook.id && row.id === term.value.id,
          ),
        ),
      });

  const refused = (yield* SyncClient.refusals.run())
    .filter((refusal) => refusal.name === Enrollment.set.name)
    .sort((a, b) => b.mutationId - a.mutationId)[0];

  return Onboarding.Reading.Ready({
    snapshot: {
      id: Notebook.Id.make(notebook.id),
      schoolName: schoolRow?.name ?? "",
      profile: { displayName: profile?.displayName, adult: profile?.adult },
      term: choices,
      refused: Option.fromNullishOr(refused),
    },
  });
});

const waiting = Onboarding.Reading.Waiting();

const noSchool = Onboarding.Reading.NoSchool();

const tables = [
  Notebook.Row,
  NotebookProfile.Row,
  School.Row,
  Term.Row,
  SchoolClass.Row,
  CourseOffering.Row,
  Course.Row,
  Subject.Row,
  Enrollment.Row,
];

// The tables it reads, and the engine's own, which change as a pull or a refusal arrives.
const keys = [...Object.values(SyncClient.keys), ...tables.map((table) => table.name)];

/** What the first start needs, again after every write, pull and rebase. */
export const reading = Atom.family((accountId: string) =>
  runtime(accountId).atom(
    Reactivity.stream(
      Effect.flatMap(SqlClient.SqlClient, (sql) => sql.withTransaction(read)).pipe(
        Effect.catchTags({ SchemaError: Effect.die }),
      ),
      keys,
    ),
  ),
);

/** The answers typed so far. `null` where the student hasn't answered, so the notebook's own shows. */
export const Draft = Schema.Struct({
  step: Schema.NullOr(Schema.Literals(["who", "courses"])),
  name: Schema.NullOr(Schema.String),
  adult: Schema.NullOr(Schema.Boolean),
  gradeLevel: Schema.NullOr(Schema.Int),
  classId: Schema.NullOr(Schema.String),
  chosen: Schema.NullOr(Schema.Array(Schema.String)),
});

export type Draft = typeof Draft.Type;

export const emptyDraft: Draft = {
  step: null,
  name: null,
  adult: null,
  gradeLevel: null,
  classId: null,
  chosen: null,
};

/** The draft of the first start, kept across a reload or a restart until it finishes. */
export const draft = Atom.family((accountId: string) =>
  Atom.kvs({
    runtime: runtime(accountId),
    key: "onboarding-draft",
    schema: Draft,
    defaultValue: () => emptyDraft,
    mode: "async",
  }),
);

/** The answers of both steps. Without a term today there is no course choice to write. */
export interface Answers {
  readonly notebook: Notebook.Id;
  readonly displayName: NotebookProfile.DisplayName;
  readonly adult: boolean;
  readonly choice: Option.Option<typeof Enrollment.set.args.Type>;
  /** The refusal the course step showed, which this choice answers. */
  readonly refused: Option.Option<Onboarding.Refused>;
}

/**
 * Writes the course choice, then the profile, on this device first; the engine sends both when it
 * can. The profile goes last, so a refused choice leaves the student in the first start. The draft
 * goes once the gate reads both, so the first step never shows again in between. It runs on while
 * the screen gives way to the tabs.
 */
export const finish = Atom.family((accountId: string) =>
  runtime(accountId)
    .fn<Answers>()((answers, get) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;

        if (Option.isSome(answers.refused)) yield* sync.dismiss(answers.refused.value);

        if (Option.isSome(answers.choice)) yield* sync.mutate(Enrollment.set, answers.choice.value);

        yield* sync.mutate(NotebookProfile.set, {
          notebook: answers.notebook,
          displayName: answers.displayName,
          adult: answers.adult,
        });

        yield* get.streamResult(reading(accountId)).pipe(
          Stream.filter((now) => Onboarding.next(now) === "done"),
          Stream.runHead,
        );

        get.set(draft(accountId), emptyDraft);
      }),
    )
    .pipe(Atom.keepAlive),
);
