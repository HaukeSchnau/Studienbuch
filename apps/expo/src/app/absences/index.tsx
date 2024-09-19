import { View } from "react-native";

import {
  ExcusedAbsences,
  UnexcusedAbsences,
} from "~/features/absences/absences-list/absence-lists";

export default function AbsencesPage() {
  return (
    <View className="gap-16 p-8">
      <UnexcusedAbsences />
      <ExcusedAbsences />
    </View>
  );
}
