import { useEffect } from "react";
import { AccessibilityInfo } from "react-native";

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
