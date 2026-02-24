import type { SnapshotResponse } from "@stu/lib";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { Database } from "../database";
import * as tables from "../schema";
import { applySnapshotToLocalDatabase } from "./apply-snapshot";

type PersistedTask = {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  course: string;
  assignee: string;
  images: string[];
  done: boolean;
};

const makeTaskRecordingDatabase = () => {
  const rows = new Map<string, PersistedTask>();

  const client = {
    insert(table: unknown) {
      return {
        values(value: PersistedTask) {
          return {
            onConflictDoUpdate({ set }: { set: Omit<PersistedTask, "id"> }) {
              if (table === tables.tasks) {
                const existing = rows.get(value.id);
                rows.set(value.id, existing ? { ...existing, ...set } : value);
              }
              return Promise.resolve();
            },
            onConflictDoNothing() {
              return Promise.resolve();
            },
          };
        },
      };
    },
  };

  const databaseService = {
    execute: <T>(fn: (dbClient: typeof client) => Promise<T>) => Effect.promise(() => fn(client)),
  };

  return { rows, databaseService };
};

describe("applySnapshotToLocalDatabase task persistence", () => {
  test("upserts snapshot.tasks by id", async () => {
    const taskId = "11111111-1111-4111-8111-111111111111";
    const courseId = "22222222-2222-4222-8222-222222222222";
    const assigneeId = "33333333-3333-4333-8333-333333333333";

    const initialSnapshot: SnapshotResponse = {
      students: [],
      courses: [],
      absences: [],
      grades: [],
      tasks: [
        {
          id: taskId,
          title: "Read chapter 1",
          description: "Complete all exercises",
          dueDate: "2026-03-01T08:00:00.000Z",
          course: courseId,
          assignee: assigneeId,
          images: ["initial.png"],
          done: false,
        },
      ],
    };

    const { rows, databaseService } = makeTaskRecordingDatabase();

    await Effect.runPromise(
      applySnapshotToLocalDatabase(initialSnapshot).pipe(Effect.provideService(Database, databaseService as never)),
    );

    expect(rows.size).toBe(1);
    expect(rows.get(taskId)).toEqual({
      id: taskId,
      title: "Read chapter 1",
      description: "Complete all exercises",
      dueDate: new Date("2026-03-01T08:00:00.000Z"),
      course: courseId,
      assignee: assigneeId,
      images: ["initial.png"],
      done: false,
    });

    const updatedSnapshot: SnapshotResponse = {
      ...initialSnapshot,
      tasks: [
        {
          id: taskId,
          title: "Read chapter 1 (updated)",
          description: "Complete all exercises and summary",
          dueDate: "2026-03-02T08:00:00.000Z",
          course: courseId,
          assignee: assigneeId,
          images: ["updated.png"],
          done: true,
        },
      ],
    };

    await Effect.runPromise(
      applySnapshotToLocalDatabase(updatedSnapshot).pipe(Effect.provideService(Database, databaseService as never)),
    );

    expect(rows.size).toBe(1);
    expect(rows.get(taskId)).toEqual({
      id: taskId,
      title: "Read chapter 1 (updated)",
      description: "Complete all exercises and summary",
      dueDate: new Date("2026-03-02T08:00:00.000Z"),
      course: courseId,
      assignee: assigneeId,
      images: ["updated.png"],
      done: true,
    });
  });
});
