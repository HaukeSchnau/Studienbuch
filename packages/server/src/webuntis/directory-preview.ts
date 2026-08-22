import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  AppClient,
  SchoolyearsClient,
  TimetableClient,
  webUntisLayer,
  withSchoolYear,
  type AppData,
  type DisplayResource,
  type Schoolyear,
  type TimetableFilter,
} from "webuntis-api";

export const DirectoryDiagnostic = Schema.Struct({
  severity: Schema.Literals(["Info", "Warning", "Error"]),
  code: Schema.Literals([
    "ClassWithoutDepartment",
    "ClassWithoutTeacher",
    "StudentWithoutClass",
    "IgnoredStudentImage",
    "IgnoredTeacherImage",
    "IgnoredAssignmentGroup",
    "PendingSubjectResolution",
    "DuplicateExternalIdentity",
    "UnknownClassReference",
    "UnknownTeacherReference",
    "UnknownDepartmentReference",
    "BellScheduleUnavailable",
  ]),
  count: Schema.Int.check(Schema.isGreaterThan(0)),
});
export interface DirectoryDiagnostic extends Schema.Schema.Type<typeof DirectoryDiagnostic> {}

const ImportCounts = Schema.Struct({
  schools: Schema.Int,
  academicYears: Schema.Int,
  departments: Schema.Int,
  buildings: Schema.Int,
  rooms: Schema.Int,
  classes: Schema.Int,
  teachers: Schema.Int,
  students: Schema.Int,
  activities: Schema.Int,
  holidays: Schema.Int,
  bellPeriods: Schema.Int,
});

const IgnoredCounts = Schema.Struct({
  studentImages: Schema.Int,
  teacherImages: Schema.Int,
  assignmentGroups: Schema.Int,
});

export const DirectoryPreview = Schema.Struct({
  dataSourceId: Schema.String,
  provider: Schema.Literal("WebUntis"),
  school: Schema.Struct({
    externalId: Schema.String,
    name: Schema.String,
    loginName: Schema.String,
  }),
  academicYear: Schema.Struct({
    externalId: Schema.String,
    name: Schema.String,
    start: Schema.String,
    end: Schema.String,
  }),
  complete: Schema.Boolean,
  ready: Schema.Boolean,
  wouldImport: ImportCounts,
  ignored: IgnoredCounts,
  diagnostics: Schema.Array(DirectoryDiagnostic),
});
export interface DirectoryPreview extends Schema.Schema.Type<typeof DirectoryPreview> {}

export class SchoolYearUnavailable extends Schema.TaggedError<SchoolYearUnavailable>()(
  "WebUntis.SchoolYearUnavailable",
  {
    requested: Schema.String,
    available: Schema.Array(Schema.String),
  },
) {}

export interface DirectoryInventory {
  readonly appData: AppData;
  readonly academicYear: Schoolyear;
  readonly classFilter: TimetableFilter;
  readonly roomFilter: TimetableFilter;
  readonly studentFilter: TimetableFilter;
  readonly subjectFilter: TimetableFilter;
  readonly teacherFilter: TimetableFilter;
}

const sameResource = (left: DisplayResource, right: DisplayResource) =>
  left.id === right.id &&
  left.shortName === right.shortName &&
  left.longName === right.longName &&
  left.displayName === right.displayName;

const mergeResources = (resources: ReadonlyArray<DisplayResource>) => {
  const byId = new Map<number, DisplayResource>();
  let conflicts = 0;
  for (const resource of resources) {
    const previous = byId.get(resource.id);
    if (previous !== undefined && !sameResource(previous, resource)) conflicts += 1;
    byId.set(resource.id, resource);
  }
  return { resources: [...byId.values()], conflicts } as const;
};

const addDiagnostic = (
  diagnostics: Array<DirectoryDiagnostic>,
  severity: DirectoryDiagnostic["severity"],
  code: DirectoryDiagnostic["code"],
  count: number,
) => {
  if (count > 0) diagnostics.push(DirectoryDiagnostic.make({ severity, code, count }));
};

