/**
 * An invented school with obviously fake names, which every pull request measures imports on
 * (m2-import-corpus.md, section 8). Its truth is written by hand: who sits in which lesson in
 * `plan`, what changed in `changes`, and the labelled `cases`. Each case IGS makes hard is marked.
 */
import { School } from "@stu/core";
import * as DateTime from "effect/DateTime";
import * as Equal from "effect/Equal";
import { RecordedWebUntis } from "../../../infra/webuntis/RecordedWebUntis.ts";
import type { Corpus } from "../../corpus/Corpus.ts";

export * as TinySchool from "./TinySchool.ts";

interface Resource {
  readonly id: number;
  readonly shortName: string;
  readonly longName: string;
}

const resource = (id: number, shortName: string, longName = shortName): Resource => ({
  id,
  shortName,
  longName,
});

const display = ({ id, shortName, longName }: Resource) => ({
  id,
  shortName,
  longName,
  displayName: longName,
});

const year = { id: 10, name: "2026/2027", start: "2026-08-13", end: "2027-07-07" };

// Case: `11.1` is a lasting class in grade 11, while `12` and `13` are cohort-wide resources.
const c11 = resource(111, "11.1");
const c12 = resource(112, "12");
const c13 = resource(113, "13");
const classes = [c11, c12, c13];

const teacher = (id: number, letter: string) => resource(id, `L${letter}`, `Lehrkraft ${letter}`);
const la = teacher(201, "A");
const lb = teacher(202, "B");
const lc = teacher(203, "C");
const ld = teacher(204, "D");
const le = teacher(205, "E");
const lf = teacher(206, "F");
const teachers = [la, lb, lc, ld, le, lf];

const r101 = resource(301, "R101");
const r102 = resource(302, "R102");
const r103 = resource(303, "R103");
const r104 = resource(304, "R104");
const r105 = resource(305, "R105");
const rooms = [r101, r102, r103, r104, r105];

const de = resource(401, "DE", "Deutsch");
const en = resource(402, "EN", "Englisch");
const maE = resource(403, "MA-E", "Mathematik E");
const ma23 = resource(404, "MA23", "Mathematik 23");
const ph = resource(405, "PH", "Physik");
const ch = resource(406, "CH", "Chemie");
const inf = resource(407, "INF", "Informatik");
const subjects = [de, en, maE, ma23, ph, ch, inf];

const student = (number: number, schoolClass: Resource) => ({
  ...resource(500 + number, `S${number}`, `Schüler ${number}`),
  schoolClass,
});

const s1 = student(1, c11);
const s2 = student(2, c11);
const s3 = student(3, c11);
const s4 = student(4, c12);
const s5 = student(5, c12);
const s6 = student(6, c12);
const s7 = student(7, c12);
const s8 = student(8, c13);
const students = [s1, s2, s3, s4, s5, s6, s7, s8];

const blocks = [
  ["08:00", "09:20"],
  ["09:45", "11:05"],
  ["11:30", "12:50"],
  ["13:50", "15:10"],
  ["15:15", "16:35"],
] as const;

interface Slot {
  /** 1 for Monday. */
  readonly weekday: number;
  readonly block: 1 | 2 | 3 | 4 | 5;
  readonly subject: Resource;
  readonly teacher?: Resource;
  readonly room: Resource;
  readonly classes: ReadonlyArray<Resource>;
  readonly students: ReadonlyArray<Resource>;
  readonly only?: "A" | "B";
  /** WebUntis's ids beyond the first, for a joint lesson. */
  readonly joint?: true;
}

const s11 = [s1, s2, s3];

