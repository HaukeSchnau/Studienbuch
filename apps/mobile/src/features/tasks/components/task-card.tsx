import { format } from "date-fns";
import { router } from "expo-router";
import { View } from "react-native";
import { PressableSurface } from "~/ui/feedback/pressable-surface";
import { Text } from "~/ui/text";
import { colors } from "~/ui/colors";
import { isTaskArchived, type Task } from "@/compat/mobile-v0";
import { useCourses } from "~/infra/data/hooks";
import { taskRoute } from "~/infra/routing/params";

export const TaskCard = ({ task }: { task: Task }) => {
  const { getCourse } = useCourses();
  const course = getCourse(task.courseId);
  const archived = isTaskArchived(task);

  return (
    <PressableSurface
      accessibilityLabel={`${course?.name ?? "Kurs"}, ${task.title}, ${
        task.description || "Keine Beschreibung"
      }, fällig am ${format(task.dueDate, "dd.MM.")}`}
      borderRadius={24}
      haptic="impact"
      onPress={() => router.push(taskRoute(task.id))}
      pressedScale={0.97}
      style={{
        width: 192,
        height: 198,
        borderRadius: 24,
        backgroundColor: colors.accent.card,
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
            color: colors.primary.punch,
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
          {task.description || "Keine Beschreibung hinterlegt."}
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
              color:
                !task.done && task.dueDate < new Date() ? colors.danger.pale : colors.on.primary,
            }}
          >
            {format(task.dueDate, "dd.MM.")}
          </Text>
        </Text>
      </View>
    </PressableSurface>
  );
};
