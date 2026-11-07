import { useState } from "react";
import type { LayoutChangeEvent, LayoutRectangle } from "react-native";

/**
 * Where a view was laid out, `undefined` until its first layout. Pass `onLayout` to the view, for a
 * drawing or a size that follows it, as the hero's swoosh and the sign-in card do.
 */
export function useLayout() {
  const [layout, setLayout] = useState<LayoutRectangle | undefined>(undefined);

  return {
    layout,
    onLayout: (event: LayoutChangeEvent) => setLayout(event.nativeEvent.layout),
  };
}
