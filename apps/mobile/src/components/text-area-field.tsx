import type { TextInputProps } from "react-native";
import { TextInput } from "react-native";

import { FieldSurface } from "./field-surface";
import { fontNames, Text } from "./text";

interface Props extends TextInputProps {
  label: string;
}

export const TextAreaField = ({ label, style, ...props }: Props) => {
  return (
    <FieldSurface className="px-6 py-4">
      <Text className="pb-2 text-sm opacity-60">{label}</Text>
      <TextInput
        {...props}
        multiline
        textAlignVertical="top"
        style={[
          {
            minHeight: 92,
            fontFamily: fontNames.regular,
          },
          style,
        ]}
      />
    </FieldSurface>
  );
};
