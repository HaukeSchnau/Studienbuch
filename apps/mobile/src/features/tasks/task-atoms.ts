import type { Task, TaskAttachment } from "~/compat/mobile-v0";
import { Atom } from "effect/unstable/reactivity";

export interface AddTaskInput {
  readonly courseId: string;
  readonly title: string;
  readonly description: string;
  readonly dueDate: Date;
  readonly attachments?: TaskAttachment[];
}

export interface AddTaskAttachmentInput {
  readonly taskId: string;
  readonly attachment: TaskAttachment;
}

export const tasksAtom = Atom.make<Task[]>([]).pipe(Atom.keepAlive, Atom.withLabel("tasks:all"));

/** The active data implementation supplies IDs until task creation moves into an Effect service. */
export const taskIdFactoryAtom = Atom.make({
  create: () => `task-${Date.now()}`,
}).pipe(Atom.keepAlive, Atom.withLabel("tasks:id-factory"));

export const addTaskAtom = Atom.writable(
  () => undefined,
  (context, input: AddTaskInput) => {
    context.set(tasksAtom, [
      {
        id: context.get(taskIdFactoryAtom).create(),
        courseId: input.courseId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        done: false,
        attachments: input.attachments ?? [],
      },
      ...context.get(tasksAtom),
    ]);
  },
).pipe(Atom.withLabel("tasks:add"));

export const addTaskAttachmentAtom = Atom.writable(
  () => undefined,
  (context, { taskId, attachment }: AddTaskAttachmentInput) => {
    context.set(
      tasksAtom,
      context
        .get(tasksAtom)
        .map((task) =>
          task.id === taskId ? { ...task, attachments: [...task.attachments, attachment] } : task,
        ),
    );
  },
).pipe(Atom.withLabel("tasks:add-attachment"));

export const toggleTaskDoneAtom = Atom.writable(
  () => undefined,
  (context, taskId: string) => {
    context.set(
      tasksAtom,
      context
        .get(tasksAtom)
        .map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)),
    );
  },
).pipe(Atom.withLabel("tasks:toggle-done"));

export const deleteTaskAtom = Atom.writable(
  () => undefined,
  (context, taskId: string) => {
    context.set(
      tasksAtom,
      context.get(tasksAtom).filter((task) => task.id !== taskId),
    );
  },
).pipe(Atom.withLabel("tasks:delete"));
