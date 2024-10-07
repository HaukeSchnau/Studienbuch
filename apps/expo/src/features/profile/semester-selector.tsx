import { View } from "react-native";

import type { Semester } from "@stu/lib";

import { TextButton } from "~/components/button";

interface SemesterSelectorProps {
  choices: Semester[];
  onSelect: (semester: Semester) => void;
}

export const SemesterSelector = ({
  choices,
  onSelect,
}: SemesterSelectorProps) => {
  return choices.map((semester) => {
    return (
      <View key={semester.name}>
        <TextButton label={semester.name} onPress={() => onSelect(semester)} />
      </View>
    );
  });
};
