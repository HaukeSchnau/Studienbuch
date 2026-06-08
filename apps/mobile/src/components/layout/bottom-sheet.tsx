import ExpoBottomSheet, { BottomSheetView } from "@expo/ui/community/bottom-sheet";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { colors } from "~/theme/colors";

interface Props {
  onClose: () => void;
  children: ReactNode;
  iosSnapPoints?: (string | number)[];
}

export function PortaledBottomSheet({ children, iosSnapPoints, onClose }: Props) {
  const snapPoints = Platform.OS === "ios" ? iosSnapPoints : undefined;

  return (
    <ExpoBottomSheet
      index={0}
      enableDynamicSizing={!snapPoints}
      enablePanDownToClose
      onClose={onClose}
      snapPoints={snapPoints}
      backgroundStyle={Platform.OS === "ios" ? styles.iosSheetBackground : styles.sheetBackground}
      handleIndicatorStyle={Platform.OS === "ios" ? undefined : styles.androidHandle}
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
  iosSheetBackground: {
    backgroundColor: "rgba(251, 253, 255, 0.92)",
  },
  sheetBackground: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  androidHandle: {
    backgroundColor: "#7B8794",
    height: 4,
    opacity: 0.75,
    width: 48,
  },
  sheetFill: {
    backgroundColor: Platform.OS === "ios" ? "transparent" : colors.surface,
    overflow: "visible",
    position: "relative",
  },
  iosMaterialFill: {
    backgroundColor: iosSheetTint,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: -48,
  },
  sheetContent: {
    position: "relative",
  },
});
