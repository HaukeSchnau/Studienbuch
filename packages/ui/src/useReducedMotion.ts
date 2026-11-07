import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useReducedMotion as useReducedMotionAtStart } from "react-native-reanimated";

/**
 * Whether the person asked for less motion, now. It starts from the setting Reanimated read when
 * the app started, and follows the system setting while the app runs, so a change in Settings
 * stops or starts the motion without a restart (useReducedMotion.web.ts on the web).
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(useReducedMotionAtStart());

  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);

    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);

    return () => subscription.remove();
  }, []);

  return reduced;
}
