import { FieldGroup, Host, ListItem } from "@expo/ui";
import type { ReactNode } from "react";
import { View } from "react-native";

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
      <Host style={{ width: "100%" }}>
        <FieldGroup>{children}</FieldGroup>
      </Host>
    </View>
  );
}

export function NativeFieldSection({ children, title }: NativeFieldSectionProps) {
  return <FieldGroup.Section title={title}>{children}</FieldGroup.Section>;
}

export function NativeFieldRow({
  title,
  subtitle,
  trailing,
  onPress,
  testID,
}: NativeFieldRowProps) {
  return (
    <ListItem
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
    </ListItem>
  );
}
