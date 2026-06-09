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
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableSurface } from "~/components/feedback/pressable-surface";
import { Button, TextButton } from "~/components/ui/button";
import { SystemIcon, type SystemIconName } from "~/components/ui/system-icon";
import { Text } from "~/components/ui/text";
import { SubjectIcon } from "~/domain-ui/subject-icon";
import { haptics } from "~/platform/haptics";
import { useCourses, useTasks } from "~/data/hooks";
import { colors } from "~/theme/colors";
import { fontNames } from "~/components/ui/text";
import { TaskPhotoSourceSheet } from "../components/task-photo-source-sheet";
import { useTaskPhotoPicker } from "../components/use-task-photo-picker";
import { createTaskAttachment } from "../model/task-attachments";
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
  thumbnailFrame: {
    height: 160,
    overflow: "visible",
    width: 128,
  },
  thumbnailShadow: {
    backgroundColor: colors.surface,
    elevation: 2,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.045,
    shadowRadius: 10,
  },
  thumbnailStripContent: {
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
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

const thumbnailRotations = ["-1.4deg", "1.1deg", "-0.8deg", "1.5deg"] as const;

const burstParticles = [
  { color: colors.primary.DEFAULT, size: 10, x: -82, y: -36 },
  { color: colors.accent.DEFAULT, size: 8, x: -52, y: -58 },
  { color: colors.alert.DEFAULT, size: 9, x: -18, y: -72 },
  { color: colors.primary.punch, size: 12, x: 22, y: -68 },
  { color: colors.accent.pale, size: 8, x: 56, y: -50 },
  { color: colors.alert.DEFAULT, size: 7, x: 84, y: -30 },
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
}) => {
  const rotate = thumbnailRotations[index % thumbnailRotations.length];

  return (
    <View
      style={[
        styles.thumbnailFrame,
        styles.thumbnailShadow,
        {
          borderRadius: detailMetrics.attachmentRadius,
          marginTop: index % 2 === 0 ? 0 : 8,
          transform: [{ rotate }],
        },
      ]}
    >
      <PressableSurface
        accessibilityLabel={`Bild ${index + 1} von ${total}: ${attachment.label || "Anhang"} öffnen`}
        accessibilityHint="Öffnet die Bildvorschau"
        borderRadius={detailMetrics.attachmentRadius}
        className="absolute inset-0 overflow-hidden bg-accent-des"
        haptic="impact"
        onPress={onPress}
        pressedScale={0.96}
        style={[styles.thumbnailOutline, { borderRadius: detailMetrics.attachmentRadius }]}
      >
        {attachment.uri ? (
          <Image
            source={{ uri: attachment.uri }}
            contentFit="cover"
            style={styles.attachmentImage}
          />
        ) : (
          <AttachmentArtwork attachment={attachment} />
        )}
      </PressableSurface>
    </View>
  );
};

