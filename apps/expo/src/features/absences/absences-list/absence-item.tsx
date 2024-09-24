import { View } from "react-native";
import { Link } from "expo-router";
import clsx from "clsx";
import { format } from "date-fns";

import { subjectNameMap } from "@stu/lib";

import type { AbsenceGroup } from "./types";
import { OutlinedButton } from "~/components/button";
import { ConfirmationStatus } from "~/components/confirmation-status";
import { Text } from "~/components/text";
import { api } from "~/utils/api";

interface AbsenceViewProps {
  absenceGroup: AbsenceGroup;
}

export const AbsenceItem = ({ absenceGroup }: AbsenceViewProps) => {
  const isExcused =
    absenceGroup.isExcusedByTeacher && absenceGroup.isExcusedByParent;
  const { data: session } = api.auth.getSession.useQuery();

  if (!session?.user) {
    return null;
  }

  const params = new URLSearchParams();
  for (const absence of absenceGroup.absences) {
    params.append("course", absence.course.id.toString());
  }

  return (
    <View
      className={clsx(
        "flex-row gap-1 rounded-2xl p-6",
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
          isOfAge={session.user.isOfAge}
          order="parentTeacher"
          confirmedText="Entschuldigt"
        />
      </View>
      <View>
        <Link
          href={{
            pathname: `/absences/[date]/[courses]/excuse`,
            params: {
              date: absenceGroup.date.getTime(),
              courses: absenceGroup.absences.map((a) => a.course.id).join(";"),
            },
          }}
          asChild
        >
          <OutlinedButton label="Unterschreiben" />
        </Link>
      </View>
    </View>
  );
};
