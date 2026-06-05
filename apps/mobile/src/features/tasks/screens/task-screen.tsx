import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import { Alert, View } from "react-native";
import CrossIcon from "~/assets/cross.svg";
import { CheckboxRow } from "~/components/fields/checkbox-row";
import { Card } from "~/components/ui/card";
import { PageScaffold } from "~/app-shell/navigation/page-scaffold";
import { SystemIcon } from "~/components/ui/system-icon";
import { Text } from "~/components/ui/text";
import { haptics } from "~/platform/haptics";
import { useCourses, useTasks } from "~/data/hooks";
import { colors } from "~/theme/colors";

export const TaskScreen = ({ taskId }: { taskId: string }) => {
  const router = useRouter();
  const { getCourse } = useCourses();
  const { getTask, toggleTaskDone, deleteTask } = useTasks();
  const task = getTask(taskId);

  if (!task) {
    return (
      <PageScaffold title="Hausaufgabe" contentClassName="p-6" useDefaultPadding={false}>
        <Text>Aufgabe nicht gefunden.</Text>
      </PageScaffold>
    );
  }

  const course = getCourse(task.courseId);
  const confirmDelete = () =>
    Alert.alert("Aufgabe löschen", "Möchtest du die Aufgabe wirklich löschen?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: () => {
          haptics.warning();
          deleteTask(task.id);
          router.back();
        },
      },
    ]);

  return (
    <PageScaffold
      title="Hausaufgabe"
      headerRight={
        <Stack.Toolbar.Button
          tintColor={colors.danger.DEFAULT}
          accessibilityLabel="Aufgabe löschen"
          onPress={confirmDelete}
        >
          Löschen
        </Stack.Toolbar.Button>
      }
    >
      <Card>
        <Text className="text-3xl text-primary-text" weight="bold">
          {task.title}
        </Text>
        <View className="h-1.5" />
        <Text className="text-xl text-black/80" weight="bold">
          {course?.name ?? "Kurs"}
        </Text>

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
            <SystemIcon name="check" size={20} color={colors.primary.text} />
          ) : (
            <CrossIcon width={16} height={16} />
          )}
        </View>
        <View className="h-4" />
        <CheckboxRow
          label={task.done ? "Bestätigung zurücknehmen" : "Bestätigen"}
          value={task.done}
          onChange={() => toggleTaskDone(task.id)}
        />
      </Card>
    </PageScaffold>
  );
};
