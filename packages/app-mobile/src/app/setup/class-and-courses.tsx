import type { Course as BaseCourse, SubjectId, WithTeachers } from "@stu/lib";
import { BetterMap, Teacher } from "@stu/lib";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { Button } from "~/components/button";
import { SelectCourse } from "~/components/select-course";
import { TempError } from "~/components/temp-error";
import { Text } from "~/components/text";
import { currentStudent } from "~/db/queries/user";
import { getMyCoursesForSemester } from "~/features/profile/queries/get-my-courses";
import { api } from "~/utils/api";
import { useIngest, useRuntime } from "~/utils/events/ingest";
import { useAppForm } from "~/utils/form";
import { hydrateSnapshotFromDefaultApi } from "~/utils/snapshot-recovery";

type Course = BaseCourse & WithTeachers;

export default function ClassAndCourses() {
  const studentQuery = useQuery(currentStudent());
  const semester = api.schools.semesters.getCurrent.useQuery();
  const currentCourses = useQuery(getMyCoursesForSemester(semester.data));
  const runtime = useRuntime();
  const queryClient = useQueryClient();
  const courseAssigned = useIngest("student.courseAssigned");
  const form = useAppForm({
    defaultValues: {
      chosenCourses:
        currentCourses.data?.reduce(
          (acc, course) => {
            acc[course.subject] = course;
            return acc;
          },
          {} as Partial<Record<SubjectId, Course & WithTeachers>>,
        ) ?? {},
    },
    onSubmit: async ({ value }) => {
      if (!semester.data) {
        console.error("No semesters");
        return; // TODO: show error
      }
      const student = studentQuery.data;
      if (!student) {
        console.error("No class");
        return; // TODO: show error
      }
      const courses = Object.values(value.chosenCourses).filter(Boolean);

      await runtime.runPromise(
        hydrateSnapshotFromDefaultApi({
          request: {
            entities: [
              { kind: "student", id: student.person.id },
              ...courses.map((course) => ({
                kind: "course" as const,
                id: course.id,
              })),
            ],
          },
        }),
      );
      await Promise.all(
        courses.map((course) =>
          courseAssigned.mutateAsync({
            courseId: course.id,
            studentId: student.person.id,
          }),
        ),
      );
      await queryClient.invalidateQueries();
      router.push("/");
    },
  });

  const courses = api.schools.courses.listChoices.useQuery(
    studentQuery.data
      ? {
          class: {
            school: "igs-lil",
            startYear: studentQuery.data.year.startYear,
            identifierInYear: studentQuery.data.class.identifierInYear,
          },
        }
      : skipToken,
  );

  const courseChoices = useMemo(() => {
    if (courses.data) {
      return courses.data.courses.reduce<BetterMap<SubjectId, Course[]>>((acc, course) => {
        acc.getWithDefault(course.subject, []).push(course);
        return acc;
      }, new BetterMap());
    }
    return new BetterMap<SubjectId, Course[]>();
  }, [courses.data]);

  if (courses.isError) {
    return <TempError error={courses.error.message} />;
  }

  if (courses.isPending) {
    return <ActivityIndicator />;
  }

  return (
    <View>
      <Text variant="heading" className="text-center">
        Kurse
      </Text>
      <Text>
        Bitte wähle deine Kurse aus. Du kannst diese später jederzeit ändern. Tippe auf die Fächer, um deine Kurse
        auszuwählen.
      </Text>

      <View className="h-6" />

      <View className="flex flex-row flex-wrap">
        {Array.from(courseChoices.entries()).map(([subject, courses], idx) => (
          <View
            key={subject}
            style={{
              width: "50%",
              paddingLeft: idx % 2 === 1 ? 6 : 0,
              paddingRight: idx % 2 === 0 ? 6 : 0,
              paddingTop: idx >= 2 ? 12 : 0,
            }}
          >
            <form.Field
              name={`chosenCourses.${subject}`}
              children={(field) => (
                <SelectCourse
                  options={courses.slice().sort((a, b) => a.name.localeCompare(b.name))}
                  subject={subject}
                  getOptionLabel={(item) =>
                    item
                      ? `${item.name.toLowerCase()} (${item.teachers.map(Teacher.formalNameShort).join(", ")})`
                      : "nicht belegt"
                  }
                  onChange={(val) => field.setValue(val)}
                  value={field.state.value}
                />
              )}
            />
          </View>
        ))}
      </View>

      <View className="h-6" />

      <Button label="Fertig" className="self-end" onPress={() => form.handleSubmit()} />
    </View>
  );
}
