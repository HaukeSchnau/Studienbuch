import type { Course, TaskAttachment } from "@stu/core";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableSurface } from "~/components/feedback/pressable-surface";
import { Button, TextButton } from "~/components/ui/button";
import { SystemIcon } from "~/components/ui/system-icon";
import { Text } from "~/components/ui/text";
import { SubjectIcon } from "~/domain-ui/subject-icon";
import { haptics } from "~/platform/haptics";
import { useCourses, useTasks } from "~/data/hooks";
import { colors } from "~/theme/colors";
import { fontNames } from "~/components/ui/text";
import { getTaskDetailModel } from "../model/task-detail-model";

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
  detailCard: {
    overflow: "hidden",
  },
  previewImage: {
    height: "100%",
    width: "100%",
  },
  previewFrame: {
    borderRadius: Platform.OS === "ios" ? 24 : 18,
  },
  thumbnailOutline: {
    borderColor: "rgba(0, 0, 0, 0.1)",
    borderWidth: StyleSheet.hairlineWidth,
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
  cardRadius: Platform.OS === "ios" ? 22 : 20,
  contentPadding: Platform.OS === "ios" ? 20 : 20,
  titleFontSize: Platform.OS === "ios" ? 30 : 29,
  titleLineHeight: Platform.OS === "ios" ? 36 : 35,
  bodyFontSize: Platform.OS === "ios" ? 17 : 18,
  bodyLineHeight: Platform.OS === "ios" ? 26 : 28,
  attachmentRadius: Platform.OS === "ios" ? 16 : 14,
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

const AttachmentTile = ({
  attachment,
  index,
  total,
  onPress,
}: {
  attachment: TaskAttachment;
  index: number;
  total: number;
  onPress: () => void;
}) => (
  <PressableSurface
    accessibilityLabel={`Bild ${index + 1} von ${total}: ${attachment.label || "Anhang"} öffnen`}
    accessibilityHint="Öffnet die Bildvorschau"
    borderRadius={detailMetrics.attachmentRadius}
    className="h-40 w-32 overflow-hidden bg-accent-des"
    haptic="impact"
    onPress={onPress}
    pressedScale={0.96}
    style={[styles.thumbnailOutline, { borderRadius: detailMetrics.attachmentRadius }]}
  >
    {attachment.uri ? (
      <Image source={{ uri: attachment.uri }} contentFit="cover" style={styles.attachmentImage} />
    ) : (
      <AttachmentArtwork attachment={attachment} />
    )}
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
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeAttachment = attachments[activeIndex];

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ animated: false, x: initialIndex * width, y: 0 });
    });

    return () => cancelAnimationFrame(frame);
  }, [initialIndex, width]);

  const closePreview = useCallback(() => {
    haptics.selection();
    onClose();
  }, [onClose]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);

      if (nextIndex !== activeIndex && nextIndex >= 0 && nextIndex < attachments.length) {
        haptics.selection();
        setActiveIndex(nextIndex);
      }
    },
    [activeIndex, attachments.length, width],
  );

  if (!activeAttachment) {
    return null;
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible>
      <View className="flex-1 bg-[#101418]">
        <View
          className="flex-row items-center justify-between px-5 pb-3"
          style={{ paddingTop: insets.top + 10 }}
        >
          <PressableSurface
            accessibilityLabel="Bildvorschau schließen"
            borderRadius={22}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/12"
            haptic="selection"
            onPress={closePreview}
            pressedScale={0.94}
          >
            <SystemIcon name="chevron-left" color="white" size={24} />
          </PressableSurface>
          <View className="min-w-0 flex-1 px-4">
            <Text className="text-center text-[17px] text-white" numberOfLines={1} weight="bold">
              {activeAttachment.label}
            </Text>
            {attachments.length > 1 ? (
              <Text className="pt-0.5 text-center text-sm text-white/62">
                {activeIndex + 1} von {attachments.length}
              </Text>
            ) : null}
          </View>
          <View className="h-11 w-11" />
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentOffset={{ x: initialIndex * width, y: 0 }}
          decelerationRate="fast"
          horizontal
          onMomentumScrollEnd={handleMomentumScrollEnd}
          pagingEnabled
          scrollEnabled={attachments.length > 1}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
        >
          {attachments.map((attachment) => (
            <View key={attachment.id} className="justify-center px-4 pb-8" style={{ width }}>
              <View
                className="aspect-[3/4] max-h-full overflow-hidden bg-white/8"
                style={styles.previewFrame}
              >
                {attachment.uri ? (
                  <Image
                    source={{ uri: attachment.uri }}
                    contentFit="contain"
                    style={styles.previewImage}
                  />
                ) : (
                  <AttachmentArtwork attachment={attachment} large />
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        {attachments.length > 1 ? (
          <View
            className="flex-row items-center justify-center gap-2 px-6"
            style={{ paddingBottom: insets.bottom + 18 }}
          >
            {attachments.map((attachment, index) => (
              <View
                key={attachment.id}
                className="h-2 rounded-full"
                style={{
                  backgroundColor: index === activeIndex ? "white" : "rgba(255,255,255,0.32)",
                  width: index === activeIndex ? 18 : 8,
                }}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

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

const HeaderEditButton = ({ onPress }: { onPress: () => void }) => {
  const iconColor = Platform.OS === "android" ? colors.on.primary : colors.primary.text;

  return (
    <Pressable
      accessibilityLabel="Hausaufgabe bearbeiten"
      accessibilityRole="button"
      className="h-11 w-11 items-center justify-center"
      hitSlop={10}
      onPress={onPress}
    >
      <SystemIcon name="edit" color={iconColor} size={23} />
    </Pressable>
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
    haptics.toggle(!task.done);
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
          headerRight: () => <HeaderEditButton onPress={showEditPlaceholder} />,
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
          <View
            className="bg-white shadow-sm"
            style={[styles.detailCard, { borderRadius: detailMetrics.cardRadius }]}
          >
            <View
              style={{
                padding: detailMetrics.contentPadding,
                paddingBottom: detailMetrics.contentPadding + 2,
              }}
            >
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
          </View>

          <View className="pt-6">
            <Text className="px-1 text-2xl text-primary-text" weight="bold">
              Bilder
            </Text>

            {task.attachments.length > 0 ? (
              <ScrollView
                className="-mx-5 mt-3"
                contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {task.attachments.map((attachment, index) => (
                  <AttachmentTile
                    key={attachment.id}
                    attachment={attachment}
                    index={index}
                    total={task.attachments.length}
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
            android_ripple={{
              borderless: false,
              color: "rgba(164, 43, 51, 0.12)",
              foreground: true,
            }}
            borderRadius={18}
            className="mt-5 min-h-11 flex-row items-center justify-center gap-2 self-start px-1"
            haptic="selection"
            highlightColor="rgba(164, 43, 51, 0.08)"
            highlightOpacity={Platform.OS === "ios" ? 1 : 0}
            onPress={confirmDelete}
            pressedScale={0.96}
          >
            <SystemIcon name="delete" color={colors.danger.DEFAULT} size={17} />
            <Text className="text-[15px] text-danger" weight="semi-bold">
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
            <View className="rounded-[24px] bg-primary-des px-3 py-3">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-white">
                  <SystemIcon name="check" color={colors.primary.text} size={24} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[17px] text-primary-text" weight="bold">
                    Erledigt
                  </Text>
                  <Text className="text-sm text-[#52616F]">
                    Gut abgehakt. {detailModel?.dueLabel}
                  </Text>
                </View>
                <TextButton label="Zurücknehmen" onPress={toggleDone} size="sm" />
              </View>
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
