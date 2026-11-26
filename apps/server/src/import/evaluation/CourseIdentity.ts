/**
 * Whether our courses are the school's, per subject. A real course is a subject and the students
 * whose own timetables show its entries in a term's opening weeks; labelled cases win over that. An
 * import splits a real course when its entries are in several of our courses, and merges real
 * courses when one of ours covers entries of several. Only entries and our lessons go in.
 */
import * as Arr from "effect/Array";
import * as Order from "effect/Order";
import { Metrics } from "./Metrics.ts";

export * as CourseIdentity from "./CourseIdentity.ts";

/** One student's entries in a term's opening weeks, on days WebUntis showed them. An entry without a subject is no course's. */
export interface Attendance {
  /** The student's token. */
  readonly student: string;
  readonly entries: ReadonlyArray<Metrics.TruthEntry>;
}

export interface Counts {
  readonly realCourses: number;
  /** Real courses whose entries are in more than one of our courses. */
  readonly split: number;
  /** Our courses that cover an entry of a real course. */
  readonly ourCourses: number;
  /** Our courses that cover entries of more than one real course. */
  readonly merged: number;
}

/**
 * What a case looks like in the timetables. A split's `one entry` is in several of our courses, as
 * a lesson of several classes is; a `spread` one's entries each sit in one, as a course booked as
 * several lessons does. A merge is `nested` when one group's students include another's, as when a
 * Kopplung shows parallel groups as one entry; else its groups are `disjoint` or `overlapping`.
 */
export const looksLike = ["one entry", "spread", "nested", "disjoint", "overlapping"] as const;

export type LooksLike = (typeof looksLike)[number];

export interface Case {
  readonly kind: "split" | "merged";
  readonly term: string;
  readonly subject: string;
  readonly looksLike: LooksLike;
  readonly realCourses: ReadonlyArray<{
    readonly students: ReadonlyArray<string>;
    /** Entries as their date and WebUntis ids, each with the indexes of the courses it is in. */
    readonly entries: ReadonlyArray<{
      readonly entry: string;
      readonly courses: ReadonlyArray<number>;
    }>;
  }>;
  readonly ourCourses: ReadonlyArray<string>;
}

export interface Measured {
  readonly total: Counts;
  readonly subjects: ReadonlyMap<string, Counts>;
  readonly cases: ReadonlyArray<Case>;
}

const keyOf = (entry: { readonly date: string; readonly ids: ReadonlyArray<number> }) =>
  `${entry.date} ${entry.ids.join("+")}`;

const subjectOf = (entry: Metrics.TruthEntry) => entry.subjects.join("+");

const sorted = (values: Iterable<string>) => Arr.sort(Arr.dedupe(values), Order.String);

const push = <K, V>(map: Map<K, Array<V>>, key: K, value: V) => {
  const values = map.get(key);

  if (values === undefined) map.set(key, [value]);
  else values.push(value);
};

const zero: Counts = { realCourses: 0, split: 0, ourCourses: 0, merged: 0 };

const add = (a: Counts, b: Counts): Counts => ({
  realCourses: a.realCourses + b.realCourses,
  split: a.split + b.split,
  ourCourses: a.ourCourses + b.ourCourses,
  merged: a.merged + b.merged,
});

const looksLikeMerged = (groups: ReadonlyArray<ReadonlySet<string>>): LooksLike => {
  const pairs = groups.flatMap((a, i) => groups.slice(i + 1).map((b) => [a, b] as const));
  const shared = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].filter((s) => b.has(s));

  const within = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
    a.size < b.size && shared(a, b).length === a.size;

  if (pairs.some(([a, b]) => within(a, b) || within(b, a))) return "nested";

  return pairs.every(([a, b]) => shared(a, b).length === 0) ? "disjoint" : "overlapping";
};

