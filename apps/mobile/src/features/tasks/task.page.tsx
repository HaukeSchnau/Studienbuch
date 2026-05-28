import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, View } from "react-native";
import CrossIcon from "~/assets/cross.svg";
import { Button } from "~/components/button";
import { Card } from "~/components/card";
import { Text } from "~/components/text";
import { useMockApp } from "~/mock-app/provider";
import { colors } from "~/theme/colors";

export const TaskPage = ({ taskId }: { taskId: string }) => {
  const router = useRouter();
  const { getTask, getCourse, toggleTaskDone, deleteTask } = useMockApp();
  const task = getTask(taskId);

  if (!task) {
    return (
      <View className="flex-1 bg-background p-6">
        <Stack.Screen options={{ title: "Hausaufgabe" }} />
        <Text>Aufgabe nicht gefunden.</Text>
      </View>
    );
  }

  const course = getCourse(task.courseId);

  return (
    <ScrollView className="flex-1 bg-background">
      <Stack.Screen options={{ title: "Hausaufgabe" }} />

      <View className="px-5 pb-8 pt-5">
        <Card>
          <View className="flex-row items-start">
            <View className="flex-1">
              <Text className="text-3xl text-primary-text" weight="bold">
                {task.title}
              </Text>
              <View className="h-1.5" />
              <Text className="text-xl text-black/80" weight="bold">
                {course?.name ?? "Kurs"}
              </Text>
            </View>
            <Pressable
              className="rounded-full p-2"
              onPress={() =>
                Alert.alert("Aufgabe löschen", "Möchtest du die Aufgabe wirklich löschen?", [
                  { text: "Abbrechen", style: "cancel" },
                  {
                    text: "Löschen",
                    style: "destructive",
                    onPress: () => {
                      deleteTask(task.id);
                      router.back();
                    },
                  },
                ])
              }
            >
              <MaterialIcons name="delete" size={26} color="rgba(0,0,0,0.58)" />
            </Pressable>
          </View>

          <View className="h-5" />
          <Text className="text-lg leading-8 text-black/72">
            {task.description || "Keine Beschreibung."}
          </Text>
        </Card>

        {task.attachments.length > 0 ? (
          <>
            <View className="h-4" />
            <Card>
              <Text className="text-2xl text-primary-text" weight="bold">
                Bilder
              </Text>
              <View className="h-4" />
              <View className="flex-row flex-wrap gap-3">
                {task.attachments.map((attachment) => (
                  <View
                    key={attachment.id}
                    className="h-28 w-28 items-center justify-center rounded-[28px]"
                    style={{ backgroundColor: attachment.color }}
                  >
                    <Text weight="bold">{attachment.label}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </>
        ) : null}

        <View className="h-4" />
        <Card>
          <View className="flex-row items-center">
            <Text
              className="text-lg"
              style={{ color: task.done ? colors.primary.text : colors.danger.DEFAULT }}
            >
              {task.done ? "Erledigt " : "Nicht erledigt "}
            </Text>
            {task.done ? (
              <MaterialIcons name="check" size={20} color={colors.primary.text} />
            ) : (
              <CrossIcon width={16} height={16} />
            )}
          </View>
          <View className="h-4" />
          <View className="items-end">
            <Button
              label={task.done ? "Bestätigung zurücknehmen" : "Bestätigen"}
              onPress={() => toggleTaskDone(task.id)}
            />
          </View>
        </Card>
      </View>
    </ScrollView>
  );
};
