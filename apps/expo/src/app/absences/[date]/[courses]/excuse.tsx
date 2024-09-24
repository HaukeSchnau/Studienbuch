import { View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

export default function ExcuseAbsencePage() {
  const { courses: coursesStr, date: dateStr } = useLocalSearchParams<{
    date: string;
    courses: string;
  }>();
  const date = new Date(parseInt(dateStr));
  const courses = coursesStr.split(";");

  console.log(date, courses);

  return (
    <View>
      <Stack.Screen
        options={{
          title: "Fehlzeit entschuldigen",
          headerTintColor: "#FFFFFF",
          headerBackTitle: "Zurück",
        }}
      />
    </View>
  );
}
