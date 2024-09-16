import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function TaskPage() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <View />;
}
