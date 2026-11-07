import { useEffect, useRef, type ComponentRef } from "react";
import { AccessibilityInfo, type View } from "react-native";

/**
 * A ref for the view that takes the screen reader's focus when it mounts, such as a new step's
 * title: VoiceOver and TalkBack move there and read it (useFocusOnMount.web.ts on the web).
 */
export function useFocusOnMount() {
  const ref = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    if (ref.current !== null) AccessibilityInfo.sendAccessibilityEvent(ref.current, "focus");
  }, []);

  return ref;
}