/** One term's real courses, against the store its students chose their courses from. */
export const measure = (input: {
  readonly term: string;
  readonly attendance: ReadonlyArray<Attendance>;
  readonly index: ReadonlyMap<string, ReadonlyArray<Metrics.Lesson>>;
  readonly labels: ReadonlyArray<Metrics.LabelledCourse>;
  /** The ISO week of a date, such as `2026-W45`. */
  readonly weekOf: (date: string) => string;
}): Measured => {
  // Each entry once, with the students it is shown to. An added entry is no course's.
  const shown = new Map<string, { entry: Metrics.TruthEntry; students: Set<string> }>();

  for (const { student, entries } of input.attendance) {
    for (const entry of entries.filter(
      (each) => each.status !== "Added" && each.subjects.length > 0,
    )) {
      const known = shown.get(keyOf(entry)) ?? { entry, students: new Set<string>() };

      known.students.add(student);
      shown.set(keyOf(entry), known);
    }
  }

  const rows = Arr.sort(
    [...shown].map(([key, { entry, students }]) => ({
      key,
      entry,
      students,
      subject: subjectOf(entry),
      week: input.weekOf(entry.date),
      // Subject codes can hold spaces, tokens can't, and neither holds a line break.
      group: `${subjectOf(entry)}\n${sorted(students).join(" ")}`,
      courses: sorted(Metrics.enrollment([entry], input.index)),
    })),
    Order.mapInput(Order.String, (row: { readonly key: string }) => row.key),
  );

  type Row = (typeof rows)[number];

  const keys = rows.map((row) => row.key);
  const rowOf = new Map(rows.map((row) => [row.key, row]));
  const groupOf = new Map(rows.map((row) => [row.key, row.group]));

  const keyById = new Map(
    rows.flatMap(({ key, entry }) => entry.ids.map((id) => [`${entry.date} ${id}`, key])),
  );

  const labelled = input.labels.map(({ same, entries }) => ({
    same,
    keys: Arr.dedupe(
      entries.flatMap(({ date, ids }) =>
        ids.flatMap((id) => {
          const key = keyById.get(`${date} ${id}`);

          return key === undefined ? [] : [key];
        }),
      ),
    ),
  }));

  const parent = new Map<string, string>();

  const find = (key: string): string => {
    const up = parent.get(key);

    if (up === undefined || up === key) return key;

    const root = find(up);

    parent.set(key, root);

    return root;
  };

  const join = ([first, ...rest]: ReadonlyArray<string>) => {
    if (first !== undefined) for (const key of rest) parent.set(find(key), find(first));
  };

  for (const { same, keys: named } of labelled) if (same) join(named);

  const different = labelled.flatMap((label) => (label.same ? [] : [label.keys]));

  /** Whether one course of the courses so far of `members` would hold entries a label tells apart. */
  const conflicts = (members: ReadonlyArray<string>) => {
    const roots = new Set(members.map(find));

    return different.some(
      (named) => new Set(named.map(find).filter((root) => roots.has(root))).size > 1,
    );
  };

  const byGroup = new Map<string, Array<Row>>();

  for (const row of rows) push(byGroup, row.group, row);

  // A roster that would join entries a label tells apart is split: its entries no label names
  // could be in any of its courses, so they leave the measure.
  const splitByLabel = new Set<string>();
  const whole: Array<ReadonlyArray<Row>> = [];

  for (const [group, members] of byGroup) {
    const entries = members.map((row) => row.key);

    if (conflicts(entries)) splitByLabel.add(group);
    else {
      join(entries);
      whole.push(members);
    }
  }

  // A student takes one course of a subject at a time, so two rosters of a subject that share more
  // than half of each one's students, and whose courses so far meet in different opening weeks,
  // are one course whose roster changed in between.
  const alike = (a: Row, b: Row) => {
    const shared = [...a.students].filter((student) => b.students.has(student)).length;

    return a.subject === b.subject && shared * 2 > a.students.size && shared * 2 > b.students.size;
  };

  const weeksOf = (key: string) =>
    new Set(rows.flatMap((row) => (find(row.key) === find(key) ? [row.week] : [])));

  const apart = (a: string, b: string) =>
    [...weeksOf(a)].some((week) => weeksOf(b).has(week)) || conflicts([a, b]);

  for (const [i, [a]] of whole.entries()) {
    for (const [b] of whole.slice(i + 1)) {
      if (a !== undefined && b !== undefined && alike(a, b) && !apart(a.key, b.key)) {
        join([a.key, b.key]);
      }
    }
  }

  const named = new Set(labelled.flatMap((label) => label.keys));
  const components = new Map<string, Array<string>>();

  for (const key of keys) {
    if (named.has(key) || !splitByLabel.has(groupOf.get(key) ?? ""))
      push(components, find(key), key);
  }

  const realCourses = [...components.values()].map((keysOf) => {
    const members = keysOf.flatMap((key): ReadonlyArray<Row> => {
      const row = rowOf.get(key);

      return row === undefined ? [] : [row];
    });

    return {
      subject: sorted(members.map((row) => row.subject)).join("+"),
      students: new Set(members.flatMap((row) => [...row.students])),
      members,
      courses: sorted(members.flatMap((row) => row.courses)),
    };
  });

  const held = new Map<string, Array<(typeof realCourses)[number]>>();

  for (const real of realCourses) for (const course of real.courses) push(held, course, real);

  const subjects = new Map<string, Counts>();

  const count = (subject: string, counts: Partial<Counts>) =>
    subjects.set(subject, add(subjects.get(subject) ?? zero, { ...zero, ...counts }));

  for (const real of realCourses) {
    count(real.subject, { realCourses: 1, split: real.courses.length > 1 ? 1 : 0 });
  }

  for (const reals of held.values()) {
    for (const subject of sorted(reals.map((real) => real.subject))) {
      count(subject, { ourCourses: 1, merged: reals.length > 1 ? 1 : 0 });
    }
  }

  const splitCases = realCourses.flatMap((real): ReadonlyArray<Case> =>
    real.courses.length < 2
      ? []
      : [
          {
            kind: "split",
            term: input.term,
            subject: real.subject,
            looksLike: real.members.some((row) => row.courses.length > 1) ? "one entry" : "spread",
            realCourses: [
              {
                students: sorted(real.students),
                entries: real.members.map((row) => ({
                  entry: row.key,
                  courses: row.courses.map((course) => real.courses.indexOf(course)),
                })),
              },
            ],
            ourCourses: real.courses,
          },
        ],
  );

  const mergedCases = [...held].flatMap(([course, reals]): ReadonlyArray<Case> =>
    reals.length < 2
      ? []
      : [
          {
            kind: "merged",
            term: input.term,
            subject: sorted(reals.map((real) => real.subject)).join("+"),
            looksLike: looksLikeMerged(reals.map((real) => real.students)),
            realCourses: reals.map((real) => ({
              students: sorted(real.students),
              entries: real.members
                .filter((row) => row.courses.includes(course))
                .map((row) => ({ entry: row.key, courses: [0] })),
            })),
            ourCourses: [course],
          },
        ],
  );

  return {
    total: {
      realCourses: realCourses.length,
      split: splitCases.length,
      ourCourses: held.size,
      merged: mergedCases.length,
    },
    subjects,
    cases: [...splitCases, ...mergedCases],
  };
};

