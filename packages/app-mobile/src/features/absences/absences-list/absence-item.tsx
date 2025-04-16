import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { format } from "date-fns";
import { Link } from "expo-router";
import { Alert, View } from "react-native";

import { subjectNameMap } from "@stu/lib";

import { OutlinedButton } from "~/components/button";
import { ConfirmationStatus } from "~/components/confirmation-status";
import { Text } from "~/components/text";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { useIngest } from "~/utils/events/ingest";
import type { AbsenceItem as AbsenceItemType } from "./types";

interface AbsenceViewProps {
  absenceGroup: AbsenceItemType;
}

export const AbsenceItem = ({ absenceGroup }: AbsenceViewProps) => {
  const isExcused =
    absenceGroup.isExcusedByTeacher && absenceGroup.isExcusedByParent;
  const { user } = useRequiredAuthenticatedSession();
  const queryClient = useQueryClient();
  const deleteMutation = useIngest("absence.discarded", {
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["absences"],
      });
    },
  });

  const params = new URLSearchParams();
  for (const absence of absenceGroup.courses) {
    params.append("course", absence.id.toString());
  }

  const handleDelete = () => {
    Alert.alert(
      "Fehlzeit löschen",
      "Bist du sicher, dass du diese Fehlzeit löschen möchtest?",
      [
        {
          text: "Abbrechen",
          style: "cancel",
        },
        {
          text: "Löschen",
          style: "destructive",
          isPreferred: true,
          onPress: () => {
            deleteMutation.mutate({
              date: absenceGroup.date,
              courseIds: absenceGroup.courses.map((course) => course.id),
            });
          },
        },
      ],
      {
        cancelable: true,
      },
    );
  };

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
          {absenceGroup.courses
            .map((course) => subjectNameMap[course.subject])
            .join(", ")}
          )
        </Text>
        <Text weight="medium" className="text-xl">
          {absenceGroup.reason}
        </Text>
        <ConfirmationStatus
          parent={absenceGroup.isExcusedByParent}
          teacher={absenceGroup.isExcusedByTeacher}
          isOfAge={user.isOfAge}
          order="parentTeacher"
          confirmedText="Entschuldigt"
        />
      </View>
      {!isExcused && (
        <View className="items-end gap-1">
          <Link
            href={{
              pathname: `/absences/[date]/[courses]`,
              params: {
                date: absenceGroup.date.getTime(),
                courses: absenceGroup.courses
                  .map((course) => course.id)
                  .join(";"),
              },
            }}
            asChild
          >
            <OutlinedButton label="Unterschreiben" />
          </Link>

          <OutlinedButton label="Löschen" onPress={handleDelete} />
        </View>
      )}
    </View>
  );
};
