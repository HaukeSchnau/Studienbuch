import { format } from "date-fns";
import type { Href } from "expo-router";
import { Link } from "expo-router";
import { View } from "react-native";
import { Card } from "~/components/card";
import { Text } from "~/components/text";
import { isTaskArchived, type Task } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { colors } from "~/theme/colors";

export const TaskCard = ({ task }: { task: Task }) => {
  const { getCourse } = useMockApp();
  const course = getCourse(task.courseId);
  const archived = isTaskArchived(task);

  return (
    <Link href={`/tasks/${task.id}` as Href} asChild>
      <Card
        noShadow
        style={{
          width: 180,
          minHeight: 205,
          backgroundColor: "#203755",
          opacity: archived ? 0.55 : 1,
        }}
      >
        <View className="flex-1">
          <Text className="text-sm text-white/80">{course?.name ?? "Kurs"}</Text>
          <Text
            weight="bold"
            className="pt-1 text-2xl"
            numberOfLines={2}
            style={{ color: colors.primary.pale }}
          >
            {task.title}
          </Text>
          <Text className="pt-2 text-lg text-white" numberOfLines={2}>
            {task.description}
          </Text>
          <View className="flex-1" />
          <Text className="text-lg text-white/80">
            Faellig am:{" "}
            <Text
              weight="bold"
              className="text-lg"
              style={{ color: !task.done && task.dueDate < new Date() ? "#E96868" : "#FFFFFF" }}
            >
              {format(task.dueDate, "dd.MM.")}
            </Text>
          </Text>
        </View>
      </Card>
    </Link>
  );
};
