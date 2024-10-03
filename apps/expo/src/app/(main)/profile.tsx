import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Tabs, useRouter } from "expo-router";
import Icon from "@expo/vector-icons/MaterialIcons";

import type { NonEmptyArray, Semester } from "@stu/lib";
import { getCurrentYearNum, isArrayNonEmpty } from "@stu/lib";

import { TextButton } from "~/components/button";
import { Card } from "~/components/card";
import { SubjectIcon } from "~/components/subject-icon";
import { Table } from "~/components/table";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

const Avatar = () => {
  return (
    <View className="h-28 w-28 items-center justify-center rounded-full bg-accent">
      <Icon name="person" size={48} color="white" />
    </View>
  );
};

const Header = () => {
  const { user } = useRequiredAuthenticatedSession();
  const year = api.students.years.getOwn.useQuery();

  if (!year.data) {
    return null;
  }

  return (
    <View className="rounded-b-3xl bg-primary">
      <SafeAreaView edges={["top"]}>
        <View className="flex-col items-center py-10">
          <Avatar />
          <View className="h-6" />
          <Text weight="bold" className="text-3xl text-white">
            {user.name}s Profil
          </Text>
          <View className="h-2" />
          <View className="items-center">
            <Text className="text-xl text-white">
              Jahrgang {year.data.name} ({getCurrentYearNum(year.data)}. Klasse)
            </Text>
            <Text className="text-xl text-white">{year.data.school.name}</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

interface SemesterSelectorProps {
  choices: Semester[];
  onSelect: (semester: Semester) => void;
}

const SemesterSelector = ({ choices, onSelect }: SemesterSelectorProps) => {
  return choices.map((semester) => {
    return (
      <View key={semester.name}>
        <TextButton label={semester.name} onPress={() => onSelect(semester)} />
      </View>
    );
  });
};

const CourseList = ({ semester }: { semester: Semester }) => {
  const courses = api.students.courses.getForSemester.useQuery({ semester });
  const router = useRouter();

  if (!courses.data) {
    return null;
  }

  return (
    <Table
      items={courses.data}
      getKey={(course) => course.id}
      gap={24}
      render={(course) => (
        <Card
          onPress={() =>
            router.push({
              pathname: "/courses/[course]",
              params: {
                course: course.id,
              },
            })
          }
        >
          <View className="items-center">
            <SubjectIcon subject={course.subject} />
            <View className="h-2" />
            <Text weight="bold">{course.longName}</Text>
          </View>
        </Card>
      )}
    />
  );
};

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

export default function ProfilePage() {
  const semesters = api.students.semesters.getOwn.useQuery();

  if (!semesters.data) {
    return null;
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
}
