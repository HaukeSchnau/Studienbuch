import { requireNativeViewManager } from "expo-modules-core";
import type { Ref } from "react";
import type { ViewProps } from "react-native";

export interface DrawingViewRef {
  getSVG(): Promise<string>;
}

interface Props extends ViewProps {
  ref: Ref<DrawingViewRef>;
}

export const DrawingView = requireNativeViewManager<Props>("DrawingModule");
