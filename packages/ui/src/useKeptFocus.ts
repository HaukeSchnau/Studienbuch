import { useRef, type ComponentRef, type RefObject } from "react";
import type { View } from "react-native";

export interface KeptFocus {
  /** For the item's control, such as TickBox's `kept`. */
  readonly control: {
    readonly ref: RefObject<ComponentRef<typeof View> | null>;
    readonly onFocus: () => void;
    readonly onUsed: () => void;
  };
  /** For the item's view, which scrolls into view after a move. */
  readonly item: RefObject<ComponentRef<typeof View> | null>;
}

/**
 * For an item that its list may move, such as a homework card that moves once it is ticked.
 * useKeptFocus.web.ts gives the keyboard focus back after the move. On the phones the hook only
 * holds the refs: how VoiceOver and TalkBack follow a moved control is untested.
 */
export function useKeptFocus(_key: string | undefined): KeptFocus {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const item = useRef<ComponentRef<typeof View>>(null);

  return { control: { ref, onFocus: () => undefined, onUsed: () => undefined }, item };
}
