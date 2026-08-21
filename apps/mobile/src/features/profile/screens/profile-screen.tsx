import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useMainTabBarPadding } from "~/ui/use-main-tab-bar-padding";
import { Text } from "~/ui/text";
import { findCurrentSemester } from "~/compat/mobile-v0";
import { useSchool } from "~/infra/data/hooks";
import { CourseList } from "../course-list";
import { Header } from "../profile-header";

export const ProfileScreen = () => {
  const { semesters } = useSchool();
  const [selectedSemester, setSelectedSemester] = useState(findCurrentSemester(semesters));
  const displayedSemester = selectedSemester ?? findCurrentSemester(semesters);
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
        {displayedSemester ? (
          <>
            <Header
              semesters={semesters}
              selectedSemester={displayedSemester}
              onSelectSemester={setSelectedSemester}
            />
            <View className="px-6 pt-1">
              <CourseList semester={displayedSemester} />
            </View>
          </>
        ) : (
          <View className="px-5 py-6">
            <Text>Keine Semester gefunden</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
