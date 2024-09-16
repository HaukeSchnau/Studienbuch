import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function ExcuseAbsencePage() {
  const { course, date } = useLocalSearchParams<{
    course: string;
    date: string;
  }>();

  return <View></View>;
}
