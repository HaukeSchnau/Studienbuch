import ExpoBottomSheet, { BottomSheetView } from "@expo/ui/community/bottom-sheet";
import type { ReactNode } from "react";
import { Platform, StyleSheet } from "react-native";
import { colors } from "~/theme/colors";

interface Props {
  onClose: () => void;
  children: ReactNode;
}

export function PortaledBottomSheet({ children, onClose }: Props) {
  return (
    <ExpoBottomSheet
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={Platform.OS === "ios" ? undefined : styles.sheetBackground}
    >
      <BottomSheetView style={styles.sheetFill}>{children}</BottomSheetView>
    </ExpoBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.surface,
  },
  sheetFill: {
    backgroundColor: Platform.OS === "ios" ? "rgba(251, 253, 255, 0.54)" : colors.surface,
    marginTop: Platform.OS === "ios" ? -16 : 0,
    paddingTop: Platform.OS === "ios" ? 16 : 0,
    marginBottom: Platform.OS === "ios" ? -28 : 0,
    paddingBottom: Platform.OS === "ios" ? 28 : 0,
  },
});
