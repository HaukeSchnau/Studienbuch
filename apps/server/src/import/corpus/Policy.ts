/**
 * What may leave a raw WebUntis read, field by field (m2-import-corpus.md, section 4). Every
 * field of every read has a rule, and a field without one is a problem, so a field WebUntis adds
 * later stops the capture instead of being copied. The pseudonymizer and the checks walk the same
 * rules, each with its own handlers.
 */
import {
  AppDataSchema,
  ExamsSchema,
  SchoolyearSchema,
  TimeGridSchema,
  TimetableEntriesSchema,
  TimetableFilterSchema,
} from "@schnau/webuntis-api/schemas";
import * as Data from "effect/Data";
import * as Exit from "effect/Exit";
import * as Predicate from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import type { Tokens } from "./Tokens.ts";

export * as Policy from "./Policy.ts";

/** Bumped whenever a rule changes what a corpus may hold. */
export const version = 2;

export type Json = Schema.Json;

export type JsonObject = { readonly [key: string]: Json };

/** What a value at one path becomes. */
export type Leaf = Data.TaggedEnum<{
  /** Copied as it is. A string joins the manifest's vocabulary unless it is a date or time. */
  Keep: {};
  /** Removed. */
  Drop: {};
  /**
   * Replaced by a fixed value, for a personal field a schema requires. With `names`, the field's
   * words join the dictionary the leak scan looks for, as an email address's do.
   */
  Constant: { readonly value: Json; readonly names?: boolean };
  /** Free text: kept if it is a stock or frequent phrase, else a token with its length. */
  Text: {};
  /** A room name: kept if it looks like a room number, else a token. */
  Room: {};
  /**
   * A class or course code, kept, with any segment that is a teacher's short name or another
   * person's name word tokenized, even where a subject's code spells a student's name.
   */
  Code: {};
  /** A person's numeric id. */
  PersonId: { readonly kind: Tokens.Person };
  /** A person's name, tokenized by the id beside it, or by the short name when there is none. */
  PersonName: { readonly kind: Tokens.Person; readonly by: "id" | "shortName" };
}>;

export const Leaf = Data.taggedEnum<Leaf>();

/**
 * Whose rules a walk follows: the corpus's, which agents read, or the source store's, which keeps a
 * run's reads on the server (m2-import-path.md, section 3).
 */
export type Column = "corpus" | "store";

/**
 * An object: the rule for each field, which may depend on its kept fields such as `type`, and on
 * the column.
 */
export class Fields extends Data.TaggedClass("Fields")<{
  readonly fields: (value: JsonObject, column: Column) => Readonly<Record<string, Node>>;
}> {}

/** A list whose items all follow one rule. */
export class List extends Data.TaggedClass("List")<{ readonly items: Node }> {}

export type Node = Leaf | Fields | List;

/** Where a value broke the rules and how, never what it was. */
export class Problem extends Data.Class<{
  /** The field's path with list indexes left out, such as `days[].gridEntries[].moved`. */
  readonly path: string;
  readonly problem: string;
}> {}

/**
 * Each pass decides what a leaf becomes, or fails it with a problem. `dropped` leaves the field
 * out. A pass follows the corpus's column unless it names another.
 */
export interface Handlers {
  readonly column?: Column;
  readonly leaf: (
    leaf: Leaf,
    value: Json,
    context: { readonly path: string; readonly ancestors: ReadonlyArray<JsonObject> },
  ) => Result.Result<Json | typeof dropped, string>;
}

export const dropped: unique symbol = Symbol("Policy.dropped");

/** The problem of a field the rules don't name, which the store drops and counts as drift. */
export const withoutRule = "a field without a rule";

/** Problems of many reads, counted by read kind, path and problem, never by value. */
export interface Tally {
  readonly add: (
    read: string,
    problems: ReadonlyArray<{ readonly path: string; readonly problem: string }>,
  ) => void;
  readonly list: () => ReadonlyArray<{
    readonly read: string;
    readonly path: string;
    readonly problem: string;
    readonly count: number;
  }>;
}

