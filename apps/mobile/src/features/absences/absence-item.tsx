import { format } from "date-fns";
import { Link } from "expo-router";
import { Alert, View } from "react-native";
import { OutlinedButton } from "~/components/button";
import { ConfirmationStatus } from "~/components/confirmation-status";
import { Text } from "~/components/text";
import { isAbsenceConfirmed, subjectNameMap, type Absence } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

export const AbsenceItem = ({ absence }: { absence: Absence }) => {
  const { user } = useRequiredAuthenticatedSession();
  const { getCourse, deleteAbsence } = useMockApp();
  const isExcused = isAbsenceConfirmed(absence, user.isOfAge);
  const courseLabels = absence.courseIds
    .map((courseId) => getCourse(courseId))
    .filter(Boolean)
    .map((course) => subjectNameMap[course!.subject])
    .join(", ");

  return (
    <View
      className={isExcused ? "rounded-2xl bg-primary-des p-6" : "rounded-2xl bg-danger-des p-6"}
    >
      <View className="flex-row gap-1">
        <View className="flex-1 gap-1">
          <Text>
            {format(absence.date, "dd.MM.yyyy")} ({courseLabels})
          </Text>
          <Text weight="medium" className="text-xl">
            {absence.reason}
          </Text>
          <ConfirmationStatus
            parent={Boolean(absence.parentSignature)}
            teacher={Boolean(absence.teacherSignature)}
            isOfAge={user.isOfAge}
            order="parentTeacher"
            confirmedText="Entschuldigt"
          />
        </View>
        {!isExcused && (
          <View className="items-end gap-1">
            <Link
              href={{
                pathname: "/absences/[date]/[courses]",
                params: {
                  date: absence.date.getTime(),
                  courses: absence.courseIds.join(";"),
                },
              }}
              asChild
            >
              <OutlinedButton label="Unterschreiben" />
            </Link>
            <OutlinedButton
              label="Löschen"
              onPress={() =>
                Alert.alert(
                  "Fehlzeit löschen",
                  "Bist du sicher, dass du diese Fehlzeit löschen möchtest?",
                  [
                    { text: "Abbrechen", style: "cancel" },
                    {
                      text: "Löschen",
                      style: "destructive",
                      onPress: () => deleteAbsence(absence.id),
                    },
                  ],
                )
              }
            />
          </View>
        )}
      </View>
    </View>
  );
};
