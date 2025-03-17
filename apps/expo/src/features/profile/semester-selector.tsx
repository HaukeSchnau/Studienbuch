import { View } from "react-native";
import SegmentedControl from "@react-native-segmented-control/segmented-control";

import type { Semester } from "@stu/lib";

import { TextButton } from "~/components/button";

interface SemesterSelectorProps {
  choices: Semester[];
  onSelect: (semester: Semester) => void;
  selectedSemester: Semester;
}

export const SemesterSelector = ({
  choices,
  selectedSemester,
  onSelect,
}: SemesterSelectorProps) => {
  if (choices.length <= 1) {
    return null;
  }

  return (
    <SegmentedControl
      values={choices.map((semester) => semester.name)}
      selectedIndex={choices.findIndex(
        (semester) => semester.name === selectedSemester.name,
      )}
      onChange={(event) => {
        onSelect(choices[event.nativeEvent.selectedSegmentIndex]!);
      }}
    />
  );
};
