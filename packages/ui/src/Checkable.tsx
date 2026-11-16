import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { spaceKey } from "./spaceKey.ts";
import { Tokens } from "./Tokens.ts";
import type { KeptFocus } from "./useKeptFocus.ts";

export interface CheckableProps {
  /** A checkbox toggles; a radio is one option of the `radiogroup` around it. */
  readonly kind: "checkbox" | "radio";
  readonly checked: boolean;
  readonly onPress: () => void;
  /** What a screen reader says where the text inside doesn't, such as the homework's title. */
  readonly label?: string;
  /** `useKeptFocus` of the control's item, when a list may move it, such as a homework card. */
  readonly kept?: KeptFocus["control"];
  readonly style?: (state: PressableStateCallbackType) => StyleProp<ViewStyle>;
  readonly children: ReactNode;
}

/**
 * The pressable under every checkbox and choice. It states its role and checked state to
 * VoiceOver, TalkBack and the browser, answers Space and Enter on the web, and takes at least the
 * larger platform minimum as its touch target. Its look comes from `children` and `style`.
 */
export function Checkable({
  kind,
  checked,
  onPress,
  label,
  kept,
  style,
  children,
}: CheckableProps) {
  const press = () => {
    kept?.onUsed();
    onPress();
  };

  return (
    <Pressable
      ref={kept?.ref}
      onFocus={kept?.onFocus}
      accessibilityRole={kind}
      aria-checked={checked}
      accessibilityLabel={label}
      onPress={press}
      {...spaceKey(press)}
      style={(state) => [styles.target, style?.(state)]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    minWidth: Tokens.layout.minTarget,
    minHeight: Tokens.layout.minTarget,
    cursor: "pointer",
  },
});
