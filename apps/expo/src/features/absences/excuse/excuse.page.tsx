import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";

import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { ExcuseParent } from "./excuse-parent";
import { ExcuseTeacher } from "./excuse-teacher";

export const ExcusePage = ({
  date,
  courseIds,
}: {
  date: Date;
  courseIds: string[];
}) => {
  const absences = api.students.absences.getOne.useQuery({
    date,
    courses: courseIds,
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
          headerTintColor: "#FFFFFF",
          headerBackTitle: "Zurück",
        }}
      />

      {!absence.parentSignature ? (
        <ExcuseParent absence={absence} />
      ) : (
        <ExcuseTeacher absence={absence} />
      )}
    </View>
  );
};
