import type { RefObject } from "react";
import type { ViewProps } from "react-native";
import {
  requireNativeModule,
  requireNativeViewManager,
} from "expo-modules-core";

export interface DrawingViewRef {
  getSVG(): Promise<string>;
}

interface Props extends ViewProps {
  ref: RefObject<DrawingViewRef>;
}

type Module = unknown;

export const DrawingView = requireNativeViewManager<Props>("DrawingModule");
export const DrawingModule = requireNativeModule<Module>("DrawingModule");
