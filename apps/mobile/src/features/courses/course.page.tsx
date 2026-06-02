import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import { Stack } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { Card } from "~/components/card";
import { CoreLayout } from "~/components/core-layout";
import { SubjectIcon } from "~/components/subject-icon";
import { Text } from "~/components/text";
import { useTransparentHeaderTopPadding } from "~/components/use-transparent-header-top-padding";
import { subjectNameMap, Teacher } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { Tasks } from "~/features/tasks/tasks";
import { AddTaskSheet } from "~/features/tasks/add-task-sheet";
import { GradesOverviewCard } from "./grades/grades-overview-card";
import { AddWrittenGrade } from "./grades/written/add-written-grade";

export const CoursePage = ({ courseId }: { courseId: string }) => {
  const { getCourse, semesters } = useMockApp();
  const [isAddTaskVisible, setIsAddTaskVisible] = useState(false);
  const [isAddWrittenGradeVisible, setIsAddWrittenGradeVisible] = useState(false);
  const heroStyle = useTransparentHeaderTopPadding();
  const course = getCourse(courseId);

  if (!course) {
    return null;
  }

  const semester = semesters.find((item) => item.id === course.semesterId)!;

  return (
    <CoreLayout>
      {isAddTaskVisible ? (
        <PortaledBottomSheet onClose={() => setIsAddTaskVisible(false)}>
          <AddTaskSheet courseId={course.id} onClose={() => setIsAddTaskVisible(false)} />
        </PortaledBottomSheet>
      ) : null}
      {isAddWrittenGradeVisible ? (
        <PortaledBottomSheet onClose={() => setIsAddWrittenGradeVisible(false)}>
          <AddWrittenGrade
            courseId={course.id}
            onClose={() => setIsAddWrittenGradeVisible(false)}
          />
        </PortaledBottomSheet>
      ) : null}

      <Stack.Screen
        options={{
          headerTitle: "",
          headerTransparent: true,
          headerStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu accessibilityLabel="Kursaktionen">
          <Stack.Toolbar.Label>Aktionen</Stack.Toolbar.Label>
          <Stack.Toolbar.MenuAction onPress={() => setIsAddTaskVisible(true)}>
            Hausaufgabe hinzufügen
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction onPress={() => setIsAddWrittenGradeVisible(true)}>
            Klausurnote eintragen
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <Animated.View className="px-8" style={heroStyle}>
        <View className="flex-row justify-between pb-4">
          <View className="flex-1 pr-4">
            <Text weight="bold" className="text-4xl text-white">
              {subjectNameMap[course.subject]}
            </Text>
            <Text className="text-2xl text-white">
              {course.teachers.map((teacher) => Teacher.formalName(teacher)).join(", ")}
            </Text>
            <View className="h-2" />
            <Text italic className="text-lg text-white">
              {semester.name}
            </Text>
            <Text italic className="text-lg text-white">
              {format(semester.start, "MMMM yyyy", { locale: de })} -{" "}
              {format(semester.end, "MMMM yyyy", { locale: de })}
            </Text>
          </View>

          <Card
            padding="none"
            radius="md"
            className="aspect-square h-28 items-center justify-center"
          >
            <SubjectIcon subject={course.subject} size={52} />
          </Card>
        </View>
      </Animated.View>
      <View className="px-4">
        <GradesOverviewCard courseId={course.id} />
      </View>
      <View className="h-8" />
      <Tasks courseId={course.id} />
    </CoreLayout>
  );
};
