import { ViewProps } from "react-native";
import {
  requireNativeModule,
  requireNativeViewManager,
} from "expo-modules-core";

interface Props extends ViewProps {
  name: string;
}

interface Module {}

export const SelectView = requireNativeViewManager<Props>("SelectModule");
export const SelectModule = requireNativeModule<Module>("SelectModule");
