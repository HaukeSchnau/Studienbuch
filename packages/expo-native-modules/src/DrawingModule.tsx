import type { Ref } from "react";
import type { ViewProps } from "react-native";
import {
  requireNativeModule,
  requireNativeViewManager,
} from "expo-modules-core";

export interface DrawingViewRef {
  getSVG(): Promise<string>;
}

interface Props extends ViewProps {
  ref: Ref<DrawingViewRef>;
}

type Module = unknown;

export const DrawingView = requireNativeViewManager<Props>("DrawingModule");
export const DrawingModule = requireNativeModule<Module>("DrawingModule");
