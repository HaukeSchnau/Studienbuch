import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { Text } from "~/components/text";
import { getOne } from "../queries";
import { ExcuseParent } from "./excuse-parent";
import { ExcuseTeacher } from "./excuse-teacher";

export const ExcusePage = ({ date, courseIds }: { date: Date; courseIds: string[] }) => {
  const absences = useQuery({
    ...getOne({ date, courseIds }),
  });

  if (absences.isPending) {
    return <ActivityIndicator />;
  }

  if (absences.isError) {
    return <Text>Error: {absences.error.message}</Text>;
  }

  const absence = absences.data;

  if (!absence) {
    return <Text>Keine unentschuldigten Fehlzeiten gefunden.</Text>;
  }

  return (
    <View className="p-8">
      <Stack.Screen
        options={{
          title: "Fehlzeit entschuldigen",
          headerBackTitle: "Zurück",
        }}
      />

      {!absence.parentSignature ? <ExcuseParent absence={absence} /> : <ExcuseTeacher absence={absence} />}
    </View>
  );
};
