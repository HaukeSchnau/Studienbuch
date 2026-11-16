import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";
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

  return (
    // oxlint-disable-next-line studienbuch/require-registered-list-scroll -- the system sheet has no header or tab bar to scroll under.
    <ScrollView
      style={{ backgroundColor: color.surface }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Tokens.space.xl }]}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Tokens.space.xxl,
    paddingHorizontal: Tokens.layout.cardPadding + Tokens.space.sm,
  },
});
