import type { StyleProp, ViewStyle } from "react-native";

export interface SectionProps {
  /**
   * On iOS, section titles are usually capitalized for consistency with platform conventions.
   */
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Section component uses the native [Section](https://developer.apple.com/documentation/swiftui/section) component.
 * It has no intrinsic dimensions, so it needs explicit height or flex set to display content (like ScrollView).
 * @platform ios
 */
export function Section({ children }: SectionProps) {
  return children;
}
