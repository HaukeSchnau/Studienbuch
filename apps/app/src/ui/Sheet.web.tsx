import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

import type { SheetProps } from "./Sheet.tsx";

/**
 * Sheet.tsx on the web, which has no system sheet: a bottom sheet on narrow windows and a centred
 * dialog from the wide breakpoint on (m1-screens.md), over the whole dimmed window, tab bar and
 * rail included. react-native-web's Modal makes it a dialog, keeps the focus inside and closes on
 * Escape; a click beside it closes it too.
 */
export function Sheet({ onClose, children }: SheetProps) {
  const { color, elevation } = Theme.useTheme();
  const wide = useWindowDimensions().width >= Tokens.layout.wideBreakpoint;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, wide ? styles.centred : styles.bottom]}>
        <Pressable
          accessibilityLabel="Schließen"
          // A pointer target only; Escape and "Abbrechen" close it from the keyboard.
          tabIndex={-1}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            wide ? styles.dialog : styles.sheet,
            { backgroundColor: color.surface, boxShadow: elevation.float },
          ]}
        >
          {/* oxlint-disable-next-line studienbuch/require-registered-list-scroll -- the web's sheet has no native header or tab bar to scroll under. */}
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15, 28, 22, 0.45)" },
  bottom: { justifyContent: "flex-end" },
  centred: { justifyContent: "center", alignItems: "center", padding: Tokens.space.xl },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: Tokens.radius.panel,
    borderTopRightRadius: Tokens.radius.panel,
  },
  dialog: { width: "100%", maxWidth: 560, maxHeight: "90%", borderRadius: Tokens.radius.card },
  content: { padding: Tokens.space.xl },
});
