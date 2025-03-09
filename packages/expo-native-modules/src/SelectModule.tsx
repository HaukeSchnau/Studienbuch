import type { ViewProps } from "react-native";
import { NativeModule, requireNativeModule, requireNativeView } from "expo";

interface OnChangeEvent {
  index: number;
}

interface Props extends ViewProps {
  name: string;
  options: string[];
  onSelect?: (event: { nativeEvent: OnChangeEvent }) => void;
}

declare class Module extends NativeModule<{}> {}

export const SelectView = requireNativeView<Props>("SelectModule");
export const SelectModule = requireNativeModule<Module>("SelectModule");
