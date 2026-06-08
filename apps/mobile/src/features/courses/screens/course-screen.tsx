import { format } from "date-fns";
import { MenuView, type MenuComponentRef } from "@expo/ui/community/menu";
import { de } from "date-fns/locale/de";
import { Stack } from "expo-router";
import { useRef, useState } from "react";
import { ActionSheetIOS, Platform, View } from "react-native";
import Animated from "react-native-reanimated";
import { PortaledBottomSheet } from "~/components/layout/bottom-sheet";
import { Card } from "~/components/ui/card";
import { CoreLayout } from "~/components/layout/core-layout";
import { IconButton } from "~/components/ui/icon-button";
import { SubjectIcon } from "~/domain-ui/subject-icon";
import { Text } from "~/components/ui/text";
import { useTransparentHeaderTopPadding } from "~/components/use-transparent-header-top-padding";
import { subjectNameMap, Teacher } from "@stu/core";
import { useCourses, useSchool } from "~/data/hooks";
import { AddTaskSheet, TasksSection } from "~/features/tasks";
import { GradesOverviewCard } from "~/features/courses/grades";
import { haptics } from "~/platform/haptics";
import { AddWrittenGrade } from "../grades/written/add-written-grade";

export const CourseScreen = ({ courseId }: { courseId: string }) => {
  const { getCourse } = useCourses();
  const { semesters } = useSchool();
  const [isAddTaskVisible, setIsAddTaskVisible] = useState(false);
  const [isAddWrittenGradeVisible, setIsAddWrittenGradeVisible] = useState(false);
  const courseMenuRef = useRef<MenuComponentRef>(null);
  const heroStyle = useTransparentHeaderTopPadding();
  const course = getCourse(courseId);

  if (!course) {
    return null;
  }

  const semester = semesters.find((item) => item.id === course.semesterId)!;
  const showCourseActions = () => {
    haptics.selection();

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: 2,
          options: ["Hausaufgabe hinzufügen", "Klausurnote eintragen", "Abbrechen"],
          title: "Kursaktionen",
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            setIsAddTaskVisible(true);
          } else if (buttonIndex === 1) {
            setIsAddWrittenGradeVisible(true);
          }
        },
      );
      return;
    }

    courseMenuRef.current?.show();
  };

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
      <Animated.View className="px-8" style={heroStyle}>
        <View className="flex-row justify-between gap-4 pb-4">
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

          <View className="items-end gap-3">
            {Platform.OS === "android" ? (
              <MenuView
                ref={courseMenuRef}
                actions={[
                  { id: "add-task", title: "Hausaufgabe hinzufügen" },
                  { id: "add-written-grade", title: "Klausurnote eintragen" },
                ]}
                onPressAction={(event) => {
                  if (event.nativeEvent.event === "add-task") {
                    setIsAddTaskVisible(true);
                  } else if (event.nativeEvent.event === "add-written-grade") {
                    setIsAddWrittenGradeVisible(true);
                  }
                }}
              >
                <IconButton
                  accessibilityLabel="Kursaktionen"
                  icon="more"
                  variant="filled"
                  elevated
                  color="white"
                  onPress={showCourseActions}
                />
              </MenuView>
            ) : (
              <IconButton
                accessibilityLabel="Kursaktionen"
                icon="more"
                variant="filled"
                elevated
                color="white"
                onPress={showCourseActions}
              />
            )}
            <Card
              padding="none"
              radius="md"
              className="aspect-square h-28 items-center justify-center"
            >
              <SubjectIcon subject={course.subject} size={52} />
            </Card>
          </View>
        </View>
      </Animated.View>
      <View className="px-4">
        <GradesOverviewCard courseId={course.id} />
      </View>
      <View className="h-8" />
      <TasksSection courseId={course.id} />
    </CoreLayout>
  );
};
