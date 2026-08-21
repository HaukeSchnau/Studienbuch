import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it } from "vite-plus/test";
import {
  addTaskAtom,
  addTaskAttachmentAtom,
  deleteTaskAtom,
  taskIdFactoryAtom,
  tasksAtom,
  toggleTaskDoneAtom,
} from "./task-atoms";

const dueDate = new Date("2026-08-24T00:00:00.000Z");

describe("task atoms", () => {
  it("applies task commands to the registry-owned task list", () => {
    const registry = AtomRegistry.make({
      initialValues: [
        [tasksAtom, []],
        [taskIdFactoryAtom, { create: () => "task-created" }],
      ],
    });

    registry.set(addTaskAtom, {
      courseId: "course-math",
      title: "Exercises",
      description: "Complete exercises 1 to 3",
      dueDate,
    });
    registry.set(addTaskAttachmentAtom, {
      taskId: "task-created",
      attachment: { id: "photo-1", label: "Notes", color: "#ffffff" },
    });
    registry.set(toggleTaskDoneAtom, "task-created");

    expect(registry.get(tasksAtom)).toEqual([
      {
        id: "task-created",
        courseId: "course-math",
        title: "Exercises",
        description: "Complete exercises 1 to 3",
        dueDate,
        done: true,
        attachments: [{ id: "photo-1", label: "Notes", color: "#ffffff" }],
      },
    ]);

    registry.set(deleteTaskAtom, "task-created");
    expect(registry.get(tasksAtom)).toEqual([]);
    registry.dispose();
  });
});
