import { requireNativeView } from "expo";
import type { ViewProps } from "react-native";

interface OnChangeEvent {
  index: number;
}

interface Props extends ViewProps {
  name: string;
  options: string[];
  onSelect?: (event: { nativeEvent: OnChangeEvent }) => void;
}

export const SelectView = requireNativeView<Props>("ExpoUI", "SelectView");
