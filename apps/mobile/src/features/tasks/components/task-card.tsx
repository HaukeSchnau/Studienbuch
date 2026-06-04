import { format } from "date-fns";
import { Link } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "~/components/ui/text";
import { isTaskArchived, type Task } from "@stu/core";
import { useCourses } from "~/data/hooks";
import { taskRoute } from "~/routing/params";

export const TaskCard = ({ task }: { task: Task }) => {
  const { getCourse } = useCourses();
  const course = getCourse(task.courseId);
  const archived = isTaskArchived(task);

  return (
    <Link href={taskRoute(task.id)} asChild>
      <Pressable
        accessibilityRole="button"
        style={{
          width: 192,
          height: 205,
          borderRadius: 36,
          backgroundColor: "#203755",
          padding: 24,
          opacity: archived ? 0.55 : 1,
        }}
      >
        <View className="flex-1">
          <Text className="text-sm text-white/80" numberOfLines={1}>
            {course?.name ?? "Kurs"}
          </Text>
          <Text
            weight="bold"
            className="pt-1 text-white"
            numberOfLines={2}
            style={{
              color: "#3CC233",
              fontSize: 19,
              lineHeight: 23,
            }}
          >
            {task.title}
          </Text>
          <Text
            className="pt-2 text-white"
            numberOfLines={2}
            style={{
              fontSize: 16,
              lineHeight: 20,
            }}
          >
            {task.description}
          </Text>
          <View className="flex-1" />
          <Text
            className="text-white/80"
            style={{
              fontSize: 16,
              lineHeight: 20,
            }}
          >
            Fällig am:{" "}
            <Text
              weight="bold"
              style={{
                fontSize: 16,
                lineHeight: 20,
                color: !task.done && task.dueDate < new Date() ? "#E96868" : "#FFFFFF",
              }}
            >
              {format(task.dueDate, "dd.MM.")}
            </Text>
          </Text>
        </View>
      </Pressable>
    </Link>
  );
};
