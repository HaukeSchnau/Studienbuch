import React, { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Tabs } from "expo-router";

import type { NonEmptyArray, Semester } from "@stu/lib";
import { isArrayNonEmpty } from "@stu/lib";

import { TempError } from "~/components/temp-error";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { CourseList } from "./course-list";
import { Header } from "./profile-header";
import { SemesterSelector } from "./semester-selector";

const Content = ({ semesters }: { semesters: NonEmptyArray<Semester> }) => {
  const [selectedSemester, setSelectedSemester] = useState<Semester>(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    semesters.at(-2)!,
  );

  return (
    <View className="px-6 py-4">
      <SemesterSelector choices={semesters} onSelect={setSelectedSemester} />
      <View className="h-4" />
      <CourseList semester={selectedSemester} />
    </View>
  );
};

export const ProfilePage = () => {
  const semesters = api.students.semesters.getOwn.useQuery();

  if (semesters.isPending) {
    return <ActivityIndicator />;
  }

  if (semesters.isError) {
    return <TempError error={semesters.error.message} />;
  }

  return (
    <ScrollView>
      <View className="padding-8">
        <Tabs.Screen
          options={{
            header: () => <Header />,
          }}
        />

        {isArrayNonEmpty(semesters.data) ? (
          <Content semesters={semesters.data} />
        ) : (
          <Text>Keine Semester gefunden</Text>
        )}
      </View>
    </ScrollView>
  );
};
