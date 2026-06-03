import ExpoBottomSheet, { BottomSheetView } from "@expo/ui/community/bottom-sheet";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
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
      <BottomSheetView style={styles.sheetFill}>
        {Platform.OS === "ios" ? (
          <View pointerEvents="none" style={styles.iosMaterialFill} />
        ) : null}
        <View style={styles.sheetContent}>{children}</View>
      </BottomSheetView>
    </ExpoBottomSheet>
  );
}

const iosSheetTint = "rgba(251, 253, 255, 0.74)";

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.surface,
  },
  sheetFill: {
    backgroundColor: Platform.OS === "ios" ? "transparent" : colors.surface,
    overflow: "visible",
    position: "relative",
  },
  iosMaterialFill: {
    backgroundColor: iosSheetTint,
    bottom: -160,
    left: 0,
    position: "absolute",
    right: 0,
    top: -48,
  },
  sheetContent: {
    position: "relative",
  },
});
