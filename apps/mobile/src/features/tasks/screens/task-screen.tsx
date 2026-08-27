import type { Course } from "~/compat/mobile-v0";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/ui/button";
import { SystemIcon, type SystemIconName } from "~/ui/system-icon";
import { Text } from "~/ui/text";
import { SubjectIcon } from "~/domain-ui/subject-icon";
import { haptics } from "~/infra/native/haptics";
import { useCourses } from "~/features/courses";
import { colors } from "~/ui/colors";
import { fontNames } from "~/ui/text";
import { AttachmentList, AttachmentPreview } from "../components/task-attachments";
import { TaskPhotoSourceSheet } from "../components/task-photo-source-sheet";
import { TaskStatusBar } from "../components/task-status-bar";
import { useTaskPhotoPicker } from "../components/use-task-photo-picker";
import { createTaskAttachment } from "../model/task-attachments";
import { getTaskDetailModel } from "../model/task-detail-model";
import { useTasks } from "../use-tasks";

const taskHeaderOptions =
  Platform.OS === "ios"
    ? {
        title: "Hausaufgabe",
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.primary.text,
        headerTitleStyle: {
          color: "#172033",
          fontFamily: fontNames.bold,
        },
      }
    : { title: "Hausaufgabe" };

const detailMetrics = {
  titleFontSize: Platform.OS === "ios" ? 30 : 29,
  titleLineHeight: Platform.OS === "ios" ? 36 : 35,
  bodyFontSize: Platform.OS === "ios" ? 17 : 18,
  bodyLineHeight: Platform.OS === "ios" ? 26 : 28,
} as const;

const SubjectLine = ({ course }: { course?: Course }) => (
  <View className="flex-row items-center gap-3">
    <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-des">
      {course ? (
        <SubjectIcon subject={course.subject} size={26} />
      ) : (
        <SystemIcon name="info" size={21} color={colors.primary.text} />
      )}
    </View>
    <Text className="min-w-0 flex-1 text-[17px] text-[#52616F]" numberOfLines={1} weight="bold">
      {course?.name ?? "Kurs"}
    </Text>
  </View>
);

const MissingTaskState = ({ onBack }: { onBack: () => void }) => (
  <View className="flex-1 bg-background px-5 pt-6">
    <View className="rounded-[26px] bg-white p-5 shadow-sm">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-accent-des">
        <SystemIcon name="info" color={colors.accent.DEFAULT} size={24} />
      </View>
      <Text className="pt-4 text-2xl text-primary-text" weight="bold">
        Aufgabe nicht gefunden
      </Text>
      <Text className="pt-2 text-[16px] leading-6 text-[#5B6472]">
        Diese Hausaufgabe wurde vermutlich gelöscht oder ist noch nicht lokal verfügbar.
      </Text>
      <Button className="mt-5 self-start" label="Zurück" onPress={onBack} size="sm" />
    </View>
  </View>
);

const HeaderActionButton = ({
  accessibilityLabel,
  color,
  iconName,
  onPress,
}: {
  accessibilityLabel: string;
  color: string;
  iconName: SystemIconName;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    className="h-11 w-11 items-center justify-center"
    hitSlop={8}
    onPress={onPress}
  >
    <SystemIcon name={iconName} color={color} size={23} />
  </Pressable>
);

const HeaderActions = ({ onDelete, onEdit }: { onDelete: () => void; onEdit: () => void }) => {
  const iconColor = Platform.OS === "android" ? colors.on.primary : colors.primary.text;

  return (
    <View className="flex-row items-center">
      <HeaderActionButton
        accessibilityLabel="Hausaufgabe bearbeiten"
        color={iconColor}
        iconName="edit"
        onPress={onEdit}
      />
      <HeaderActionButton
        accessibilityLabel="Aufgabe löschen"
        color={Platform.OS === "android" ? colors.on.primary : colors.danger.DEFAULT}
        iconName="delete"
        onPress={onDelete}
      />
    </View>
  );
};

export const TaskScreen = ({ taskId }: { taskId: string }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getCourse } = useCourses();
  const { getTask, addTaskAttachment, toggleTaskDone, deleteTask } = useTasks();
  const [previewIndex, setPreviewIndex] = useState<number | undefined>();
  const [completionBurstKey, setCompletionBurstKey] = useState(0);
  const [isPhotoSourceVisible, setIsPhotoSourceVisible] = useState(false);
  const task = getTask(taskId);

  const detailModel = useMemo(() => (task ? getTaskDetailModel(task) : undefined), [task]);
  const { pickFromLibrary, takePhoto } = useTaskPhotoPicker({
    onAssetPicked: (asset) => {
      if (!task) {
        return;
      }

      const nextIndex = task.attachments.length;

      addTaskAttachment(
        task.id,
        createTaskAttachment({
          index: nextIndex,
          label: asset.fileName ?? `Foto ${nextIndex + 1}`,
          uri: asset.uri,
        }),
      );
      haptics.success();
    },
  });

  if (!task) {
    return (
      <>
        <Stack.Screen options={taskHeaderOptions} />
        <MissingTaskState onBack={() => router.back()} />
      </>
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

  const toggleDone = () => {
    if (task.done) {
      haptics.toggle(false);
    } else {
      haptics.success();
      setCompletionBurstKey((key) => key + 1);
    }
    toggleTaskDone(task.id);
  };

  const showEditPlaceholder = () => {
    haptics.selection();
    Alert.alert(
      "Bearbeiten",
      "Das Bearbeiten der Hausaufgabe ist vorbereitet und kommt als nächster Schritt.",
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          ...taskHeaderOptions,
          headerRight: () => (
            <HeaderActions onDelete={confirmDelete} onEdit={showEditPlaceholder} />
          ),
        }}
      />

      <View className="flex-1 bg-background">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: insets.bottom + 102,
            paddingHorizontal: 20,
            paddingTop: Platform.OS === "ios" ? 12 : 18,
          }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-1 pt-1">
            <SubjectLine course={course} />

            <Text
              className="pt-5 text-primary-text"
              weight="bold"
              style={{
                fontFamily: fontNames.bold,
                fontSize: detailMetrics.titleFontSize,
                lineHeight: detailMetrics.titleLineHeight,
              }}
            >
              {task.title}
            </Text>

            <View className="mt-5 h-px bg-[#E3E9F1]" />

            <Text
              className="pt-5 text-[#172033]"
              style={{
                fontSize: detailMetrics.bodyFontSize,
                lineHeight: detailMetrics.bodyLineHeight,
              }}
            >
              {task.description || "Keine Beschreibung hinterlegt."}
            </Text>
          </View>

          <View className="pt-8">
            <Text className="px-1 text-2xl text-primary-text" weight="bold">
              Bilder
            </Text>

            <AttachmentList
              attachments={task.attachments}
              onOpen={setPreviewIndex}
              onAdd={() => setIsPhotoSourceVisible(true)}
            />
          </View>
        </ScrollView>

        <TaskStatusBar
          done={task.done}
          dueLabel={detailModel?.dueLabel}
          bottomInset={insets.bottom}
          completionBurstKey={completionBurstKey}
          onToggleDone={toggleDone}
        />
      </View>

      {previewIndex !== undefined ? (
        <AttachmentPreview
          attachments={task.attachments}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(undefined)}
        />
      ) : null}

      {isPhotoSourceVisible ? (
        <TaskPhotoSourceSheet
          onClose={() => setIsPhotoSourceVisible(false)}
          onPickFromLibrary={() => void pickFromLibrary()}
          onTakePhoto={() => void takePhoto()}
        />
      ) : null}
    </>
  );
};
