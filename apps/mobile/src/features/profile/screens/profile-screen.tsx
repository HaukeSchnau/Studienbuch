import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useMainTabBarPadding } from "~/components/use-main-tab-bar-padding";
import { Text } from "~/components/text";
import { findCurrentSemester } from "@stu/core";
import { useMockApp } from "~/mock-app/provider";
import { CourseList } from "../course-list";
import { Header } from "../profile-header";
import { SemesterSelector } from "../semester-selector";

export const ProfileScreen = () => {
  const { semesters } = useMockApp();
  const [selectedSemester, setSelectedSemester] = useState(findCurrentSemester(semesters)!);
  const bottomPadding = useMainTabBarPadding(24);

  return (
    <View className="flex-1 overflow-hidden bg-background">
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
      >
        <Header />
        {semesters.length > 0 ? (
          <View className="px-5 pt-3">
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
    </View>
  );
};