const knownKind =
  /^(?:manifest|cases|ids|layout|schoolyears|app-data|timegrid|<year>\/(?:filter-(?:CLASS|TEACHER|SUBJECT|ROOM|STUDENT)|entries\/(?:CLASS|TEACHER|SUBJECT|ROOM|STUDENT)\/<id>|exams))$/u;

/**
 * A read's path with its year and resource id left out, such as `<year>/entries/TEACHER/<id>`. A
 * path of another shape could hold anything, so it isn't shown.
 */
export const readKind = (read: string) => {
  const kind = read.replace(/^\d+\//u, "<year>/").replace(/\/\d+$/u, "/<id>");

  return knownKind.test(kind) ? kind : "<unknown read>";
};

/** A key WebUntis's API would use. Any other key could be a name, so a problem doesn't show it. */
const fieldName = /^[a-z][A-Za-z0-9]{0,39}$/u;

export const tally = (): Tally => {
  const counted = new Map<string, { read: string; path: string; problem: string; count: number }>();

  return {
    add: (read, problems) => {
      for (const { path, problem } of problems) {
        const kind = readKind(read);
        const key = `${kind}\u0000${path}\u0000${problem}`;
        const known = counted.get(key);

        if (known === undefined) counted.set(key, { read: kind, path, problem, count: 1 });
        else known.count += 1;
      }
    },
    list: () =>
      [...counted.values()].toSorted(
        (a, b) => a.read.localeCompare(b.read) || a.path.localeCompare(b.path),
      ),
  };
};

/** Tallied problems as lines for a person, one per read kind, path and problem. */
export const describe = (
  problems: ReadonlyArray<{
    readonly read: string;
    readonly path: string;
    readonly problem: string;
    readonly count: number;
  }>,
) =>
  problems
    .map(
      ({ read, path, problem, count }) =>
        `\n  ${read}${path === "" ? "" : ` ${path}`}: ${problem} (${count}×)`,
    )
    .join("");

/** A JSON object, as opposed to a list, a string, a number, a boolean or `null`. */
export const isObject = (value: Json | undefined): value is JsonObject => Predicate.isObject(value);

export interface Walked {
  readonly value: Json;
  readonly problems: ReadonlyArray<Problem>;
}

/**
 * Walks `value` by `node`, gives every leaf to `handlers` and returns what they make of it. Every
 * problem is collected, so one run reports them all.
 */
export const walk = (node: Node, value: Json, handlers: Handlers): Walked => {
  const problems: Array<Problem> = [];

  const go = (
    current: Node,
    input: Json,
    path: string,
    ancestors: ReadonlyArray<JsonObject>,
  ): Json | typeof dropped => {
    if (current instanceof Fields) {
      // A missing object is `null` in WebUntis's JSON, and nothing personal.
      if (input === null) return null;

      if (!isObject(input)) {
        problems.push(new Problem({ path, problem: "expected an object" }));

        return null;
      }

      const fields = current.fields(input, handlers.column ?? "corpus");
      const inner = [input, ...ancestors];
      const out: Record<string, Json> = {};

      for (const [key, field] of Object.entries(input)) {
        const rule = Object.hasOwn(fields, key) ? fields[key] : undefined;
        const at = path === "" ? key : `${path}.${key}`;

        if (rule === undefined) {
          const shown = fieldName.test(key) ? key : "<unknown>";

          problems.push(
            new Problem({
              path: path === "" ? shown : `${path}.${shown}`,
              problem: withoutRule,
            }),
          );

          continue;
        }

        const result = go(rule, field, at, inner);

        if (result !== dropped) out[key] = result;
      }

      return out;
    }

    if (current instanceof List) {
      if (input === null) return null;

      if (!Array.isArray(input)) {
        problems.push(new Problem({ path, problem: "expected a list" }));

        return null;
      }

      return input.map((item: Json) => {
        const result = go(current.items, item, `${path}[]`, ancestors);

        return result === dropped ? null : result;
      });
    }

    const result = handlers.leaf(current, input, { path, ancestors });

    if (Result.isFailure(result)) {
      problems.push(new Problem({ path, problem: result.failure }));

      return null;
    }

    return result.success;
  };

  const result = go(node, value, "", []);

  return { value: result === dropped ? null : result, problems };
};

const keep = Leaf.Keep();
const drop = Leaf.Drop();
const text = Leaf.Text();
const room = Leaf.Room();
const code = Leaf.Code();
const constant = (value: Json) => Leaf.Constant({ value });
const array = (items: Node) => new List({ items });
const object = (fields: Readonly<Record<string, Node>>) => new Fields({ fields: () => fields });

const resource = (names: Leaf, id: Leaf = keep, more: Readonly<Record<string, Node>> = {}) =>
  object({ id, shortName: names, longName: names, displayName: names, ...more });

/** A teacher, student or other person: the id is keyed, every name becomes the id's token. */
const person = (kind: Tokens.Person, more: Readonly<Record<string, Node>> = {}) =>
  resource(Leaf.PersonName({ kind, by: "id" }), Leaf.PersonId({ kind }), more);

/**
 * A class, department or other resource without a person. Schools name some after their teachers,
 * such as a class long-named `ABC/DEF`, so its names are codes.
 */
const plain = resource(code);
const range = object({ start: keep, end: keep });

/** The rules for a resource of each of WebUntis's timetable resource types. */
const kinds = new Map<Json, Node>([
  ["CLASS", plain],
  ["TEACHER", person("T")],
  ["SUBJECT", resource(code)],
  ["ROOM", resource(room)],
  ["STUDENT", person("S")],
]);

const byType = (type: Json | undefined): Node | undefined =>
  type === undefined ? undefined : kinds.get(type);

/** A field that names an unknown kind gets no rules, so each of its fields is a problem. */
const unknownKind: Node = object({});

/** A field seen only as `null` so far: any field inside it is a problem until it has a rule. */
const unseen: Node = object({});

const schoolYear = object({
  id: keep,
  name: keep,
  dateRange: range,
  timeGrid: object({
    schoolyearId: keep,
    units: array(object({ unitOfDay: keep, startTime: keep, endTime: keep })),
  }),
});

const user = object({
  id: Leaf.PersonId({ kind: "P" }),
  // A code, as the school's name is: a student can be named like either.
  locale: code,
  name: Leaf.PersonName({ kind: "P", by: "id" }),
  email: Leaf.Constant({ value: null, names: true }),
  permissions: object({ views: array(keep) }),
  person: person("P", { imageUrl: constant(null) }),
  roles: array(keep),
  students: drop,
  lastLogin: drop,
});

const appData = object({
  departments: drop,
  currentSchoolYear: schoolYear,
  tenant: object({ displayName: code, id: keep, name: code, wuHostName: keep }),
  user,
  permissions: array(keep),
  // `key:value` texts, which can hold an email address.
  settings: constant([]),
  holidays: array(object({ id: keep, name: keep, start: keep, end: keep, bookable: keep })),
  isPlayground: keep,
  oneDriveData: drop,
  ui2020: keep,
  pollingJobs: drop,
  isSupportAccessOpen: keep,
  licenceExpiresAt: keep,
});

const timeGrid = object({
  schoolyearId: keep,
  units: array(object({ unitOfDay: keep, startTime: keep, endTime: keep })),
});

const filterFields = {
  resourceType: keep,
  preSelected: constant(null),
  buildings: constant([]),
  departments: array(plain),
  roomGroups: constant([]),
  resourceTypes: constant([]),
  assignmentGroups: constant([]),
  resources: constant([]),
  classes: array(
    object({
      class: plain,
      classTeacher1: person("T"),
      classTeacher2: person("T"),
      department: plain,
    }),
  ),
  teachers: array(
    object({ teacher: person("T"), departments: array(plain), imageUrl: constant(null) }),
  ),
  subjects: array(object({ subject: resource(code), departments: array(plain) })),
  rooms: array(
    object({
      room: resource(room),
      capacity: keep,
      roomGroups: constant([]),
      building: plain,
      department: plain,
    }),
  ),
  students: array(
    object({
      student: person("S"),
      classes: array(object({ class: plain, dateRange: range, department: plain })),
      assignmentGroups: constant([]),
      imageUrl: constant(null),
    }),
  ),
};

/** A directory. The store keeps students only in the students' own, where the import needs them. */
const filter = new Fields({
  fields: (value, column) =>
    column === "store" && value.resourceType !== "STUDENT"
      ? { ...filterFields, students: constant([]) }
      : filterFields,
});

/**
 * A student in an entry's position, as the store keeps one: no position has an id, so every name
 * becomes the same placeholder, and the nullable label none. The corpus has no rule for it yet.
 */
const studentPosition = {
  type: keep,
  status: keep,
  shortName: Leaf.PersonName({ kind: "S", by: "shortName" }),
  longName: Leaf.PersonName({ kind: "S", by: "shortName" }),
  displayName: Leaf.PersonName({ kind: "S", by: "shortName" }),
  displayNameLabel: constant(null),
} satisfies Readonly<Record<string, Node>>;

/**
 * A resource in one of an entry's positions. Only a teacher's has no id, so its short name finds
 * it. An `INFO` position holds the school's free text.
 */
const positionResource = new Fields({
  fields: (value, column) => {
    if (column === "store" && value.type === "STUDENT") return studentPosition;

    const names: Leaf | undefined =
      value.type === "TEACHER"
        ? Leaf.PersonName({ kind: "T", by: "shortName" })
        : value.type === "SUBJECT"
          ? code
          : value.type === "ROOM"
            ? room
            : value.type === "CLASS"
              ? code
              : value.type === "INFO"
                ? text
                : undefined;

    const rules: Readonly<Record<string, Node>> =
      names === undefined
        ? { type: unknownKind }
        : {
            type: keep,
            status: keep,
            shortName: names,
            longName: names,
            displayName: names,
            displayNameLabel: text,
          };

    return rules;
  },
});

const positions = array(object({ current: positionResource, removed: positionResource }));

const entryFields = {
  ids: array(keep),
  duration: range,
  durationTotal: range,
  type: keep,
  status: keep,
  statusDetail: text,
  name: text,
  layoutStartPosition: keep,
  layoutWidth: keep,
  layoutGroup: keep,
  color: keep,
  notesAll: text,
  icons: array(keep),
  position1: positions,
  position2: positions,
  position3: positions,
  position4: positions,
  position5: unseen,
  position6: unseen,
  position7: unseen,
  texts: array(object({ type: keep, text })),
  lessonText: text,
  lessonInfo: text,
  substitutionText: text,
  moved: unseen,
  // A name without an id beside it, and a link; nothing reads them.
  userName: drop,
  link: drop,
};

const entry = object(entryFields);

/** A row behind the day's lessons, such as a holiday, whose names the app data holds. */
const backEntry = object({
  ...entryFields,
  id: keep,
  resource: unseen,
  isFullDay: keep,
  shortName: drop,
  longName: drop,
});

const day = new Fields({
  fields: (value) => ({
    date: keep,
    resourceType: keep,
    resource: byType(value.resourceType) ?? unknownKind,
    status: keep,
    dayEntries: array(entry),
    gridEntries: array(entry),
    backEntries: array(backEntry),
  }),
});

const entries = object({ format: keep, days: array(day), errors: array(object({})) });

const exam = object({
  examId: keep,
  examType: resource(keep, keep, { gradingScaleId: keep }),
  gradingScale: plain,
  examName: text,
  examText: text,
  examStart: keep,
  examEnd: keep,
  examDuration: keep,
  examBooked: keep,
  examBookedUser: person("P"),
  examReturned: keep,
  examReturnedUser: person("P"),
  examModified: keep,
  examModifiedUser: person("P"),
  numStudents: keep,
  subject: resource(code),
  classes: array(plain),
  teachers: array(person("T")),
  studentgroup: resource(code),
  students: array(
    person("S", {
      gender: constant(null),
      klasse: constant(null),
      imageUrl: constant(""),
      gradeProtection: constant(false),
      disadvantageCompensation: constant(false),
    }),
  ),
  invigilators: constant([]),
  rooms: array(resource(room)),
  lessonId: keep,
  exported: keep,
  deleted: keep,
  isUntisExam: keep,
  canEdit: keep,
  canDelete: keep,
  canReadGrades: keep,
  canWriteGrades: keep,
});

const exams = object({ exams: array(exam), withDeleted: keep });

/** A read's path under `reads/`, as `RecordedWebUntis.paths` writes it. */
const readPath =
  /^(?:(?<fixed>schoolyears|app-data|timegrid)|(?<year>\d+)\/(?:filter-(?<filter>[A-Z]+)|entries\/(?<type>[A-Z]+)\/(?<resource>\d+)|(?<exams>exams)))$/u;

/** Whether a body decodes with the schema webuntis-api, and so the harness, reads it with. */
const decodes = <A, I>(schema: Schema.Codec<A, I>) => {
  const decode = Schema.decodeUnknownExit(schema);

  return (body: Json) => Exit.isSuccess(decode(body));
};

const decoders = {
  schoolYears: decodes(Schema.Array(SchoolyearSchema)),
  appData: decodes(AppDataSchema),
  timeGrid: decodes(TimeGridSchema),
  filter: decodes(TimetableFilterSchema),
  entries: decodes(TimetableEntriesSchema),
  exams: decodes(ExamsSchema),
};

export interface Read {
  readonly node: Node;
  /** Whether a body decodes as the harness reads it, which a pseudonymized body must keep. */
  readonly decodes: (body: Json) => boolean;
  /** The view's resource kind for an entries read, whose id is in the path. */
  readonly view?: { readonly type: string; readonly resource: number; readonly year: number };
}

/** The rules for the read at `path`, or none for a path the corpus doesn't know. */
export const forRead = (path: string): Read | undefined => {
  const groups = readPath.exec(path)?.groups;

  if (groups === undefined) return undefined;

  if (groups.fixed === "schoolyears")
    return { node: array(schoolYear), decodes: decoders.schoolYears };

  if (groups.fixed === "app-data") return { node: appData, decodes: decoders.appData };

  if (groups.fixed === "timegrid") return { node: timeGrid, decodes: decoders.timeGrid };

  if (groups.filter !== undefined) {
    return byType(groups.filter) === undefined
      ? undefined
      : { node: filter, decodes: decoders.filter };
  }

  if (groups.exams !== undefined) return { node: exams, decodes: decoders.exams };

  const type = groups.type;

  return type === undefined || byType(type) === undefined
    ? undefined
    : {
        node: entries,
        decodes: decoders.entries,
        view: { type, resource: Number(groups.resource), year: Number(groups.year) },
      };
};

/** The person kind of a view whose resource id is a person's, for its path. */
export const personOfView = (type: string): Tokens.Person | undefined =>
  type === "TEACHER" ? "T" : type === "STUDENT" ? "S" : undefined;

/** The path of an entries read with its resource id replaced. */
export const entriesPath = (view: NonNullable<Read["view"]>, resource: number) =>
  `${view.year}/entries/${view.type}/${resource}`;

const placeholders: Readonly<Record<Tokens.Person, string>> = {
  T: "teacher",
  S: "student",
  P: "person",
};

/**
 * What the source store keeps (m2-import-path.md, section 3): school data, staff names and free
 * text as WebUntis sent them, every id, and in place of a student's or the account's name a
 * placeholder named after the id beside it, or one without an id where there is none.
 */
export const store: Handlers = {
  column: "store",
  leaf: (leaf, value, { ancestors }) => {
    if (leaf._tag === "Drop") return Result.succeed(dropped);

    if (leaf._tag === "Constant") return Result.succeed(leaf.value);

    if (leaf._tag !== "PersonName" || leaf.kind === "T" || value === null) {
      return Result.succeed(value);
    }

    const id = leaf.by === "id" ? ancestors[0]?.id : undefined;
    const name = placeholders[leaf.kind];

    return Result.succeed(Predicate.isNumber(id) ? `${name}-${id}` : name);
  },
};
