import { requireNativeView } from "expo";
import * as React from "react";
import type { ViewProps } from "react-native";

export type StudienbuchInlineBadgeViewProps = {
  title: string;
  accentColor?: string;
} & ViewProps;

const NativeView: React.ComponentType<StudienbuchInlineBadgeViewProps> = requireNativeView(
  "StudienbuchInlineBadgeView",
);

export default function StudienbuchInlineBadgeView(props: StudienbuchInlineBadgeViewProps) {
  return <NativeView {...props} />;
}
