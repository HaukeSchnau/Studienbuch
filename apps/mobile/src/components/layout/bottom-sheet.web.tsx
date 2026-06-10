import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { NativeBottomSheet, NativeBottomSheetView } from "~/components/native/expo-ui";
import { colors } from "~/theme/colors";

interface Props {
  onClose: () => void;
  children: ReactNode;
  iosSnapPoints?: (string | number)[];
}

const visuallyHiddenStyle = {
  position: "absolute" as const,
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden" as const,
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap" as const,
  border: 0,
};

export function PortaledBottomSheet({ children, onClose }: Props) {
  return (
    <NativeBottomSheet
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: colors.surface }}
    >
      <NativeBottomSheetView style={{ backgroundColor: colors.surface }}>
        <Drawer.Title style={visuallyHiddenStyle}>Studienbuch Dialog</Drawer.Title>
        <Drawer.Description style={visuallyHiddenStyle}>
          Optionen und Eingaben fuer die aktuelle Ansicht.
        </Drawer.Description>
        {children}
      </NativeBottomSheetView>
    </NativeBottomSheet>
  );
}
