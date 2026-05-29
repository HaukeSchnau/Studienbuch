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
    <ScrollView className="flex-1 bg-background">
      <Tabs.Screen options={{ header: () => <Header /> }} />
      {semesters.length > 0 ? (
        <View className="px-5 pb-8 pt-3">
          <SemesterSelector
            choices={semesters}
            selectedSemester={selectedSemester}
            onSelect={setSelectedSemester}
          />
          <View className="h-3" />
          <CourseList semester={selectedSemester} />
        </View>
      ) : (
        <View className="px-5 py-6">
          <Text>Keine Semester gefunden</Text>
        </View>
      )}
    </ScrollView>
  );
};