/** How many pieces a case has: our courses for a split, real courses for a merge. */
const pieces = (each: Case) =>
  each.kind === "split" ? each.ourCourses.length : each.realCourses.length;

const entryCount = (each: Case) =>
  each.realCourses.reduce((total, real) => total + real.entries.length, 0);

const worstFirst = Order.combineAll<Case>([
  Order.flip(Order.mapInput(Order.Number, pieces)),
  Order.flip(Order.mapInput(Order.Number, entryCount)),
  Order.mapInput(Order.String, (each) => each.term),
  Order.mapInput(Order.String, (each) => each.realCourses[0]?.entries[0]?.entry ?? ""),
]);

/** Every term's counts added up, by subject in code order, and each subject's `worst` cases. */
export const combine = (terms: ReadonlyArray<Measured>, worst = 5) => {
  const bySubject = new Map<string, Counts>();

  for (const term of terms) {
    for (const [subject, counts] of term.subjects) {
      bySubject.set(subject, add(bySubject.get(subject) ?? zero, counts));
    }
  }

  const cases = new Map<string, Array<Case>>();

  for (const each of terms.flatMap((term) => term.cases)) push(cases, each.subject, each);

  const subjectOrder = sorted([...bySubject.keys(), ...cases.keys()]);

  return {
    counts: {
      ...terms.map((term) => term.total).reduce(add, zero),
      subjects: Object.fromEntries(
        subjectOrder.flatMap((subject) => {
          const counts = bySubject.get(subject);

          return counts === undefined ? [] : [[subject, counts]];
        }),
      ),
    },
    cases: subjectOrder.flatMap((subject) =>
      Arr.sort(cases.get(subject) ?? [], worstFirst).slice(0, worst),
    ),
  };
};
