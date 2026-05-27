import { Stack } from "expo-router";
import { View } from "react-native";
import { ConfirmPageContent, ViewConfirmPageContent } from "~/components/confirm-page-content";
import { Text } from "~/components/text";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

export function ExcusePage({ date, courseIds }: { date: Date; courseIds: string[] }) {
  const { absences, signAbsence } = useMockApp();
  const { user } = useRequiredAuthenticatedSession();
  const absence = absences.find(
    (item) =>
      item.date.getTime() === date.getTime() && item.courseIds.join(";") === courseIds.join(";"),
  );

  if (!absence) {
    return (
      <View className="p-8">
        <Stack.Screen options={{ title: "Fehlzeit" }} />
        <Text>Fehlzeit nicht gefunden.</Text>
      </View>
    );
  }

  const needsParent = !user.isOfAge && !absence.parentSignature;
  const needsTeacher = !absence.teacherSignature;

  if (needsParent) {
    return (
      <View className="p-8">
        <Stack.Screen options={{ title: "Fehlzeit bestätigen (Eltern)" }} />
        <ConfirmPageContent
          heading="Bitte lasse deine Eltern hier unterschreiben"
          confirmLabel="Bestätigen"
          signatureLabel="Unterschrift eines Erziehungsberechtigten"
          onConfirm={() => signAbsence(absence.id, "parent")}
        >
          Ich habe zur Kenntnis genommen, dass mein Kind <Text weight="bold">{user.name}</Text> am{" "}
          <Text weight="bold">{date.toLocaleDateString("de-DE")}</Text> gefehlt hat.
        </ConfirmPageContent>
      </View>
    );
  }

  if (needsTeacher) {
    return (
      <View className="p-8">
        <Stack.Screen options={{ title: "Fehlzeit bestätigen (Lehrer)" }} />
        <ConfirmPageContent
          heading="Bitte lasse deine Lehrkraft hier unterschreiben"
          confirmLabel="Bestätigen"
          signatureLabel="Unterschrift der Lehrkraft"
          onConfirm={() => signAbsence(absence.id, "teacher")}
        >
          Ich bestätige, dass die Fehlzeit vom{" "}
          <Text weight="bold">{date.toLocaleDateString("de-DE")}</Text> entschuldigt wurde.
        </ConfirmPageContent>
      </View>
    );
  }

  return (
    <View className="p-8">
      <Stack.Screen options={{ title: "Fehlzeit bestätigt" }} />
      {!user.isOfAge && absence.parentSignature ? (
        <>
          <ViewConfirmPageContent
            signatureLabel="Unterschrift eines Erziehungsberechtigten"
            signatureSvg={absence.parentSignature}
          >
            Ich habe die Fehlzeit zur Kenntnis genommen.
          </ViewConfirmPageContent>
          <View className="h-16" />
        </>
      ) : null}
      {absence.teacherSignature ? (
        <ViewConfirmPageContent
          signatureLabel="Unterschrift der Lehrkraft"
          signatureSvg={absence.teacherSignature}
        >
          Die Entschuldigung wurde bestätigt.
        </ViewConfirmPageContent>
      ) : null}
    </View>
  );
}
