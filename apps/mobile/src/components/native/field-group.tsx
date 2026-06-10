import type { ReactNode } from "react";
import { View } from "react-native";
import { NativeFieldGroupPrimitive, NativeHost, NativeListItem } from "~/components/native/expo-ui";

import { haptics } from "~/platform/haptics";

interface NativeFieldGroupProps {
  children: ReactNode;
  className?: string;
}

interface NativeFieldSectionProps {
  children: ReactNode;
  title?: string;
}

interface NativeFieldRowProps {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  testID?: string;
}

export function NativeFieldGroup({ children, className }: NativeFieldGroupProps) {
  return (
    <View className={className}>
      <NativeHost style={{ width: "100%" }}>
        <NativeFieldGroupPrimitive>{children}</NativeFieldGroupPrimitive>
      </NativeHost>
    </View>
  );
}

export function NativeFieldSection({ children, title }: NativeFieldSectionProps) {
  return (
    <NativeFieldGroupPrimitive.Section title={title}>{children}</NativeFieldGroupPrimitive.Section>
  );
}

export function NativeFieldRow({
  title,
  subtitle,
  trailing,
  onPress,
  testID,
}: NativeFieldRowProps) {
  return (
    <NativeListItem
      onPress={
        onPress
          ? () => {
              haptics.selection();
              onPress();
            }
          : undefined
      }
      supportingText={subtitle}
      testID={testID}
      trailing={trailing}
    >
      {title}
    </NativeListItem>
  );
}
