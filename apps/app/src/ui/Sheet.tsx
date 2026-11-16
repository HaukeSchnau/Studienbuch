import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, Platform, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface SheetProps {
  /** What closes it from outside its content, which the system sheet does by its swipe. */
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/**
 * The content of a sheet route. On the phones the route is a system sheet (`formSheet`), which
 * draws the frame and closes on a swipe down; `Sheet.web.tsx` draws its own on the web.
 */
export function Sheet({ children }: SheetProps) {
  const { color } = Theme.useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useAndroidKeyboardHeight();

  return (
    // oxlint-disable-next-line studienbuch/require-registered-list-scroll -- the system sheet has no header or tab bar to scroll under.
    <ScrollView
      style={{ backgroundColor: color.surface }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Tokens.space.xl + keyboard },
      ]}
      // iOS only. Android gets the room from `useAndroidKeyboardHeight` below.
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/**
 * The open keyboard's height on Android, 0 elsewhere and while it is closed. The sheet adds it as
 * room below its content, so "Speichern" can scroll above the keyboard: Android has no
 * `automaticallyAdjustKeyboardInsets`, and KeyboardAvoidingView measures from the sheet's own top,
 * not the screen's, so it leaves too little.
 */
export function useAndroidKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const shown = Keyboard.addListener("keyboardDidShow", (event) =>
      setHeight(event.endCoordinates.height),
    );

    const hidden = Keyboard.addListener("keyboardDidHide", () => setHeight(0));

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return height;
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Tokens.space.xxl,
    paddingHorizontal: Tokens.layout.cardPadding + Tokens.space.sm,
  },
});
