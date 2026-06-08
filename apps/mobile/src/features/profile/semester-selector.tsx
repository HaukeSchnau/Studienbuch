import SegmentedControl from "@expo/ui/community/segmented-control";
import { colors } from "~/theme/colors";
import type { Semester } from "@stu/core";
import { haptics } from "~/platform/haptics";

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
      style={{ minHeight: 44 }}
      tintColor={colors.accent.DEFAULT}
      values={choices.map((semester) => semester.name)}
      selectedIndex={choices.findIndex((semester) => semester.name === selectedSemester.name)}
      onChange={(event) => {
        haptics.selection();
        onSelect(choices[event.nativeEvent.selectedSegmentIndex]!);
      }}
    />
  );
};