const plan: ReadonlyArray<Slot> = [
  { weekday: 1, block: 1, subject: de, teacher: la, room: r101, classes: [c11], students: s11 },
  { weekday: 1, block: 2, subject: en, teacher: lb, room: r102, classes: [c11], students: s11 },
  // Case: two `MA-E` groups share teacher, class and subject. Only their students differ.
  {
    weekday: 1,
    block: 3,
    subject: maE,
    teacher: lc,
    room: r103,
    classes: [c12],
    students: [s4, s5],
  },
  {
    weekday: 2,
    block: 2,
    subject: maE,
    teacher: lc,
    room: r103,
    classes: [c12],
    students: [s6, s7],
  },
  // Case: `MA23` is one course taught as two simultaneous rows, one for `12` and one for `13`.
  {
    weekday: 3,
    block: 1,
    subject: ma23,
    teacher: ld,
    room: r104,
    classes: [c12],
    students: [s5, s6],
  },
  { weekday: 3, block: 1, subject: ma23, teacher: ld, room: r104, classes: [c13], students: [s8] },
  // Case: `INF` is a joint lesson, one entry with two ids for `11.1` and `12`.
  {
    weekday: 3,
    block: 3,
    subject: inf,
    teacher: lf,
    room: r105,
    classes: [c11, c12],
    students: [s1, s4],
    joint: true,
  },
  { weekday: 3, block: 4, subject: de, teacher: la, room: r101, classes: [c11], students: s11 },
  // Case: no teacher yet, so the entry's teacher position is `null`.
  { weekday: 4, block: 1, subject: de, room: r101, classes: [c13], students: [s8] },
  // Case: `PH` meets in A-weeks only, `CH` in B-weeks only.
  {
    weekday: 4,
    block: 2,
    subject: ph,
    teacher: le,
    room: r104,
    classes: [c11],
    students: s11,
    only: "A",
  },
  {
    weekday: 4,
    block: 2,
    subject: ch,
    teacher: le,
    room: r104,
    classes: [c11],
    students: s11,
    only: "B",
  },
  {
    weekday: 5,
    block: 1,
    subject: en,
    teacher: lb,
    room: r102,
    classes: [c12],
    students: [s4, s5, s6, s7],
  },
];

