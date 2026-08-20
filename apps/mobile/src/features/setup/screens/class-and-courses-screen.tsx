import { router } from "expo-router";
import type { Href } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Button } from "~/ui/button";
import { SelectCourse } from "~/domain-ui/select-course";
import { Text } from "~/ui/text";
import { findCurrentSemester, type Course, type SubjectId } from "@/compat/mobile-v0";
import { useCourses, useSchool } from "~/infra/data/hooks";
import { mainProfileRoute } from "~/infra/routing/params";

interface ClassAndCoursesScreenProps {
  doneRoute?: Href;
  heading?: string;
  intro?: string;
}

export function ClassAndCoursesScreen({
  doneRoute = mainProfileRoute,
  heading = "Kurse",
  intro = "Bitte wähle deine Kurse aus. Du kannst diese später jederzeit ändern. Tippe auf die Fächer, um deine Kurse auszuwählen.",
}: ClassAndCoursesScreenProps) {
  const { courses, getSemesterCourses, setSelectedCourses } = useCourses();
  const { semesters } = useSchool();
  const currentSemester = findCurrentSemester(semesters);
  const currentCourses = currentSemester ? getSemesterCourses(currentSemester.id) : [];
  const [selection, setSelection] = useState<Partial<Record<SubjectId, Course>>>(() => {
    const initialSelection: Partial<Record<SubjectId, Course>> = {};
    for (const course of currentCourses) {
      initialSelection[course.subject] = course;
    }
    return initialSelection;
  });

  const groupedChoices = useMemo(() => {
    if (!currentSemester) return [];

    const result = new Map<SubjectId, Course[]>();
    for (const course of courses.filter((item) => item.semesterId === currentSemester.id)) {
      result.set(course.subject, [...(result.get(course.subject) ?? []), course]);
    }
    return Array.from(result.entries());
  }, [courses, currentSemester]);

  if (!currentSemester) return null;

  return (
    <View>
      <Text variant="heading" className="text-center">
        {heading}
      </Text>
      <Text>{intro}</Text>

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
          router.replace(doneRoute);
        }}
      />
    </View>
  );
}
