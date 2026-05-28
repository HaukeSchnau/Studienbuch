import ExpoBottomSheet, { BottomSheetView } from "@expo/ui/community/bottom-sheet";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Drawer } from "vaul";

interface Props {
  onClose: () => void;
  children: ReactNode;
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
  const isOpen = children !== null && children !== undefined;
  const [renderedChildren, setRenderedChildren] = useState(children);

  useEffect(() => {
    if (isOpen) {
      setRenderedChildren(children);
    }
  }, [children, isOpen]);

  if (!isOpen && (renderedChildren === null || renderedChildren === undefined)) {
    return null;
  }

  return (
    <ExpoBottomSheet
      index={isOpen ? 0 : -1}
      enableDynamicSizing
      enablePanDownToClose
      onClose={() => {
        setRenderedChildren(null);
        onClose();
      }}
      onDismiss={() => {
        setRenderedChildren(null);
      }}
    >
      <BottomSheetView>
        <Drawer.Title style={visuallyHiddenStyle}>Studienbuch Dialog</Drawer.Title>
        <Drawer.Description style={visuallyHiddenStyle}>
          Optionen und Eingaben fuer die aktuelle Ansicht.
        </Drawer.Description>
        {renderedChildren}
      </BottomSheetView>
    </ExpoBottomSheet>
  );
}
