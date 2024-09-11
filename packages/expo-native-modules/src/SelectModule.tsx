import type { ViewProps } from "react-native";
import {
  requireNativeModule,
  requireNativeViewManager,
} from "expo-modules-core";

interface OnChangeEvent {
  index: number;
}

interface Props extends ViewProps {
  name: string;
  options: string[];
  onSelect?: (event: { nativeEvent: OnChangeEvent }) => void;
}

interface Module {}

export const SelectView = requireNativeViewManager<Props>("SelectModule");
export const SelectModule = requireNativeModule<Module>("SelectModule");
