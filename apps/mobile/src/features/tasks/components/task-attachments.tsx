import type { TaskAttachment } from "~/compat/mobile-v0";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableSurface } from "~/ui/feedback/pressable-surface";
import { SystemIcon } from "~/ui/system-icon";
import { Text } from "~/ui/text";
import { haptics } from "~/infra/native/haptics";
import { colors } from "~/ui/colors";

const styles = StyleSheet.create({
  attachmentImage: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
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

const attachmentRadius = Platform.OS === "ios" ? 16 : 14;

const fallbackPattern = [
  { rotate: "-8deg", top: 16, left: 18, width: 74 },
  { rotate: "5deg", top: 46, left: 34, width: 110 },
  { rotate: "-3deg", top: 78, left: 24, width: 88 },
] as const;

const thumbnailRotations = ["-1.4deg", "1.1deg", "-0.8deg", "1.5deg"] as const;

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
      {fallbackPattern.map((line) => (
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
  const rotate = thumbnailRotations[index % thumbnailRotations.length] ?? thumbnailRotations[0];

  return (
    <View
      style={[
        styles.thumbnailFrame,
        styles.thumbnailShadow,
        {
          borderRadius: attachmentRadius,
          marginTop: index % 2 === 0 ? 0 : 8,
          transform: [{ rotate }],
        },
      ]}
    >
      <PressableSurface
        accessibilityLabel={`Bild ${index + 1} von ${total}: ${attachment.label || "Anhang"} öffnen`}
        accessibilityHint="Öffnet die Bildvorschau"
        borderRadius={attachmentRadius}
        className="absolute inset-0 overflow-hidden bg-accent-des"
        haptic="impact"
        onPress={onPress}
        pressedScale={0.96}
        style={[styles.thumbnailOutline, { borderRadius: attachmentRadius }]}
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
  const rotate = thumbnailRotations[index % thumbnailRotations.length] ?? thumbnailRotations[0];

  return (
    <View
      style={[
        styles.thumbnailFrame,
        styles.thumbnailShadow,
        {
          borderRadius: attachmentRadius,
          marginTop: index % 2 === 0 ? 0 : 8,
          transform: [{ rotate }],
        },
      ]}
    >
      <PressableSurface
        accessibilityLabel="Foto hinzufügen"
        accessibilityHint="Öffnet die Auswahl zwischen Kamera und Mediathek"
        borderRadius={attachmentRadius}
        className="absolute inset-0 items-center justify-center overflow-hidden border border-dashed border-[#B6C0CC] bg-white px-4"
        haptic="impact"
        onPress={onPress}
        pressedScale={0.96}
        style={{ borderRadius: attachmentRadius }}
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

export const AttachmentList = ({
  attachments,
  onOpen,
  onAdd,
}: {
  attachments: TaskAttachment[];
  onOpen: (index: number) => void;
  onAdd: () => void;
}) => (
  <ScrollView
    className="-mx-5 mt-1"
    contentContainerStyle={styles.thumbnailStripContent}
    horizontal
    showsHorizontalScrollIndicator={false}
  >
    {attachments.map((attachment, index) => (
      <AttachmentTile
        key={attachment.id}
        attachment={attachment}
        index={index}
        total={attachments.length}
        onPress={() => onOpen(index)}
      />
    ))}
    <AddAttachmentTile index={attachments.length} onPress={onAdd} />
  </ScrollView>
);

export const AttachmentPreview = ({
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
