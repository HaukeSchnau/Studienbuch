import { useLocalSearchParams } from "expo-router";
import { TaskPage } from "~/features/tasks/task.page";

export default function TaskRoute() {
  const params = useLocalSearchParams<{ taskId?: string | string[] }>();
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;

  if (!taskId) {
    return null;
  }

  return <TaskPage taskId={taskId} />;
}