const AddAttachmentTile = ({ index, onPress }: { index: number; onPress: () => void }) => {
  const rotate = thumbnailRotations[index % thumbnailRotations.length];

  return (
    <View
      style={[
        styles.thumbnailFrame,
        styles.thumbnailShadow,
        {
          borderRadius: detailMetrics.attachmentRadius,
          marginTop: index % 2 === 0 ? 0 : 8,
          transform: [{ rotate }],
        },
      ]}
    >
      <PressableSurface
        accessibilityLabel="Foto hinzufügen"
        accessibilityHint="Öffnet die Auswahl zwischen Kamera und Mediathek"
        borderRadius={detailMetrics.attachmentRadius}
        className="absolute inset-0 items-center justify-center overflow-hidden border border-dashed border-[#B6C0CC] bg-white px-4"
        haptic="impact"
        onPress={onPress}
        pressedScale={0.96}
        style={{ borderRadius: detailMetrics.attachmentRadius }}
      >
        <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-des">
          <SystemIcon name="add" color={colors.primary.text} size={28} />
        </View>
        <Text className="pt-3 text-center text-[15px] leading-5 text-[#52616F]" weight="bold">
          Foto hinzufügen
        </Text>
      </PressableSurface>
    </View>
  );
};

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
  const { height, width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isChromeVisible, setIsChromeVisible] = useState(true);
  const chromeOpacity = useSharedValue(1);
  const dragY = useSharedValue(0);
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

  const signalDismissGesture = useCallback(() => {
    haptics.selection();
  }, []);

  const toggleChrome = useCallback(() => {
    setIsChromeVisible((current) => !current);
  }, []);

  useEffect(() => {
    chromeOpacity.value = withTiming(isChromeVisible ? 1 : 0, {
      duration: 160,
      easing: Easing.out(Easing.quad),
    });
  }, [chromeOpacity, isChromeVisible]);

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: chromeOpacity.value * interpolate(dragY.value, [0, 150], [1, 0], Extrapolation.CLAMP),
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [0, 280], [1, 0.34], Extrapolation.CLAMP),
  }));

  const viewerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dragY.value },
      { scale: interpolate(dragY.value, [0, 320], [1, 0.92], Extrapolation.CLAMP) },
    ],
  }));

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

  const dismissGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .failOffsetX([-28, 28])
        .onUpdate((event) => {
          dragY.value = Math.max(event.translationY, 0);
        })
        .onEnd((event) => {
          const shouldDismiss = event.translationY > 110 || event.velocityY > 900;

          if (shouldDismiss) {
            runOnJS(signalDismissGesture)();
            dragY.value = withTiming(
              height * 0.72,
              {
                duration: 180,
                easing: Easing.out(Easing.quad),
              },
              (finished) => {
                if (finished) {
                  runOnJS(onClose)();
                }
              },
            );
            return;
          }

          dragY.value = withSpring(0, {
            damping: 22,
            mass: 0.75,
            stiffness: 260,
          });
        }),
    [dragY, height, onClose, signalDismissGesture],
  );

  const previewGesture = useMemo(
    () => Gesture.Simultaneous(Gesture.Native(), dismissGesture),
    [dismissGesture],
  );

  if (!activeAttachment) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={closePreview}
      presentationStyle="fullScreen"
      visible
    >
      <View className="flex-1 bg-black">
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 bg-[#101418]"
          style={backdropAnimatedStyle}
        />
        <Animated.View
          accessibilityElementsHidden={!isChromeVisible}
          className="flex-row items-center justify-between px-5 pb-3"
          importantForAccessibility={isChromeVisible ? "auto" : "no-hide-descendants"}
          pointerEvents={isChromeVisible ? "auto" : "none"}
          style={[controlsAnimatedStyle, { paddingTop: insets.top + 10 }]}
        >
          <PressableSurface
            accessibilityLabel="Bildvorschau schließen"
            borderRadius={22}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/12"
            haptic="selection"
            onPress={closePreview}
            pressedScale={0.94}
          >
            <SystemIcon name="close" color="white" size={22} />
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
        </Animated.View>

        <GestureDetector gesture={previewGesture}>
          <Animated.View className="min-h-0 flex-1" style={viewerAnimatedStyle}>
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
                <Pressable
                  key={attachment.id}
                  accessible={false}
                  className="justify-center px-4 pb-8"
                  onPress={toggleChrome}
                  style={{ width }}
                >
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
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </GestureDetector>

        {attachments.length > 1 ? (
          <Animated.View
            accessibilityElementsHidden={!isChromeVisible}
            className="flex-row items-center justify-center gap-2 px-6"
            importantForAccessibility={isChromeVisible ? "auto" : "no-hide-descendants"}
            pointerEvents={isChromeVisible ? "auto" : "none"}
            style={[controlsAnimatedStyle, { paddingBottom: insets.bottom + 18 }]}
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
          </Animated.View>
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
}) => {
  return (
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
};

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

const BurstParticle = ({
  particle,
  progress,
}: {
  particle: (typeof burstParticles)[number];
  progress: SharedValue<number>;
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.16, 0.78, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, particle.x]) },
      { translateY: interpolate(progress.value, [0, 1], [0, particle.y]) },
      { scale: interpolate(progress.value, [0, 0.22, 1], [0.25, 1, 0.65]) },
    ],
  }));

  return (
    <Animated.View
      className="absolute rounded-full"
      style={[
        animatedStyle,
        {
          backgroundColor: particle.color,
          height: particle.size,
          left: "50%",
          marginLeft: -particle.size / 2,
          top: 48,
          width: particle.size,
        },
      ]}
    />
  );
};

const CompletionBurst = () => {
  const progress = useSharedValue(0);
  const centerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.14, 0.68, 1], [0, 1, 1, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [8, -30]) },
      { scale: interpolate(progress.value, [0, 0.18, 1], [0.7, 1, 0.9]) },
    ],
  }));

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 760,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 items-center"
      style={{
        bottom: Platform.OS === "ios" ? 126 : 118,
        elevation: 3,
        height: 100,
        zIndex: 3,
      }}
    >
      {burstParticles.map((particle) => (
        <BurstParticle
          key={`${particle.x}-${particle.y}`}
          particle={particle}
          progress={progress}
        />
      ))}
      <Animated.View
        className="absolute h-12 w-12 items-center justify-center rounded-full bg-white"
        style={[
          centerStyle,
          {
            left: "50%",
            marginLeft: -24,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 10,
            top: 28,
          },
        ]}
      >
        <SystemIcon name="check" color={colors.primary.text} size={26} />
      </Animated.View>
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

            <ScrollView
              className="-mx-5 mt-1"
              contentContainerStyle={styles.thumbnailStripContent}
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
              <AddAttachmentTile
                index={task.attachments.length}
                onPress={() => setIsPhotoSourceVisible(true)}
              />
            </ScrollView>
          </View>
        </ScrollView>

        {completionBurstKey > 0 ? <CompletionBurst key={completionBurstKey} /> : null}

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
