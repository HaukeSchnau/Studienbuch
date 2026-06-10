import { useLocalSearchParams } from "expo-router";
import { getTaskRouteParams } from "~/routing/params";
import { TaskScreen } from "~/features/tasks";

export default function TaskRoute() {
  const params = useLocalSearchParams<{ taskId?: string | string[] }>();
  const { taskId } = getTaskRouteParams(params);

  if (!taskId) {
    return null;
  }

  return <TaskScreen taskId={taskId} />;
}
