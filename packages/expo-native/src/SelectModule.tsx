import { requireNativeViewManager } from "expo-modules-core";
import type { ViewProps } from "react-native";

interface OnChangeEvent {
  index: number;
}

interface Props extends ViewProps {
  name: string;
  options: string[];
  onSelectItem?: (event: { nativeEvent: OnChangeEvent }) => void;
}

export const SelectView = requireNativeViewManager<Props>("SelectModule");
