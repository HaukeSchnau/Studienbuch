import {
  courseId,
  sampleCourseSnapshot,
  sampleStudentSnapshot,
  sampleTaskProjectionSnapshot,
  snapshotEntitiesForEvent,
  studentId,
} from "@stu/lib";
import { describe, expect, it, vi } from "vitest";
import { createSnapshotResolver } from "./snapshot-resolver";

describe("createSnapshotResolver", () => {
  it("deduplicates requested entity ids by kind before loading", async () => {
    const loadStudents = vi.fn(async () => [sampleStudentSnapshot]);
    const loadCourses = vi.fn(async () => [sampleCourseSnapshot]);
    const loadAbsences = vi.fn(async () => []);
    const loadGrades = vi.fn(async () => []);
    const loadTasks = vi.fn(async () => [sampleTaskProjectionSnapshot]);

    const resolve = createSnapshotResolver({
      loadStudents,
      loadCourses,
      loadAbsences,
      loadGrades,
      loadTasks,
    });
    const eventEntities = snapshotEntitiesForEvent({
      id: "11111111-1111-4111-8111-111111111111",
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
      type: "grades.currentGradeSet",
      data: {
        studentId,
        courseId,
        date: new Date("2026-01-01T00:00:00.000Z"),
        result: 2,
        type: "ORAL",
      },
    });

    const response = await resolve({
      userId: studentId,
      request: {
        entities: [...eventEntities, ...eventEntities],
      },
    });

    expect(loadStudents).toHaveBeenCalledWith(studentId, [studentId]);
    expect(loadCourses).toHaveBeenCalledWith(studentId, [courseId]);
    expect(loadAbsences).toHaveBeenCalledWith(studentId);
    expect(loadGrades).toHaveBeenCalledWith(studentId);
    expect(loadTasks).toHaveBeenCalledWith(studentId);
    expect(response.students).toHaveLength(1);
    expect(response.courses).toHaveLength(1);
    expect(response.absences).toEqual([]);
    expect(response.grades).toEqual([]);
    expect(response.tasks).toEqual([sampleTaskProjectionSnapshot]);
  });

  it("returns empty arrays when no entities of a kind are requested", async () => {
    const loadStudents = vi.fn(async () => []);
    const loadCourses = vi.fn(async () => []);
    const loadAbsences = vi.fn(async () => []);
    const loadGrades = vi.fn(async () => []);
    const loadTasks = vi.fn(async () => [sampleTaskProjectionSnapshot]);

    const resolve = createSnapshotResolver({
      loadStudents,
      loadCourses,
      loadAbsences,
      loadGrades,
      loadTasks,
    });

    const response = await resolve({
      userId: studentId,
      request: {
        entities: [{ kind: "student", id: studentId }],
      },
    });

    expect(loadStudents).toHaveBeenCalledWith(studentId, [studentId]);
    expect(loadCourses).toHaveBeenCalledWith(studentId, []);
    expect(loadAbsences).toHaveBeenCalledWith(studentId);
    expect(loadGrades).toHaveBeenCalledWith(studentId);
    expect(loadTasks).toHaveBeenCalledWith(studentId);
    expect(response.courses).toEqual([]);
    expect(response.absences).toEqual([]);
    expect(response.grades).toEqual([]);
    expect(response.tasks).toEqual([sampleTaskProjectionSnapshot]);
  });

  it("does not load state projections when request has no student context", async () => {
    const loadStudents = vi.fn(async () => []);
    const loadCourses = vi.fn(async () => []);
    const loadAbsences = vi.fn(async () => []);
    const loadGrades = vi.fn(async () => []);
    const loadTasks = vi.fn(async () => []);

    const resolve = createSnapshotResolver({
      loadStudents,
      loadCourses,
      loadAbsences,
      loadGrades,
      loadTasks,
    });

    const response = await resolve({
      userId: studentId,
      request: {
        entities: [{ kind: "course", id: courseId }],
      },
    });

    expect(loadAbsences).not.toHaveBeenCalled();
    expect(loadGrades).not.toHaveBeenCalled();
    expect(loadTasks).not.toHaveBeenCalled();
    expect(response.absences).toEqual([]);
    expect(response.grades).toEqual([]);
    expect(response.tasks).toEqual([]);
  });
});
