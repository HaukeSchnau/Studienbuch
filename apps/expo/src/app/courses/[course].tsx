import { View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { CoreLayout } from "~/components/core-layout";
import { Text } from "~/components/text";
import { api } from "~/utils/api";

export default function CoursePage() {
  const { course: courseId } = useLocalSearchParams<{
    course: string;
  }>();

  const course = api.students.courses.getOne.useQuery({ id: courseId });

  return (
    <CoreLayout>
      <Stack.Screen
        options={{
          header: () => <View></View>,
        }}
      />

      <Text>{course.data?.name}</Text>
    </CoreLayout>
  );
}