// Case: the first two weeks after the autumn break, 2026-W44 and W45, are A and B, against ISO
// parity, which makes W44 a B-week.
const weeks = [
  { label: "A", days: ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"] },
  { label: "B", days: ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"] },
] as const;

// Case: a free day, a Friday WebUntis lists among its holidays.
const freeDay = "2026-10-30";

interface Change {
  readonly status: "CHANGED" | "CANCELLED";
  readonly teacher?: Resource;
  readonly room?: Resource;
  readonly text?: string;
}

/**
 * What WebUntis showed in each version, by the slot's date and index in `plan`. Case: version 2,
 * seen on Wednesday of W45 at 10:00, withdraws the cancellation of `INF` and adds a substitution
 * that afternoon. Case: "Betreuung" is a supervision with a teacher, labelled `Supervised`.
 */
const changes = (version: 1 | 2): ReadonlyMap<string, Change> =>
  new Map<string, Change>([
    ["2026-10-26 1", { status: "CHANGED", teacher: le, text: "Vertretung" }],
    ["2026-10-27 3", { status: "CANCELLED" }],
    ["2026-10-29 9", { status: "CHANGED", room: r105, text: "Raumänderung" }],
    ...(version === 1
      ? [["2026-11-04 6", { status: "CANCELLED" }] as const]
      : [["2026-11-04 7", { status: "CHANGED", teacher: lb, text: "Vertretung" }] as const]),
    ["2026-11-06 11", { status: "CHANGED", teacher: ld, text: "Betreuung" }],
  ]);

interface Occurrence {
  readonly ids: ReadonlyArray<number>;
  readonly date: string;
  readonly slot: Slot;
  readonly change: Change | undefined;
}

const idsOf = (week: number, index: number, slot: Slot) => {
  const first = 1000 + week * 100 + index * 2;

  return slot.joint === true ? [first, first + 1] : [first];
};

const occurrences = (version: 1 | 2): ReadonlyArray<Occurrence> =>
  weeks.flatMap(({ days, label }, week) =>
    plan.flatMap((slot, index) => {
      const date = days[slot.weekday - 1] ?? freeDay;

      return date === freeDay || (slot.only !== undefined && slot.only !== label)
        ? []
        : [
            {
              ids: idsOf(week, index, slot),
              date,
              slot,
              change: changes(version).get(`${date} ${index}`),
            },
          ];
    }),
  );

const position = (type: string, status: string, { shortName, longName }: Resource) => ({
  type,
  status,
  shortName,
  longName,
  displayName: longName,
  displayNameLabel: null,
});

const positions = (type: string, now: Resource | undefined, before: Resource) =>
  now === undefined || now === before
    ? [{ current: position(type, "REGULAR", before), removed: null }]
    : [{ current: position(type, "ADDED", now), removed: position(type, "REMOVED", before) }];

const currentTeacher = ({ slot, change }: Occurrence) => change?.teacher ?? slot.teacher;

const currentRoom = ({ slot, change }: Occurrence) => change?.room ?? slot.room;

const entry = ({ ids, date, slot, change }: Occurrence) => {
  const [start, end] = blocks[slot.block - 1] ?? blocks[0];

  return {
    ids,
    duration: { start: `${date}T${start}`, end: `${date}T${end}` },
    type: "NORMAL_TEACHING_PERIOD",
    status: change?.status ?? "REGULAR",
    statusDetail: null,
    name: null,
    layoutStartPosition: 0,
    layoutWidth: 1000,
    layoutGroup: 0,
    color: "#f4c430",
    // WebUntis writes an empty note as `null` in some entries and `""` in others.
    notesAll: (ids[0] ?? 0) % 4 === 0 ? null : "",
    icons: [],
    position1:
      slot.teacher === undefined ? null : positions("TEACHER", change?.teacher, slot.teacher),
    position2: [{ current: position("SUBJECT", "REGULAR", slot.subject), removed: null }],
    position3: positions("ROOM", change?.room, slot.room),
    position4: slot.classes.map((each) => ({
      current: position("CLASS", "REGULAR", each),
      removed: null,
    })),
    texts: [],
    lessonText: "",
    lessonInfo: null,
    substitutionText: change?.text ?? null,
  };
};

type ViewType = "CLASS" | "TEACHER" | "SUBJECT" | "ROOM" | "STUDENT";

const views: ReadonlyArray<{
  readonly type: ViewType;
  readonly resource: Resource;
  readonly shows: (occurrence: Occurrence) => boolean;
}> = [
  ...classes.map((each) => ({
    type: "CLASS" as const,
    resource: each,
    shows: ({ slot }: Occurrence) => slot.classes.includes(each),
  })),
  ...teachers.map((each) => ({
    type: "TEACHER" as const,
    resource: each,
    shows: (occurrence: Occurrence) => currentTeacher(occurrence) === each,
  })),
  ...subjects.map((each) => ({
    type: "SUBJECT" as const,
    resource: each,
    shows: ({ slot }: Occurrence) => slot.subject === each,
  })),
  ...rooms.map((each) => ({
    type: "ROOM" as const,
    resource: each,
    shows: (occurrence: Occurrence) => currentRoom(occurrence) === each,
  })),
  ...students.map((each) => ({
    type: "STUDENT" as const,
    resource: each,
    shows: ({ slot }: Occurrence) => slot.students.includes(each),
  })),
];

const schoolDays = weeks.flatMap(({ days }) => days);

const firstSeen = DateTime.makeUnsafe("2026-10-23T16:00:00Z");
const changedAt = DateTime.makeUnsafe("2026-11-04T09:00:00Z");
const lateChangeDay = "2026-11-04";

const timetable = (view: (typeof views)[number], version: 1 | 2, dates: ReadonlyArray<string>) => ({
  format: 2,
  days: dates.map((date) => ({
    date,
    resourceType: view.type,
    resource: display(view.resource),
    status: "REGULAR",
    dayEntries: [],
    gridEntries: occurrences(version)
      .filter((occurrence) => occurrence.date === date && view.shows(occurrence))
      .map(entry),
    backEntries: [],
  })),
  errors: [],
});

const range = { start: "2026-10-26", end: "2026-11-08" };

const entryReads = views.map((view): [string, RecordedWebUntis.Read] => {
  const before = timetable(view, 1, [lateChangeDay]);
  const after = timetable(view, 2, [lateChangeDay]);
  const changed = !Equal.equals(before, after);

  return [
    RecordedWebUntis.paths.entries(year.id, view.type, view.resource.id),
    {
      versions: [
        { observedAt: firstSeen, ...range, body: timetable(view, 1, schoolDays) },
        ...(changed
          ? [{ observedAt: changedAt, start: lateChangeDay, end: lateChangeDay, body: after }]
          : []),
      ],
    },
  ];
});

const once = (body: RecordedWebUntis.Version["body"]): RecordedWebUntis.Read => ({
  versions: [{ observedAt: firstSeen, body }],
});

const filter = (type: ViewType, lists: Record<string, RecordedWebUntis.Version["body"]>) =>
  once({
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

// Case: an exam for one `MA-E` group, which a course of both groups would show to the other.
const exam = {
  examId: 901,
  examType: { ...display(resource(1, "KL", "Klausur")), gradingScaleId: 1 },
  gradingScale: display(resource(1, "P", "Punkte")),
  examName: "Klausur",
  examText: "",
  examStart: "2026-11-05T11:30",
  examEnd: "2026-11-05T12:50",
  examDuration: 80,
  examBooked: "2026-10-01T10:00",
  examBookedUser: display(lc),
  examReturned: null,
  examReturnedUser: null,
  examModified: "2026-10-01T10:00",
  examModifiedUser: display(lc),
  numStudents: 2,
  subject: display(maE),
  classes: [display(c12)],
  teachers: [display(lc)],
  studentgroup: display(resource(801, "MA-E/1")),
  students: [s4, s5].map((student) => ({
    ...display(student),
    gender: null,
    klasse: null,
    imageUrl: "",
    gradeProtection: false,
    disadvantageCompensation: false,
  })),
  invigilators: [],
  rooms: [display(r103)],
  lessonId: 7001,
  exported: false,
  deleted: false,
  isUntisExam: false,
  canEdit: false,
  canDelete: false,
  canReadGrades: false,
  canWriteGrades: false,
};

const reads: RecordedWebUntis.Recording = new Map([
  [
    RecordedWebUntis.paths.schoolYears,
    once([{ id: year.id, name: year.name, dateRange: { start: year.start, end: year.end } }]),
  ],
  [
    RecordedWebUntis.paths.appData,
    once({
      currentSchoolYear: null,
      tenant: { displayName: "Erfundene Schule", id: "1", name: "erfundene-schule" },
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
      holidays: [
        { id: 1, name: "Herbstferien", start: "2026-10-12", end: "2026-10-23", bookable: false },
        { id: 2, name: "Ferientag", start: freeDay, end: freeDay, bookable: false },
      ],
    }),
  ],
  [
    RecordedWebUntis.paths.timeGrid,
    once({
      schoolyearId: year.id,
      units: blocks.map(([start, end], index) => ({
        unitOfDay: index + 1,
        startTime: Number(start.replace(":", "")),
        endTime: Number(end.replace(":", "")),
      })),
    }),
  ],
  [
    RecordedWebUntis.paths.filter(year.id, "CLASS"),
    filter("CLASS", {
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
    filter("TEACHER", {
      teachers: teachers.map((each) => ({
        teacher: display(each),
        departments: [],
        imageUrl: null,
      })),
    }),
  ],
  [
    RecordedWebUntis.paths.filter(year.id, "SUBJECT"),
    filter("SUBJECT", {
      subjects: subjects.map((each) => ({ subject: display(each), departments: [] })),
    }),
  ],
  [
    RecordedWebUntis.paths.filter(year.id, "ROOM"),
    filter("ROOM", {
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
    filter("STUDENT", {
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
  [RecordedWebUntis.paths.exams(year.id), once({ exams: [exam], withDeleted: true })],
  ...entryReads,
]);

const idsOn = (date: string, index: number) => {
  const week = weeks.findIndex(({ days }) => days.some((day) => day === date));
  const slot = plan[index];

  return slot === undefined ? [] : idsOf(week, index, slot);
};

export const corpus: Corpus.Corpus = {
  manifest: {
    id: "tiny-school",
    capturedAt: DateTime.makeUnsafe("2026-11-06T17:00:00Z"),
    policy: 0,
    timeZone: School.defaultTimeZone,
    ranges: [range],
  },
  reads,
  cases: {
    changes: [
      {
        id: "substitution",
        date: "2026-10-26",
        entryIds: idsOn("2026-10-26", 1),
        kind: "Substitution",
      },
      {
        id: "cancellation",
        date: "2026-10-27",
        entryIds: idsOn("2026-10-27", 3),
        kind: "Cancelled",
      },
      {
        id: "room-change",
        date: "2026-10-29",
        entryIds: idsOn("2026-10-29", 9),
        kind: "RoomChange",
      },
      {
        id: "same-day-substitution",
        date: "2026-11-04",
        entryIds: idsOn("2026-11-04", 7),
        kind: "Substitution",
      },
      {
        id: "supervision",
        date: "2026-11-06",
        entryIds: idsOn("2026-11-06", 11),
        kind: "Supervised",
      },
    ],
    weeks: [
      { id: "a-week-after-break", week: "2026-W44", label: "A" },
      { id: "b-week", week: "2026-W45", label: "B" },
    ],
    closures: [{ id: "free-day", start: freeDay, end: freeDay }],
    terms: [{ id: "winter", start: "2026-08-01", end: "2027-01-31" }],
  },
};
