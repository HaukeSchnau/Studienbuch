import { ScrollView, View } from "react-native";
import { Stack } from "expo-router";

import {
  ExcusedAbsences,
  UnexcusedAbsences,
} from "./absences-list/absence-lists";

export const AbsencesPage = () => {
  return (
    <ScrollView>
      <View className="gap-16 p-8">
        <Stack.Screen
          options={{
            title: "Meine Fehlzeiten",
          }}
        />

        <UnexcusedAbsences />
        <ExcusedAbsences />
      </View>
    </ScrollView>
  );
};
