import type { SubjectId } from "@stu/core";
import { subjectNameMap } from "@stu/core";
import { Text } from "~/components/ui/text";
import { colors } from "~/theme/colors";
import MenuView from "@expo/ui/community/menu";
import { Pressable, StyleSheet, View } from "react-native";
import { haptics } from "~/platform/haptics";
import { SubjectIcon } from "./subject-icon";

interface Props<TOption> {
  subject: SubjectId;
  value: TOption | undefined;
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
          {value ? getOptionLabel(value) : "nicht belegt"}
        </Text>
      </View>
    </>
  );

  if (options.length === 1) {
    return (
      <Pressable
        onPress={() => {
          const nextValue = value ? undefined : options[0];
          haptics.toggle(Boolean(nextValue));
          onChange(nextValue);
        }}
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor: value ? colors.primary.DEFAULT : colors.neutral.sec,
            },
          ]}
        >
          {content}
        </View>
      </Pressable>
    );
  }

  return (
    <MenuView
      actions={[
        ...options.map((option, index) => ({
          id: String(index),
          title: getOptionLabel(option),
          state: value === option ? ("on" as const) : ("off" as const),
        })),
        {
          id: "none",
          title: "nicht belegt",
          state: value ? ("off" as const) : ("on" as const),
        },
      ]}
      onPressAction={(event) => {
        const actionId = event.nativeEvent.event;
        haptics.selection();
        onChange(actionId === "none" ? undefined : options[Number(actionId)]);
      }}
      title={subjectNameMap[subject]}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: value ? colors.primary.DEFAULT : colors.neutral.sec,
            pointerEvents: "none",
          },
        ]}
      >
        {content}
      </View>
    </MenuView>
  );
};
