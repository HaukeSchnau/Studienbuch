import { useEffect } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * Reads `text` out on the phones once it shows, and again when it changes, as an error that
 * appears under the button that failed. On the web, where this does nothing, give the text
 * `role="alert"`, which reads it out.
 */
export function useAnnounce(text: string) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(text);
  }, [text]);
}

/**
 * Reads a status line out on iOS when it shows or changes, after what VoiceOver is saying. Give
 * the line `accessibilityLiveRegion="polite"` for Android and the web; iOS has no live regions.
 */
export function useAnnounceStatus(text: string | undefined) {
  useEffect(() => {
    if (Platform.OS === "ios" && text !== undefined) {
      AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
    }
  }, [text]);
}
