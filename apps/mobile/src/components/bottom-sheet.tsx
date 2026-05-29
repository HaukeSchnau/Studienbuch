import ExpoBottomSheet, { BottomSheetView } from "@expo/ui/community/bottom-sheet";
import type { ReactNode } from "react";

interface Props {
  onClose: () => void;
  children: ReactNode;
}

export function PortaledBottomSheet({ children, onClose }: Props) {
  return (
    <ExpoBottomSheet index={0} enableDynamicSizing enablePanDownToClose onClose={onClose}>
      <BottomSheetView>{children}</BottomSheetView>
    </ExpoBottomSheet>
  );
}