const overlapsYear = (item: { readonly start: string; readonly end: string }, year: Schoolyear) =>
  item.start <= year.dateRange.end && year.dateRange.start <= item.end;

/** Builds the PII-free plan printed by the console before any persistence work begins. */
export const summarizeDirectoryInventory = (inventory: DirectoryInventory): DirectoryPreview => {
  const {
    appData,
    academicYear,
    classFilter,
    roomFilter,
    studentFilter,
    subjectFilter,
    teacherFilter,
  } = inventory;
  const dataSourceId = `webuntis:${appData.tenant.id}`;
  const departments = mergeResources([
    ...classFilter.departments,
    ...roomFilter.departments,
    ...studentFilter.departments,
    ...subjectFilter.departments,
    ...teacherFilter.departments,
  ]);
  const buildings = mergeResources(
    roomFilter.rooms.flatMap((item) => (item.building === null ? [] : [item.building])),
  );
  const classes = classFilter.classes;
  const rooms = roomFilter.rooms;
  const students = studentFilter.students;
  const activities = subjectFilter.subjects;
  const teachers = teacherFilter.teachers;
  const holidays = appData.holidays.filter((holiday) => overlapsYear(holiday, academicYear));
  const bellPeriods =
    appData.currentSchoolYear?.id === academicYear.id
      ? appData.currentSchoolYear.timeGrid.units.length
      : 0;

  const classIds = new Set(classes.map((item) => item.class.id));
  const teacherIds = new Set(teachers.map((item) => item.teacher.id));
  const departmentIds = new Set(departments.resources.map((item) => item.id));
  const studentClasses = students.flatMap((item) => item.classes);
  const classTeacherIds = classes.flatMap((item) =>
    [item.classTeacher1, item.classTeacher2].flatMap((teacher) =>
      teacher === null ? [] : [teacher.id],
    ),
  );
  const referencedDepartmentIds = [
    ...classes.flatMap((item) => (item.department === null ? [] : [item.department.id])),
    ...rooms.flatMap((item) => (item.department === null ? [] : [item.department.id])),
    ...studentClasses.flatMap((item) => (item.department === null ? [] : [item.department.id])),
  ];

  const sourceKey = (entityKind: string, externalId: string | number) =>
    `${entityKind}\u0000${externalId}`;
  const sourceKeys = [
    sourceKey("School", appData.tenant.id),
    sourceKey("AcademicYear", academicYear.id),
    ...departments.resources.map((item) => sourceKey("Department", item.id)),
    ...buildings.resources.map((item) => sourceKey("Building", item.id)),
    ...rooms.map((item) => sourceKey("Room", item.room.id)),
    ...classes.map((item) => sourceKey("ClassGroup", item.class.id)),
    ...teachers.map((item) => sourceKey("Teacher", item.teacher.id)),
    ...students.map((item) => sourceKey("Student", item.student.id)),
    ...activities.map((item) => sourceKey("Subject", item.subject.id)),
    ...holidays.map((item) => sourceKey("Holiday", item.id)),
    ...Array.from({ length: bellPeriods }, (_, index) => sourceKey("BellPeriod", index + 1)),
  ];
  const duplicateExternalIdentities = sourceKeys.length - new Set(sourceKeys).size;
  const unknownClassReferences = studentClasses.filter(
    (item) => !classIds.has(item.class.id),
  ).length;
  const unknownTeacherReferences = classTeacherIds.filter((id) => !teacherIds.has(id)).length;
  const unknownDepartmentReferences =
    referencedDepartmentIds.filter((id) => !departmentIds.has(id)).length + departments.conflicts;

  const ignored = IgnoredCounts.make({
    studentImages: students.filter((item) => item.imageUrl !== null).length,
    teacherImages: teachers.filter((item) => item.imageUrl !== null).length,
    assignmentGroups: students.reduce((count, item) => count + item.assignmentGroups.length, 0),
  });
  const diagnostics: Array<DirectoryDiagnostic> = [];
  addDiagnostic(
    diagnostics,
    "Warning",
    "ClassWithoutDepartment",
    classes.filter((item) => item.department === null).length,
  );
  addDiagnostic(
    diagnostics,
    "Info",
    "ClassWithoutTeacher",
    classes.filter((item) => item.classTeacher1 === null && item.classTeacher2 === null).length,
  );
  addDiagnostic(
    diagnostics,
    "Warning",
    "StudentWithoutClass",
    students.filter((item) => item.classes.length === 0).length,
  );
  addDiagnostic(diagnostics, "Info", "IgnoredStudentImage", ignored.studentImages);
  addDiagnostic(diagnostics, "Info", "IgnoredTeacherImage", ignored.teacherImages);
  addDiagnostic(diagnostics, "Info", "IgnoredAssignmentGroup", ignored.assignmentGroups);
  addDiagnostic(diagnostics, "Warning", "PendingSubjectResolution", activities.length);
  addDiagnostic(diagnostics, "Error", "DuplicateExternalIdentity", duplicateExternalIdentities);
  addDiagnostic(diagnostics, "Error", "UnknownClassReference", unknownClassReferences);
  addDiagnostic(diagnostics, "Error", "UnknownTeacherReference", unknownTeacherReferences);
  addDiagnostic(diagnostics, "Error", "UnknownDepartmentReference", unknownDepartmentReferences);
  addDiagnostic(diagnostics, "Warning", "BellScheduleUnavailable", bellPeriods === 0 ? 1 : 0);

  return DirectoryPreview.make({
    dataSourceId,
    provider: "WebUntis",
    school: {
      externalId: appData.tenant.id,
      name: appData.tenant.displayName,
      loginName: appData.tenant.name,
    },
    academicYear: {
      externalId: String(academicYear.id),
      name: academicYear.name,
      start: academicYear.dateRange.start,
      end: academicYear.dateRange.end,
    },
    complete: true,
    ready: diagnostics.every((diagnostic) => diagnostic.severity !== "Error"),
    wouldImport: ImportCounts.make({
      schools: 1,
      academicYears: 1,
      departments: departments.resources.length,
      buildings: buildings.resources.length,
      rooms: rooms.length,
      classes: classes.length,
      teachers: teachers.length,
      students: students.length,
      activities: activities.length,
      holidays: holidays.length,
      bellPeriods,
    }),
    ignored,
    diagnostics,
  });
};

