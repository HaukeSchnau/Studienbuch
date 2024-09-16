import type { ReactNode } from "react";
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { shadow } from "./styles/shadow";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const FULLY_OPEN = -SCREEN_HEIGHT * 0.7;
const SEMI_OPEN = -SCREEN_HEIGHT * 0.4;
const FULLY_CLOSED = 0;

interface Props {
  onClose: () => void;
  children: ReactNode;
}

export default function BottomSheet({ children, onClose }: Props) {
  const isOpen = !!children;
  const previousChildren = useRef(children);
  if (isOpen) {
    previousChildren.current = children;
  }

  const [isClosed, setIsClosed] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setIsClosed(false);
    }
  }, [isOpen]);

  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });

  useAnimatedReaction(
    () => translateY.value,
    (value) => {
      if (value === FULLY_CLOSED && !isOpen) {
        runOnJS(setIsClosed)(true);
      }
    },
  );

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((e) => {
      translateY.value = e.translationY + context.value.y;
      translateY.value = Math.max(translateY.value, FULLY_OPEN);
    })
    .onEnd((e) => {
      const v = e.velocityY;
      const target = translateY.value + v * 0.2;
      if (target < SEMI_OPEN - (SEMI_OPEN - FULLY_OPEN) / 2) {
        translateY.value = withSpring(FULLY_OPEN);
      } else if (target > SEMI_OPEN - SEMI_OPEN / 2) {
        translateY.value = withSpring(FULLY_CLOSED);
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(SEMI_OPEN);
      }
    });

  /**
   * Animated style for the bottom sheet
   */
  const reanimatedBottomStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const animatedBackgroundStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        translateY.value,
        [FULLY_CLOSED, FULLY_OPEN],
        [0, 0.5],
      ),
    };
  });

  /**
   * Scrolls to a specific destination
   */
  const scrollTo = (destination: number) => {
    "worklet";
    translateY.value = withSpring(destination, { damping: 50 });
  };

  useEffect(() => {
    // Initial scroll to show the bottom sheet partially
    if (isOpen) {
      scrollTo(SEMI_OPEN);
    } else {
      scrollTo(FULLY_CLOSED);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (isClosed) {
    return null;
  }

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        <Pressable
          onPress={() => {
            translateY.value = withSpring(FULLY_CLOSED);
            onClose();
          }}
          style={{ flex: 1 }}
        >
          <Animated.View style={[styles.bg, animatedBackgroundStyle]} />
        </Pressable>
        <Animated.View
          style={[styles.bottomSheet, reanimatedBottomStyle, shadow]}
        >
          <View style={styles.line} />
          {previousChildren.current}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  bg: {
    backgroundColor: "#000",
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  bottomSheet: {
    width: "100%",
    backgroundColor: "#fff",
    position: "absolute",
    height: SCREEN_HEIGHT,
    top: SCREEN_HEIGHT,
    zIndex: 12000,
    borderRadius: 25,
  },
  line: {
    width: 75,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 20,
    alignSelf: "center",
    marginVertical: 10,
  },
});
