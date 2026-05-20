import { requireNativeViewManager } from "expo-modules-core";
import * as React from "react";
import type { ViewProps } from "react-native";

export type StudienbuchNativeBadgeViewProps = {
  title: string;
  accentColor?: string;
} & ViewProps;

const NativeView: React.ComponentType<StudienbuchNativeBadgeViewProps> =
  requireNativeViewManager("StudienbuchLocalModule");

export default function StudienbuchNativeBadgeView(props: StudienbuchNativeBadgeViewProps) {
  return <NativeView {...props} />;
}
