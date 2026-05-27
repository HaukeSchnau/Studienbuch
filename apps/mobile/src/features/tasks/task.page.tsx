import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, View } from "react-native";
import CrossIcon from "~/assets/cross.svg";
import { Button } from "~/components/button";
import { Text } from "~/components/text";
import { useMockApp } from "~/mock-app/provider";
import { colors } from "~/theme/colors";

export const TaskPage = ({ taskId }: { taskId: string }) => {
  const router = useRouter();
  const { getTask, getCourse, toggleTaskDone, deleteTask } = useMockApp();
  const task = getTask(taskId);

  if (!task) {
    return (
      <View className="flex-1 bg-white p-8">
        <Stack.Screen options={{ title: "Hausaufgaben" }} />
        <Text>Aufgabe nicht gefunden.</Text>
      </View>
    );
  }

  const course = getCourse(task.courseId);

  return (
    <ScrollView className="flex-1 bg-primary">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="bg-primary px-5 pb-4 pt-12">
        <View className="flex-row items-center">
          <Pressable className="px-3 py-4" onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={26} color="white" />
          </Pressable>
          <Text className="text-3xl text-white" weight="bold">
            Hausaufgaben
          </Text>
        </View>
      </View>

      <View className="min-h-[720px] rounded-t-[50px] bg-white px-8 pb-16 pt-8">
        <View className="flex-row items-start">
          <View className="flex-1">
            <Text className="text-4xl text-primary-text" weight="bold">
              {task.title}
            </Text>
            <Text className="pt-1 text-2xl" weight="bold">
              {course?.name ?? "Kurs"}
            </Text>
          </View>
          <Pressable
            className="rounded-full p-2"
            onPress={() =>
              Alert.alert("Aufgabe loeschen", "Moechtest du die Aufgabe wirklich loeschen?", [
                { text: "Abbrechen", style: "cancel" },
                {
                  text: "Loeschen",
                  style: "destructive",
                  onPress: () => {
                    deleteTask(task.id);
                    router.back();
                  },
                },
              ])
            }
          >
            <MaterialIcons name="delete" size={28} color="rgba(0,0,0,0.7)" />
          </Pressable>
        </View>

        <View className="h-4" />
        <Text className="text-xl text-black/70">{task.description || "Keine Beschreibung."}</Text>

        {task.attachments.length > 0 ? (
          <>
            <View className="h-6" />
            <Text className="text-2xl" weight="bold">
              Bilder
            </Text>
            <View className="h-4" />
            <View className="flex-row flex-wrap justify-between gap-y-4">
              {task.attachments.map((attachment) => (
                <View
                  key={attachment.id}
                  className="h-40 w-[47%] items-center justify-center rounded-3xl"
                  style={{ backgroundColor: attachment.color }}
                >
                  <Text weight="bold">{attachment.label}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View className="h-8" />
        <View>
          <View className="flex-row items-center">
            <Text
              className="text-xl"
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
              label={task.done ? "Bestaetigung zuruecknehmen" : "Bestaetigen"}
              onPress={() => toggleTaskDone(task.id)}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
