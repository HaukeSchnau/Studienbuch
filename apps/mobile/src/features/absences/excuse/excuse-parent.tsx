import { Stack } from "expo-router";
import { View } from "react-native";
import { ConfirmPageContent } from "~/components/confirm-page-content";
import { Text } from "~/components/text";
import type { Absence } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

export const ExcuseParent = ({ absence }: { absence: Absence }) => {
  const { signAbsence } = useMockApp();
  const { user } = useRequiredAuthenticatedSession();

  return (
    <View className="p-8">
      <Stack.Screen options={{ title: "Fehlzeit entschuldigen (Eltern)" }} />
      <ConfirmPageContent
        heading="Bitte lasse deine Eltern hier unterschreiben"
        major={absence.reason}
        confirmLabel="Entschuldigen"
        onConfirm={() => signAbsence(absence.id, "parent")}
        signatureLabel="Unterschrift des Erziehungsberechtigten"
      >
        Ich bestätige, dass mein Kind <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{absence.date.toLocaleDateString("de-DE")}</Text> mit folgender
        Begruendung nicht am Unterricht teilnehmen konnte.
      </ConfirmPageContent>
    </View>
  );
};
