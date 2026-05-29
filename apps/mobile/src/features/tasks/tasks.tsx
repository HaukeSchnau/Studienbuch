import { useState } from "react";
import { ScrollView, View } from "react-native";
import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { IconButton } from "~/components/icon-button";
import { SystemIcon } from "~/components/system-icon";
import { Text } from "~/components/text";
import { useMockApp } from "~/mock-app/provider";
import { AddTaskSheet } from "./add-task-sheet";
import { TaskCard } from "./task-card";

export const Tasks = ({ courseId }: { courseId?: string }) => {
  const { getCourseTasks } = useMockApp();
  const [isAddVisible, setIsAddVisible] = useState(false);
  const tasks = getCourseTasks(courseId);
  const crossAxisCount = tasks.length < 4 ? 1 : 2;
  const sectionHeight = 225 * crossAxisCount;

  return (
    <View style={{ backgroundColor: "#3B7FD9" }} className="rounded-t-[40px] py-8">
      {isAddVisible ? (
        <PortaledBottomSheet onClose={() => setIsAddVisible(false)}>
          <AddTaskSheet courseId={courseId} onClose={() => setIsAddVisible(false)} />
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
          onPress={() => setIsAddVisible(true)}
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
