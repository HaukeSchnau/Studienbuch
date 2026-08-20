import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const onAndroid = Platform.OS === "android";

const ignore = (promise: Promise<void>) => {
  void promise.catch(() => undefined);
};

export const haptics = {
  selection() {
    if (onAndroid) {
      ignore(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick));
      return;
    }

    ignore(Haptics.selectionAsync());
  },
  impact() {
    if (onAndroid) {
      ignore(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Gesture_Start));
      return;
    }

    ignore(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  success() {
    if (onAndroid) {
      ignore(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm));
      return;
    }

    ignore(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning() {
    if (onAndroid) {
      ignore(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject));
      return;
    }

    ignore(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  error() {
    if (onAndroid) {
      ignore(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject));
      return;
    }

    ignore(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
  toggle(nextValue: boolean) {
    if (onAndroid) {
      ignore(
        Haptics.performAndroidHapticsAsync(
          nextValue ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off,
        ),
      );
      return;
    }

    ignore(Haptics.selectionAsync());
  },
};
