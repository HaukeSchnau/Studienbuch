import { Stack } from "expo-router";
import { View } from "react-native";
import { ConfirmPageContent } from "~/components/confirm-page-content";
import { Text } from "~/components/text";
import type { Absence } from "~/mock-app/domain";
import { Teacher } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

export const ExcuseTeacher = ({ absence }: { absence: Absence }) => {
  const { signAbsence, getCourse } = useMockApp();
  const { user } = useRequiredAuthenticatedSession();
  const firstCourse = absence.courseIds[0] ? getCourse(absence.courseIds[0]) : undefined;
  const teacher = firstCourse?.teachers[0];

  if (!teacher) {
    return (
      <View className="p-8">
        <Text>Ungueltige Fehlzeit.</Text>
      </View>
    );
  }

  return (
    <View className="p-8">
      <Stack.Screen options={{ title: "Fehlzeit entschuldigen (Lehrer)" }} />
      <ConfirmPageContent
        heading="Bitte lasse deinen Lehrer hier unterschreiben"
        major={absence.reason}
        confirmLabel="Entschuldigen"
        onConfirm={() => signAbsence(absence.id, "teacher")}
        signatureLabel={`Unterschrift von ${Teacher.formalName(teacher)}`}
      >
        Ich, {Teacher.formalName(teacher)} bestaetige, dass der/die Schueler:in{" "}
        <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{absence.date.toLocaleDateString("de-DE")}</Text> mit folgender
        Begruendung nicht am Unterricht teilnehmen konnte:
      </ConfirmPageContent>
    </View>
  );
};
