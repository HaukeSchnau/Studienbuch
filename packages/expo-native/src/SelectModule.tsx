import { NativeModule, requireNativeModule, requireNativeView } from "expo";
import type { ViewProps } from "react-native";

interface OnChangeEvent {
  index: number;
}

interface Props extends ViewProps {
  name: string;
  options: string[];
  onSelectItem?: (event: { nativeEvent: OnChangeEvent }) => void;
}

declare class Module extends NativeModule {}

export const SelectView = requireNativeView<Props>("SelectModule");
export const SelectModule = requireNativeModule<Module>("SelectModule");
