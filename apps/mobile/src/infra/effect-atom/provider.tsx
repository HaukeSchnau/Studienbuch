import { RegistryProvider } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import { taskIdFactoryAtom, tasksAtom } from "~/features/tasks/task-atoms";
import { createMockId } from "~/infra/mock-data/id";
import { tasksSeed } from "~/infra/mock-data/tasks";

const initialValues = [
  [tasksAtom, tasksSeed],
  [taskIdFactoryAtom, { create: () => createMockId("task") }],
] as const;

export function EffectAtomProvider({ children }: PropsWithChildren) {
  return <RegistryProvider initialValues={initialValues}>{children}</RegistryProvider>;
}
