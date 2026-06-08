import { useState } from "react";
import { ScrollView, View } from "react-native";
import { PortaledBottomSheet } from "~/components/layout/bottom-sheet";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { colors } from "~/theme/colors";
import { useTasks } from "~/data/hooks";
import type { Task } from "@stu/core";
import { getTaskOverviewModel } from "../model/task-overview-model";
import { AddTaskSheet } from "./add-task-sheet";
import { TaskCard } from "./task-card";

export const TasksSection = ({ courseId }: { courseId?: string }) => {
  const { getCourseTasks } = useTasks();
  const [isAddVisible, setIsAddVisible] = useState(false);
  const model = getTaskOverviewModel(getCourseTasks(courseId));

  return (
    <TasksSectionView
      courseId={courseId}
      isAddVisible={isAddVisible}
      model={model}
      onShowAdd={() => setIsAddVisible(true)}
      onCloseAdd={() => setIsAddVisible(false)}
    />
  );
};

export const TasksSectionView = ({
  courseId,
  isAddVisible,
  model,
  onShowAdd,
  onCloseAdd,
}: {
  courseId?: string;
  isAddVisible: boolean;
  model: { tasks: Task[]; sectionHeight: number };
  onShowAdd: () => void;
  onCloseAdd: () => void;
}) => {
  const { tasks, sectionHeight } = model;

  return (
    <View
      style={{
        backgroundColor: colors.accent.DEFAULT,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
      }}
      className="py-6"
    >
      {isAddVisible ? (
        <PortaledBottomSheet onClose={onCloseAdd}>
          <AddTaskSheet courseId={courseId} onClose={onCloseAdd} />
        </PortaledBottomSheet>
      ) : null}

      <View className="flex-row items-center px-8">
        <Text className="flex-1 text-3xl text-white" weight="bold">
          Hausaufgaben
        </Text>
        <IconButton
          accessibilityLabel="Hausaufgabe hinzufügen"
          icon="add"
          variant="plain"
          size={24}
          opacity={1}
          color="white"
          onPress={onShowAdd}
        />
      </View>

      {tasks.length === 0 ? (
        <View className="px-8 pb-5 pt-4">
          <View className="rounded-[24px] bg-white/16 px-5 py-4">
            <Text className="text-lg text-white" weight="semi-bold">
              Alles frei in diesem Kurs.
            </Text>
            <Text className="pt-1 text-base leading-5 text-white/82">
              Mit dem Plus legst du schnell die nächste Aufgabe an.
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 32,
            paddingVertical: 14,
          }}
        >
          <View
            style={{
              flexDirection: "column",
              flexWrap: "wrap",
              gap: 15,
              height: sectionHeight,
            }}
          >
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </View>
        </ScrollView>
      )}

      <View className="h-2" />
    </View>
  );
};
