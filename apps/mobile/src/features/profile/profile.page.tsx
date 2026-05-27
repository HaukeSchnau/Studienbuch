import { Tabs } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Text } from "~/components/text";
import { findCurrentSemester } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { CourseList } from "./course-list";
import { Header } from "./profile-header";
import { SemesterSelector } from "./semester-selector";

export const ProfilePage = () => {
  const { semesters } = useMockApp();
  const [selectedSemester, setSelectedSemester] = useState(findCurrentSemester(semesters)!);

  return (
    <ScrollView>
      <View className="p-8">
        <Tabs.Screen options={{ header: () => <Header /> }} />
        {semesters.length > 0 ? (
          <View className="px-6 py-4">
            <SemesterSelector
              choices={semesters}
              selectedSemester={selectedSemester}
              onSelect={setSelectedSemester}
            />
            <View className="h-4" />
            <CourseList semester={selectedSemester} />
          </View>
        ) : (
          <Text>Keine Semester gefunden</Text>
        )}
      </View>
    </ScrollView>
  );
};
