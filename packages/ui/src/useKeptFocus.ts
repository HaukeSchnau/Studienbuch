import { useRef, type ComponentRef } from "react";
import type { View } from "react-native";

/**
 * A ref for a control that its list may move once it is used, and `onUsed` for its press.
 * useKeptFocus.web.ts gives the keyboard focus back after the move. On the phones the hook only
 * holds the ref: how VoiceOver and TalkBack follow a moved control is untested.
 */
export function useKeptFocus(_key: string | undefined) {
  const ref = useRef<ComponentRef<typeof View>>(null);

  return { ref, onUsed: () => undefined };
}
