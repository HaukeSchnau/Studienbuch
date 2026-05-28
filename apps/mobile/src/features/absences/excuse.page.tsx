import { Stack } from "expo-router";
import { View } from "react-native";
import { ViewConfirmPageContent } from "~/components/confirm-page-content";
import { Text } from "~/components/text";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { ExcuseParent } from "./excuse/excuse-parent";
import { ExcuseTeacher } from "./excuse/excuse-teacher";

export function ExcusePage({ date, courseIds }: { date: Date; courseIds: string[] }) {
  const { absences } = useMockApp();
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

  if (!user.isOfAge && !absence.parentSignature) {
    return <ExcuseParent absence={absence} />;
  }

  if (!absence.teacherSignature) {
    return <ExcuseTeacher absence={absence} />;
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
