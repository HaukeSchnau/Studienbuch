import type { SubjectId } from "~/mock-app/domain";
import { subjectNameMap } from "~/mock-app/domain";
import { colors } from "~/theme/colors";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { SubjectIcon } from "./subject-icon";
import { Text } from "./text";

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
      <Pressable onPress={() => (value ? onChange(undefined) : onChange(options[0]))}>
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
    <Pressable
      onPress={() => {
        Alert.alert(
          subjectNameMap[subject],
          "Wähle einen Kurs",
          [
            ...options.map((option) => ({
              text: getOptionLabel(option),
              onPress: () => onChange(option),
            })),
            { text: "nicht belegt", onPress: () => onChange(undefined) },
            { text: "Abbrechen", style: "cancel" as const },
          ],
          { cancelable: true },
        );
      }}
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
    </Pressable>
  );
};