/** Reads one complete school-year directory slice. It never writes Studienbuch state. */
export const fetchDirectoryPreview = Effect.fn("WebUntis.fetchDirectoryPreview")(function* (
  requestedSchoolYear: string,
) {
  const app = yield* AppClient;
  const schoolyears = yield* SchoolyearsClient;
  const timetable = yield* TimetableClient;
  const [appData, availableSchoolYears] = yield* Effect.all([app.getData, schoolyears.list]);
  const academicYear = availableSchoolYears.find((year) => year.name === requestedSchoolYear);
  if (academicYear === undefined) {
    return yield* SchoolYearUnavailable.make({
      requested: requestedSchoolYear,
      available: availableSchoolYears.map((year) => year.name),
    });
  }
  const request = {
    start: academicYear.dateRange.start,
    end: academicYear.dateRange.end,
    timetableType: "STANDARD",
  } as const;
  const filters = yield* Effect.all(
    {
      classFilter: timetable.getFilter({ ...request, resourceType: "CLASS" }),
      roomFilter: timetable.getFilter({ ...request, resourceType: "ROOM" }),
      studentFilter: timetable.getFilter({ ...request, resourceType: "STUDENT" }),
      subjectFilter: timetable.getFilter({ ...request, resourceType: "SUBJECT" }),
      teacherFilter: timetable.getFilter({ ...request, resourceType: "TEACHER" }),
    },
    { concurrency: 3 },
  ).pipe(withSchoolYear(academicYear.id));

  return summarizeDirectoryInventory({ appData, academicYear, ...filters });
});

/** Production WebUntis client wiring. It reads credentials from the Effect config provider. */
export const layer = webUntisLayer;

export * as WebUntisDirectory from "./directory-preview.ts";
