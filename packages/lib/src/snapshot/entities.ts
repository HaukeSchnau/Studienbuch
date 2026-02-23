import type { DomainEvent } from "../events";
import { uniqueBy } from "../snapshot-helpers";
import type { SnapshotRequest } from "../snapshot";

export const snapshotEntitiesForEvent = (event: DomainEvent): SnapshotRequest["entities"] => {
  switch (event.type) {
    case "absence.recorded":
      return uniqueBy(
        [
          {
            kind: "student",
            id: event.data.studentId,
          },
          ...event.data.courseIds.map((courseId) => ({
            kind: "course" as const,
            id: courseId,
          })),
        ],
        (entity) => `${entity.kind}:${entity.id}`,
      );
    case "absence.teacherApproved":
      return [
        {
          kind: "student",
          id: event.data.studentId,
        },
        {
          kind: "course",
          id: event.data.courseId,
        },
      ];
    case "absence.discarded":
      return uniqueBy(
        [
          {
            kind: "student",
            id: event.data.studentId,
          },
          ...event.data.courseIds.map((courseId) => ({
            kind: "course" as const,
            id: courseId,
          })),
        ],
        (entity) => `${entity.kind}:${entity.id}`,
      );
    case "grades.currentGradeSet":
    case "grades.writtenGradeRecorded":
    case "student.courseAssigned":
      return [
        {
          kind: "student",
          id: event.data.studentId,
        },
        {
          kind: "course",
          id: event.data.courseId,
        },
      ];
    case "student.joined":
      return [
        {
          kind: "student",
          id: event.data.studentId,
        },
      ];
    case "grades.teacherApproved":
    case "grades.parentApproved":
    case "grades.discarded":
    case "grades.latestRestored":
      return [
        {
          kind: "student",
          id: event.data.studentId,
        },
        {
          kind: "course",
          id: event.data.course,
        },
      ];
    default:
      return [];
  }
};
