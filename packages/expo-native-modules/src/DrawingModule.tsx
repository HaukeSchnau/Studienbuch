import type { Ref } from "react";
import type { ViewProps } from "react-native";
import { NativeModule, requireNativeModule, requireNativeView } from "expo";

export interface DrawingViewRef {
  getSVG(): Promise<string>;
}

interface Props extends ViewProps {
  ref: Ref<DrawingViewRef>;
}

declare class Module extends NativeModule {}

export const DrawingView = requireNativeView<Props>("DrawingModule");
export const DrawingModule = requireNativeModule<Module>("DrawingModule");
