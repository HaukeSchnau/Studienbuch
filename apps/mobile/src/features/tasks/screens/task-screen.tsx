import type { TaskAttachment } from "@stu/core";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Modal, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableSurface } from "~/components/feedback/pressable-surface";
import { Button, TextButton } from "~/components/ui/button";
import { SystemIcon } from "~/components/ui/system-icon";
import { Text } from "~/components/ui/text";
import { haptics } from "~/platform/haptics";
import { useCourses, useTasks } from "~/data/hooks";
import { colors } from "~/theme/colors";
import { fontNames } from "~/components/ui/text";
import { getTaskDetailModel, taskToneColor } from "../model/task-detail-model";

const styles = StyleSheet.create({
  attachmentImage: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  bottomBarShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  previewImage: {
    height: "100%",
    width: "100%",
  },
});

const taskHeaderOptions = {
  title: "Hausaufgabe",
  ...(Platform.OS === "ios"
    ? {
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
    : {}),
};

const detailMetrics = {
  cardRadius: Platform.OS === "ios" ? 26 : 24,
  contentPadding: Platform.OS === "ios" ? 18 : 20,
  titleFontSize: Platform.OS === "ios" ? 29 : 28,
  titleLineHeight: Platform.OS === "ios" ? 35 : 34,
  bodyFontSize: Platform.OS === "ios" ? 17 : 18,
  bodyLineHeight: Platform.OS === "ios" ? 26 : 28,
  attachmentRadius: Platform.OS === "ios" ? 18 : 16,
  bottomPadding: Platform.OS === "ios" ? 10 : 12,
} as const;

const attachmentFallbackPattern = [
  { rotate: "-8deg", top: 16, left: 18, width: 74 },
  { rotate: "5deg", top: 46, left: 34, width: 110 },
  { rotate: "-3deg", top: 78, left: 24, width: 88 },
] as const;

const AttachmentArtwork = ({
  attachment,
  large = false,
}: {
  attachment: TaskAttachment;
  large?: boolean;
}) => (
  <View
    className="flex-1 overflow-hidden"
    style={{ backgroundColor: attachment.color || colors.accent.des }}
  >
    <View
      className="absolute rounded-full bg-white/45"
      style={{
        height: large ? 190 : 86,
        right: large ? -54 : -30,
        top: large ? -38 : -18,
        width: large ? 190 : 86,
      }}
    />
    <View
      className="absolute rounded-[18px] bg-white/80"
      style={{
        bottom: large ? 56 : 24,
        left: large ? 40 : 18,
        right: large ? 40 : 18,
        top: large ? 70 : 36,
      }}
    >
      {attachmentFallbackPattern.map((line) => (
        <View
          key={`${line.top}-${line.width}`}
          className="absolute h-3 rounded-full bg-black/18"
          style={{
            left: line.left,
            top: line.top,
            transform: [{ rotate: line.rotate }],
            width: large ? line.width * 1.65 : line.width,
          }}
        />
      ))}
    </View>
    <View
      className="absolute items-center justify-center rounded-full bg-white"
      style={{
        height: large ? 74 : 42,
        left: large ? 42 : 20,
        top: large ? 34 : 16,
        width: large ? 74 : 42,
      }}
    >
      <SystemIcon name="camera" size={large ? 34 : 20} color={colors.accent.DEFAULT} />
    </View>
  </View>
);

const MetadataChip = ({
  icon,
  label,
  tone = colors.accent.sec,
}: {
  icon: "calendar-today" | "info";
  label: string;
  tone?: string;
}) => (
  <View
    className="min-h-9 flex-row items-center gap-2 rounded-full px-3 py-2"
    style={{ backgroundColor: `${tone}18` }}
  >
    <SystemIcon name={icon} size={16} color={tone} />
    <Text className="text-[14px]" numberOfLines={1} style={{ color: tone }} weight="semi-bold">
      {label}
    </Text>
  </View>
);

const AttachmentTile = ({
  attachment,
  index,
  onPress,
}: {
  attachment: TaskAttachment;
  index: number;
  onPress: () => void;
}) => (
  <PressableSurface
    accessibilityLabel={`${attachment.label} öffnen`}
    borderRadius={detailMetrics.attachmentRadius}
    className="h-32 w-36 overflow-hidden bg-accent-des"
    haptic="impact"
    onPress={onPress}
    pressedScale={0.97}
    style={{ borderRadius: detailMetrics.attachmentRadius }}
  >
    {attachment.uri ? (
      <Image source={{ uri: attachment.uri }} contentFit="cover" style={styles.attachmentImage} />
    ) : (
      <AttachmentArtwork attachment={attachment} />
    )}
    <View className="absolute inset-x-0 bottom-0 bg-[#16304F]/78 px-3 py-2.5">
      <Text className="text-white" numberOfLines={1} weight="bold">
        {attachment.label || `Bild ${index + 1}`}
      </Text>
      <Text className="pt-0.5 text-xs text-white/82">Antippen zum Öffnen</Text>
    </View>
  </PressableSurface>
);

const AttachmentPreview = ({
  attachments,
  initialIndex,
  onClose,
}: {
  attachments: TaskAttachment[];
  initialIndex: number;
  onClose: () => void;
}) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeAttachment = attachments[activeIndex];
  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex < attachments.length - 1;

  if (!activeAttachment) {
    return null;
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible>
      <View className="flex-1 bg-[#101418]">
        <View className="flex-row items-center justify-between px-5 pb-3 pt-14">
          <PressableSurface
            accessibilityLabel="Bildvorschau schließen"
            borderRadius={22}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/12"
            haptic="selection"
            onPress={onClose}
            pressedScale={0.94}
          >
            <SystemIcon name="chevron-left" color="white" size={24} />
          </PressableSurface>
          <View className="min-w-0 flex-1 px-4">
            <Text className="text-center text-[17px] text-white" numberOfLines={1} weight="bold">
              {activeAttachment.label}
            </Text>
            <Text className="pt-0.5 text-center text-sm text-white/62">
              {activeIndex + 1} von {attachments.length}
            </Text>
          </View>
          <View className="h-11 w-11" />
        </View>

        <View className="flex-1 justify-center px-4 pb-8">
          <View className="aspect-[3/4] max-h-full overflow-hidden rounded-[34px] bg-white/8">
            {activeAttachment.uri ? (
              <Image
                source={{ uri: activeAttachment.uri }}
                contentFit="contain"
                style={styles.previewImage}
              />
            ) : (
              <AttachmentArtwork attachment={activeAttachment} large />
            )}
          </View>
        </View>

        {attachments.length > 1 ? (
          <View className="flex-row items-center justify-center gap-4 px-6 pb-10">
            <Button
              disabled={!hasPrevious}
              label="Zurück"
              onPress={() => setActiveIndex((index) => Math.max(index - 1, 0))}
              size="sm"
            />
            <Button
              disabled={!hasNext}
              label="Weiter"
              onPress={() => setActiveIndex((index) => Math.min(index + 1, attachments.length - 1))}
              size="sm"
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

export const TaskScreen = ({ taskId }: { taskId: string }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getCourse } = useCourses();
  const { getTask, toggleTaskDone, deleteTask } = useTasks();
  const [previewIndex, setPreviewIndex] = useState<number | undefined>();
  const task = getTask(taskId);

  const detailModel = useMemo(() => (task ? getTaskDetailModel(task) : undefined), [task]);

  if (!task) {
    return (
      <>
        <Stack.Screen options={taskHeaderOptions} />
        <View className="flex-1 bg-background px-5 pt-6">
          <Text>Aufgabe nicht gefunden.</Text>
        </View>
      </>
    );
  }

  const course = getCourse(task.courseId);
  const dueColor = detailModel ? taskToneColor[detailModel.dueTone] : colors.accent.sec;

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
    haptics.toggle(!task.done);
    toggleTaskDone(task.id);
  };

  return (
    <>
      <Stack.Screen options={taskHeaderOptions} />

      <View className="flex-1 bg-background">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: insets.bottom + 102,
            paddingHorizontal: 20,
            paddingTop: Platform.OS === "ios" ? 10 : 18,
          }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <View
            className="bg-white shadow-sm"
            style={{
              borderRadius: detailMetrics.cardRadius,
              padding: detailMetrics.contentPadding,
              paddingBottom: detailMetrics.contentPadding + 2,
            }}
          >
            <View className="flex-row flex-wrap items-center gap-2">
              <MetadataChip icon="info" label={course?.name ?? "Kurs"} tone={colors.primary.text} />
              <MetadataChip
                icon="calendar-today"
                label={detailModel?.dueLabel ?? ""}
                tone={dueColor}
              />
            </View>

            <Text
              className="pt-4 text-primary-text"
              weight="bold"
              style={{
                fontFamily: fontNames.bold,
                fontSize: detailMetrics.titleFontSize,
                lineHeight: detailMetrics.titleLineHeight,
              }}
            >
              {task.title}
            </Text>

            <View className="mt-4 border-t border-[#E3E9F1] pt-4">
              <Text
                className="text-[#172033]"
                style={{
                  fontSize: detailMetrics.bodyFontSize,
                  lineHeight: detailMetrics.bodyLineHeight,
                }}
              >
                {task.description || "Keine Beschreibung hinterlegt."}
              </Text>
            </View>
          </View>

          <View className="pt-6">
            <View className="flex-row items-end justify-between px-1">
              <View>
                <Text className="text-2xl text-primary-text" weight="bold">
                  Bilder
                </Text>
                <Text className="pt-1 text-[15px] text-[#6B7280]">
                  {task.attachments.length > 0
                    ? "Tafelbilder und Notizen"
                    : "Keine Bilder hinterlegt"}
                </Text>
              </View>
              {task.attachments.length > 0 ? (
                <Text className="text-[15px] text-[#6B7280]" weight="semi-bold">
                  {task.attachments.length}
                </Text>
              ) : null}
            </View>

            {task.attachments.length > 0 ? (
              <ScrollView
                className="-mx-5 mt-4"
                contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {task.attachments.map((attachment, index) => (
                  <AttachmentTile
                    key={attachment.id}
                    attachment={attachment}
                    index={index}
                    onPress={() => setPreviewIndex(index)}
                  />
                ))}
              </ScrollView>
            ) : (
              <View className="mt-4 rounded-[28px] border border-dashed border-[#CBD5E1] bg-white/72 px-5 py-5">
                <Text className="text-[17px] leading-6 text-[#5B6472]">
                  Wenn du später Tafelbilder oder Skizzen ergänzt, erscheinen sie hier als Vorschau.
                </Text>
              </View>
            )}
          </View>

          <PressableSurface
            accessibilityLabel="Aufgabe löschen"
            borderRadius={22}
            className="mt-7 min-h-12 flex-row items-center justify-center gap-2 rounded-full bg-danger-des px-4"
            haptic="impact"
            onPress={confirmDelete}
            pressedScale={0.98}
          >
            <SystemIcon name="delete" color={colors.danger.DEFAULT} size={19} />
            <Text className="text-[16px] text-danger" weight="semi-bold">
              Aufgabe löschen
            </Text>
          </PressableSurface>
        </ScrollView>

        <View
          className="absolute inset-x-0 bottom-0 border-t border-[#E5E7EB] bg-white px-5 pt-3"
          style={[
            styles.bottomBarShadow,
            { paddingBottom: insets.bottom + detailMetrics.bottomPadding },
          ]}
        >
          {task.done ? (
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-des">
                <SystemIcon name="check" color={colors.primary.text} size={24} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[17px] text-primary-text" weight="bold">
                  Erledigt
                </Text>
                <Text className="text-sm text-[#6B7280]">Gut abgehakt.</Text>
              </View>
              <TextButton label="Zurücknehmen" onPress={toggleDone} size="sm" />
            </View>
          ) : (
            <View>
              <View className="flex-row items-center justify-between">
                <View className="min-w-0 flex-1 pr-4">
                  <Text className="text-[15px] text-[#6B7280]">Status</Text>
                  <Text className="text-[18px] text-[#172033]" weight="bold">
                    Noch offen
                  </Text>
                </View>
                <Text className="text-[15px] text-[#6B7280]" numberOfLines={1}>
                  {detailModel?.dueLabel}
                </Text>
              </View>
              <PressableSurface
                accessibilityLabel="Aufgabe als erledigt markieren"
                borderRadius={24}
                className="mt-2.5 h-12 flex-row items-center justify-center gap-2 rounded-full bg-accent"
                haptic="impact"
                onPress={toggleDone}
                pressedScale={0.985}
              >
                <SystemIcon name="check" color={colors.on.primary} size={21} />
                <Text className="text-[17px] text-white" weight="semi-bold">
                  Als erledigt markieren
                </Text>
              </PressableSurface>
            </View>
          )}
        </View>
      </View>

      {previewIndex !== undefined ? (
        <AttachmentPreview
          attachments={task.attachments}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(undefined)}
        />
      ) : null}
    </>
  );
};
