import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Button } from "~/components/button";
import { SelectCourse } from "~/components/select-course";
import { Text } from "~/components/text";
import { findCurrentSemester, type Course, type SubjectId } from "@stu/core";
import { useMockApp } from "~/mock-app/provider";

export function ClassAndCoursesScreen() {
  const { courses, semesters, getSemesterCourses, setSelectedCourses } = useMockApp();
  const currentSemester = findCurrentSemester(semesters)!;
  const currentCourses = getSemesterCourses(currentSemester.id);
  const [selection, setSelection] = useState<Record<SubjectId, Course | undefined>>(
    currentCourses.reduce(
      (acc, course) => ({ ...acc, [course.subject]: course }),
      {} as Record<SubjectId, Course | undefined>,
    ),
  );

  const groupedChoices = useMemo(() => {
    const result = new Map<SubjectId, Course[]>();
    for (const course of courses.filter((item) => item.semesterId === currentSemester.id)) {
      result.set(course.subject, [...(result.get(course.subject) ?? []), course]);
    }
    return Array.from(result.entries());
  }, [courses, currentSemester.id]);

  return (
    <View>
      <Text variant="heading" className="text-center">
        Kurse
      </Text>
      <Text>
        Bitte wähle deine Kurse aus. Du kannst diese später jederzeit ändern. Tippe auf die Fächer,
        um deine Kurse auszuwählen.
      </Text>

      <View className="h-6" />

      <View className="flex-row flex-wrap">
        {groupedChoices.map(([subject, options], idx) => (
          <View
            key={subject}
            style={{
              width: "50%",
              paddingLeft: idx % 2 === 1 ? 6 : 0,
              paddingRight: idx % 2 === 0 ? 6 : 0,
              paddingTop: idx >= 2 ? 12 : 0,
            }}
          >
            <SelectCourse
              subject={subject}
              options={options}
              value={selection[subject]}
              getOptionLabel={(item) =>
                `${item.name.toLowerCase()} (${item.teachers.map((teacher) => `${teacher.firstName[0]}. ${teacher.lastName}`).join(", ")})`
              }
              onChange={(value) => setSelection((current) => ({ ...current, [subject]: value }))}
            />
          </View>
        ))}
      </View>

      <View className="h-6" />

      <Button
        label="Fertig"
        className="self-end"
        onPress={() => {
          setSelectedCourses(
            currentSemester.id,
            Object.values(selection)
              .filter((value): value is Course => Boolean(value))
              .map((value) => value.id),
          );
          router.replace("/(main)/profile");
        }}
      />
    </View>
  );
}
