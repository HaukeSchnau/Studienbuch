import { Pressable, StyleSheet, View } from "react-native";
import { SelectView } from "@stu/expo-native";

import type { SubjectId } from "@stu/lib";
import { isArraySingleElement, subjectNameMap } from "@stu/lib";
import { colors } from "@stu/tailwind-config/native";

import { SubjectIcon } from "./subject-icon";
import { Text } from "./text";

interface Props<TOption> {
  subject: SubjectId;
  value: TOption;
  getOptionLabel: (option: TOption) => string;
  options: TOption[];
  onChange: (value: TOption | undefined) => void;
}

const styles = StyleSheet.create({
  container: {
    height: 75,
    borderRadius: 24,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rightCol: {
    flex: 1,
    gap: 2,
  },
});

export const SelectCourse = <TOption,>({
  getOptionLabel,
  subject,
  value,
  onChange,
  options,
}: Props<TOption>) => {
  const content = (
    <>
      <SubjectIcon subject={subject} />
      <View style={styles.rightCol}>
        <Text
          style={{
            color: value ? "#ffffff" : "#000000",
          }}
          numberOfLines={1}
        >
          {subjectNameMap[subject]}
        </Text>
        <Text
          style={{
            color: value ? "#ffffff" : "#000000",
            fontSize: 12,
          }}
          numberOfLines={1}
        >
          {getOptionLabel(value)}
        </Text>
      </View>
    </>
  );

  if (isArraySingleElement(options)) {
    return (
      <Pressable
        onPress={() => (value ? onChange(undefined) : onChange(options[0]))}
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor: value
                ? colors.primary.DEFAULT
                : colors.neutral.sec,
            },
          ]}
        >
          {content}
        </View>
      </Pressable>
    );
  }

  return (
    <SelectView
      name={subjectNameMap[subject]}
      options={options.map(getOptionLabel).concat("nicht belegt")}
      onSelectItem={(event) => {
        onChange(options[event.nativeEvent.index]);
      }}
      style={[
        styles.container,
        {
          backgroundColor: value ? colors.primary.DEFAULT : colors.neutral.sec,
        },
      ]}
    >
      {content}
    </SelectView>
  );
};
