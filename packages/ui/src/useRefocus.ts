import { useRef, type ComponentRef } from "react";
import { AccessibilityInfo, type View } from "react-native";

/**
 * A ref for a control that takes the focus back when something it opened goes away, such as a
 * calendar under its button once a day is picked: VoiceOver and TalkBack move to it on `refocus`
 * (useRefocus.web.ts on the web).
 */
export function useRefocus() {
  const ref = useRef<ComponentRef<typeof View>>(null);

  return {
    ref,
    refocus: () => {
      if (ref.current !== null) AccessibilityInfo.sendAccessibilityEvent(ref.current, "focus");
    },
  };
}
