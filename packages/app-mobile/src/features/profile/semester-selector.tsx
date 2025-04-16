import SegmentedControl from "@react-native-segmented-control/segmented-control";

import type { Semester } from "@stu/lib";

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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The index is guaranteed to be in bounds because the values are mapped from the choices array.
        onSelect(choices[event.nativeEvent.selectedSegmentIndex]!);
      }}
    />
  );
};
