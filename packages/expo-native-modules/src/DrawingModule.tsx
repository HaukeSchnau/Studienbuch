import type { ViewProps } from "react-native";
import {
  requireNativeModule,
  requireNativeViewManager,
} from "expo-modules-core";

interface Props extends ViewProps {}

type Module = unknown;

export const DrawingView = requireNativeViewManager<Props>("DrawingModule");
export const DrawingModule = requireNativeModule<Module>("DrawingModule");
