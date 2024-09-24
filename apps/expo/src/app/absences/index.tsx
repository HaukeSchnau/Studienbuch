import { View } from "react-native";
import { Stack } from "expo-router";

import {
  ExcusedAbsences,
  UnexcusedAbsences,
} from "~/features/absences/absences-list/absence-lists";

export default function AbsencesPage() {
  return (
    <View className="gap-16 p-8">
      <Stack.Screen
        options={{
          title: "Meine Fehlzeiten",
          headerTintColor: "#FFFFFF",
        }}
      />

      <UnexcusedAbsences />
      <ExcusedAbsences />
    </View>
  );
}
