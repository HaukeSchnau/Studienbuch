import {
  entityRefsByKind,
  type SnapshotRequest,
  type SnapshotResponse,
  SnapshotResponseSchema,
  type StudentSnapshot,
} from "@stu/lib";

export interface SnapshotResolverDependencies {
  loadStudents: (userId: string, ids: string[]) => Promise<StudentSnapshot[]>;
  loadCourses: (userId: string, ids: string[]) => Promise<SnapshotResponse["courses"]>;
  loadAbsences: (userId: string) => Promise<SnapshotResponse["absences"]>;
  loadGrades: (userId: string) => Promise<SnapshotResponse["grades"]>;
}

export const createSnapshotResolver = (deps: SnapshotResolverDependencies) => {
  return async ({ userId, request }: { userId: string; request: SnapshotRequest }): Promise<SnapshotResponse> => {
    const studentIds = entityRefsByKind(request.entities, "student");
    const courseIds = entityRefsByKind(request.entities, "course");

    const [students, courses] = await Promise.all([
      deps.loadStudents(userId, studentIds),
      deps.loadCourses(userId, courseIds),
    ]);
    const shouldIncludeStateProjections = studentIds.includes(userId);
    const [absences, grades] = shouldIncludeStateProjections
      ? await Promise.all([deps.loadAbsences(userId), deps.loadGrades(userId)])
      : [[], []];

    return SnapshotResponseSchema.parse({
      students,
      courses,
      absences,
      grades,
    });
  };
};
