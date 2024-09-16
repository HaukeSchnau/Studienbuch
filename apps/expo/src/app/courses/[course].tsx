import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function CoursePage() {
  const { course } = useLocalSearchParams<{
    course: string;
  }>();

  return <View />;
}
