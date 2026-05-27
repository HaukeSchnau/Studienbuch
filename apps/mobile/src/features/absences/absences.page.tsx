import { Stack } from "expo-router";
import { ScrollView, View } from "react-native";
import { Text } from "~/components/text";
import { isAbsenceConfirmed } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { AbsenceItem } from "./absence-item";

export const AbsencesPage = () => {
  const { absences } = useMockApp();
  const { user } = useRequiredAuthenticatedSession();
  const unexcused = absences.filter((absence) => !isAbsenceConfirmed(absence, user.isOfAge));
  const excused = absences.filter((absence) => isAbsenceConfirmed(absence, user.isOfAge));

  return (
    <ScrollView>
      <View className="gap-8 p-8">
        <Stack.Screen options={{ title: "Meine Fehlzeiten" }} />

        <View className="gap-2">
          <Text className="text-lg text-danger">unentschuldigte Fehlzeiten</Text>
          {unexcused.length > 0 ? (
            unexcused.map((absence) => <AbsenceItem key={absence.id} absence={absence} />)
          ) : (
            <Text className="text-center">Keine unentschuldigten Fehlzeiten gefunden</Text>
          )}
        </View>

        <View className="gap-2">
          <Text className="text-lg text-primary-text">entschuldigte Fehlzeiten</Text>
          {excused.length > 0 ? (
            excused.map((absence) => <AbsenceItem key={absence.id} absence={absence} />)
          ) : (
            <Text className="text-center">Keine entschuldigten Fehlzeiten gefunden</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};
