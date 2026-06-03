import { useState } from "react";
import { ScrollView, View } from "react-native";
import { PortaledBottomSheet } from "~/components/layout/bottom-sheet";
import { IconButton } from "~/components/ui/icon-button";
import { SystemIcon } from "~/components/ui/system-icon";
import { Text } from "~/components/ui/text";
import { useMockTasks } from "~/mock-app/hooks";
import type { Task } from "@stu/core";
import { getTaskOverviewModel } from "../model/task-overview-model";
import { AddTaskSheet } from "./add-task-sheet";
import { TaskCard } from "./task-card";

export const TasksSection = ({ courseId }: { courseId?: string }) => {
  const { getCourseTasks } = useMockTasks();
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
    <View style={{ backgroundColor: "#3B7FD9" }} className="rounded-t-[40px] py-8">
      {isAddVisible ? (
        <PortaledBottomSheet onClose={onCloseAdd}>
          <AddTaskSheet courseId={courseId} onClose={onCloseAdd} />
        </PortaledBottomSheet>
      ) : null}

      <View className="flex-row items-center px-8">
        <Text className="flex-1 text-4xl text-white" weight="bold">
          Hausaufgaben
        </Text>
        <IconButton
          icon="add"
          variant="plain"
          size={24}
          opacity={1}
          color="white"
          onPress={onShowAdd}
        />
      </View>

      {tasks.length === 0 ? (
        <View className="px-8 pb-4 pt-4">
          <Text className="text-lg text-white">keine Aufgaben gefunden</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 32,
            paddingVertical: 16,
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

      {tasks.length > 0 ? (
        <View className="flex-row items-center gap-2 px-8 pt-1">
          <SystemIcon name="swipe" size={16} color="rgba(255,255,255,0.85)" />
          <Text className="text-sm text-white/80">
            Zum Öffnen horizontal durch die Karten wischen
          </Text>
        </View>
      ) : null}
    </View>
  );
};
