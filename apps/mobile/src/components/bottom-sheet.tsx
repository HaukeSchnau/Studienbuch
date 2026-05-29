import ExpoBottomSheet, { BottomSheetView } from "@expo/ui/community/bottom-sheet";
import type { ReactNode } from "react";
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
      backgroundStyle={{ backgroundColor: colors.surface }}
    >
      <BottomSheetView style={{ backgroundColor: colors.surface }}>{children}</BottomSheetView>
    </ExpoBottomSheet>
  );
}
