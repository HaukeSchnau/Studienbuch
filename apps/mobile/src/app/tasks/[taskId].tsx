import { useLocalSearchParams } from "expo-router";
import { TaskScreen } from "~/features/tasks/screens/task-screen";

export default function TaskRoute() {
  const params = useLocalSearchParams<{ taskId?: string | string[] }>();
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;

  if (!taskId) {
    return null;
  }

  return <TaskScreen taskId={taskId} />;
}
