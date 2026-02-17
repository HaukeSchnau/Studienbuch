import type { SnapshotResponse, StudentSnapshot } from "@stu/lib";
import { type SnapshotRequest, SnapshotResponseSchema } from "@stu/lib";

export interface SnapshotResolverDependencies {
  loadStudents: (userId: string, ids: string[]) => Promise<StudentSnapshot[]>;
  loadCourses: (userId: string, ids: string[]) => Promise<SnapshotResponse["courses"]>;
}

export const createSnapshotResolver = (deps: SnapshotResolverDependencies) => {
  return async ({ userId, request }: { userId: string; request: SnapshotRequest }): Promise<SnapshotResponse> => {
    const studentIds = [
      ...new Set(request.entities.filter((entity) => entity.kind === "student").map((entity) => entity.id)),
    ];
    const courseIds = [
      ...new Set(request.entities.filter((entity) => entity.kind === "course").map((entity) => entity.id)),
    ];

    const [students, courses] = await Promise.all([
      deps.loadStudents(userId, studentIds),
      deps.loadCourses(userId, courseIds),
    ]);

    return SnapshotResponseSchema.parse({
      students,
      courses,
    });
  };
};
