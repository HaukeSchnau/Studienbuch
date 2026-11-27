/**
 * WebUntis's JSON for an invented school, as `RecordedWebUntis` replays it: resources, positions,
 * directories and the master reads. TinySchool and the synthetic schools both build from these,
 * so a fix to WebUntis's shape reaches both.
 */
import type * as DateTime from "effect/DateTime";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";

export * as WebUntisBodies from "./WebUntisBodies.ts";

export interface Resource {
  readonly id: number;
  readonly shortName: string;
  readonly longName: string;
}

export const resource = (id: number, shortName: string, longName = shortName): Resource => ({
  id,
  shortName,
  longName,
});

export const display = ({ id, shortName, longName }: Resource) => ({
  id,
  shortName,
  longName,
  displayName: longName,
});

export const position = (type: string, status: string, { shortName, longName }: Resource) => ({
  type,
  status,
  shortName,
  longName,
  displayName: longName,
  displayNameLabel: null,
});

/**
 * A position's resources as planned, or as a change replaced them: each added one next to a removed
 * one, as WebUntis pairs them.
 */
export const positions = (
  type: string,
  now: ReadonlyArray<Resource>,
  before: ReadonlyArray<Resource>,
) =>
  now.length === before.length && now.every((each, i) => each === before[i])
    ? before.map((each) => ({ current: position(type, "REGULAR", each), removed: null }))
    : Array.from({ length: Math.max(now.length, before.length) }, (_, i) => {
        const added = now[i];
        const removed = before[i];

        return {
          current: added === undefined ? null : position(type, "ADDED", added),
          removed: removed === undefined ? null : position(type, "REMOVED", removed),
        };
      });

/** A read WebUntis answered once, at `observedAt`. */
export const once = (
  observedAt: DateTime.Utc,
  body: RecordedWebUntis.Version["body"],
): RecordedWebUntis.Read => ({ versions: [{ observedAt, body }] });

export type ViewType = "CLASS" | "TEACHER" | "SUBJECT" | "ROOM" | "STUDENT";

/** One resource type's directory, with its lists filled from `lists`. */
export const filter = (
  observedAt: DateTime.Utc,
  type: ViewType,
  lists: Record<string, RecordedWebUntis.Version["body"]>,
) =>
  once(observedAt, {
    resourceType: type,
    preSelected: null,
    buildings: [],
    departments: [],
    roomGroups: [],
    resourceTypes: [],
    assignmentGroups: [],
    classes: [],
    resources: [],
    rooms: [],
    subjects: [],
    students: [],
    teachers: [],
    ...lists,
  });

export interface Year {
  readonly id: number;
  readonly name: string;
  readonly start: string;
  readonly end: string;
}

export interface Directory {
  readonly classes: ReadonlyArray<Resource>;
  readonly teachers: ReadonlyArray<Resource>;
  readonly subjects: ReadonlyArray<Resource>;
  readonly rooms: ReadonlyArray<Resource>;
  readonly students: ReadonlyArray<Resource & { readonly schoolClass: Resource }>;
}

/** Every resource type's directory of one school year. */
export const directories = (
  observedAt: DateTime.Utc,
  year: Year,
  { classes, teachers, subjects, rooms, students }: Directory,
): ReadonlyArray<readonly [string, RecordedWebUntis.Read]> => [
  [
    RecordedWebUntis.paths.filter(year.id, "CLASS"),
    filter(observedAt, "CLASS", {
      classes: classes.map((each) => ({
        class: display(each),
        classTeacher1: null,
        classTeacher2: null,
        department: null,
      })),
    }),
  ],
  [
    RecordedWebUntis.paths.filter(year.id, "TEACHER"),
    filter(observedAt, "TEACHER", {
      teachers: teachers.map((each) => ({
        teacher: display(each),
        departments: [],
        imageUrl: null,
      })),
    }),
  ],
  [
    RecordedWebUntis.paths.filter(year.id, "SUBJECT"),
    filter(observedAt, "SUBJECT", {
      subjects: subjects.map((each) => ({ subject: display(each), departments: [] })),
    }),
  ],
  [
    RecordedWebUntis.paths.filter(year.id, "ROOM"),
    filter(observedAt, "ROOM", {
      rooms: rooms.map((each) => ({
        room: display(each),
        capacity: 30,
        roomGroups: [],
        building: null,
        department: null,
      })),
    }),
  ],
  [
    RecordedWebUntis.paths.filter(year.id, "STUDENT"),
    filter(observedAt, "STUDENT", {
      students: students.map((each) => ({
        student: display(each),
        classes: [
          {
            class: display(each.schoolClass),
            dateRange: { start: year.start, end: year.end },
            department: null,
          },
        ],
        assignmentGroups: [],
        imageUrl: null,
      })),
    }),
  ],
];

/** The school's day as double periods, such as `["08:00", "09:20"]`. */
export type Blocks = ReadonlyArray<readonly [string, string]>;

const timeGrid = (year: Year, blocks: Blocks) => ({
  schoolyearId: year.id,
  units: blocks.map(([start, end], index) => ({
    unitOfDay: index + 1,
    startTime: Number(start.replace(":", "")),
    endTime: Number(end.replace(":", "")),
  })),
});

/** The school years, the app data and the time grid: the reads every run starts with. */
export const masterReads = (
  observedAt: DateTime.Utc,
  options: {
    readonly year: Year;
    readonly blocks: Blocks;
    readonly tenant: string;
    readonly holidays: ReadonlyArray<{
      readonly id: number;
      readonly name: string;
      readonly start: string;
      readonly end: string;
    }>;
  },
): ReadonlyArray<readonly [string, RecordedWebUntis.Read]> => {
  const { year, blocks, tenant, holidays } = options;
  const dateRange = { start: year.start, end: year.end };

  return [
    [
      RecordedWebUntis.paths.schoolYears,
      once(observedAt, [{ id: year.id, name: year.name, dateRange }]),
    ],
    [
      RecordedWebUntis.paths.appData,
      once(observedAt, {
        currentSchoolYear: {
          id: year.id,
          name: year.name,
          dateRange,
          timeGrid: timeGrid(year, blocks),
        },
        tenant: { displayName: tenant, id: "1", name: tenant.toLowerCase().replaceAll(" ", "-") },
        user: {
          id: 1,
          locale: "de",
          name: "Konto A",
          email: null,
          permissions: { views: [] },
          roles: [],
        },
        permissions: [],
        settings: [],
        holidays: holidays.map((holiday) => ({ ...holiday, bookable: false })),
      }),
    ],
    [RecordedWebUntis.paths.timeGrid, once(observedAt, timeGrid(year, blocks))],
  ];
};

/** A student as an exam lists them. */
export const examStudent = (student: Resource) => ({
  ...display(student),
  gender: null,
  klasse: null,
  imageUrl: "",
  gradeProtection: false,
  disadvantageCompensation: false,
});
