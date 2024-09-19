import { View } from "react-native";
import clsx from "clsx";
import { format } from "date-fns";

import { subjectNameMap } from "@stu/lib";

import type { AbsenceGroup } from "./types";
import { Text } from "~/components/text";

interface AbsenceViewProps {
  absenceGroup: AbsenceGroup;
}

export const AbsenceItem = ({ absenceGroup }: AbsenceViewProps) => {
  const isExcused =
    absenceGroup.isExcusedByTeacher && absenceGroup.isExcusedByParent;

  return (
    <View
      className={clsx(
        "flex-row rounded-2xl p-6",
        isExcused ? "bg-primary-des" : "bg-danger-des",
      )}
    >
      <View className="flex-1 gap-1">
        <Text>
          {format(absenceGroup.date, "dd.MM.yyyy")} (
          {absenceGroup.absences
            .map((a) => subjectNameMap[a.course.subject])
            .join(", ")}
          )
        </Text>
        <Text weight="medium" className="text-xl">
          {absenceGroup.reason}
        </Text>
        <ConfirmationStatus
          parent={absenceGroup.isExcusedByParent}
          teacher={absenceGroup.isExcusedByTeacher}
        />
      </View>
    </View>
  );
};

const ConfirmationStatus = ({
  parent,
  teacher,
}: {
  parent: boolean;
  teacher: boolean;
}) => {
  return <></>;
};
