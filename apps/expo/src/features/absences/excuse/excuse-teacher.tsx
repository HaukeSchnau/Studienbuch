import { Stack, useRouter } from "expo-router";

import type { AbsenceDayWithTeachers } from "@stu/lib";
import { formalName, isArraySingleElement } from "@stu/lib";

import { ConfirmPageContent } from "~/components/confirm-page-content";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

export const ExcuseTeacher = ({
  absence,
}: {
  absence: AbsenceDayWithTeachers;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const router = useRouter();
  const { date, reason } = absence;

  const utils = api.useUtils();
  const excuseMutation = api.students.absences.excuseTeacher.useMutation({
    onSuccess: async () => {
      await utils.students.absences.invalidate();
      router.back();
    },
  });
  if (!isArraySingleElement(absence.absenceCourses)) {
    return <Text>Ungültige Fehlzeit.</Text>;
  }

  const [absenceCourse] = absence.absenceCourses;

  const handleConfirm = (signature: string) =>
    excuseMutation.mutate({
      date: date,
      courseId: absenceCourse.course.id,
      signature,
    });

  // We ignore other teachers for now
  const [teacher] = absenceCourse.course.teachers;
  if (!teacher) {
    return <Text>Ungültige Fehlzeit.</Text>;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Fehlzeit entschuldigen (Lehrer)",
        }}
      />
      <ConfirmPageContent
        heading="Bitte lasse deinen Lehrer hier unterschreiben"
        major={reason}
        confirmLabel="Entschuldigen"
        onConfirm={handleConfirm}
        signatureLabel={`Unterschrift von ${formalName(teacher)}`}
      >
        Ich, {formalName(teacher)} bestätige, dass der/die Schüler:in{" "}
        <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{date.toLocaleDateString()}</Text> mit folgender
        Begründung nicht am Unterricht teilnehmen konnte:
      </ConfirmPageContent>
    </>
  );
};
