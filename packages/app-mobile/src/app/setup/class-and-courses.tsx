import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";

import type {
  Course as BaseCourse,
  SchoolId,
  SemesterType,
  StateCode,
  SubjectId,
  WithTeachers,
} from "@stu/lib";
import { BetterMap, formalNameShort } from "@stu/lib";

import * as t from "@stu/student/schema";
import { pk } from "@stu/student/schema";
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { Button } from "~/components/button";
import { SelectCourse } from "~/components/select-course";
import { TempError } from "~/components/temp-error";
import { Text } from "~/components/text";
import { db } from "~/db/client";
import { currentStudent } from "~/db/queries/user";
import { getMyCoursesForSemester } from "~/features/profile/queries/get-my-courses";
import { api } from "~/utils/api";
import { ingest } from "~/utils/events/ingest";
import { useAppForm } from "~/utils/form";
import { router } from "expo-router";

const bootstrap = async ({
  school,
  year,
  classIdentifier,
  semester,
  courses,
}: {
  school: { id: SchoolId; name: string; stateCode: StateCode };
  year: { name: string; graduationYear: number; startYear: number };
  classIdentifier: string;
  semester: {
    name: string;
    type: SemesterType;
    year: number;
    start: Date;
    end: Date;
  };
  courses: (Course & WithTeachers)[];
}) => {
  await db
    .insert(t.semesters)
    .values({
      name: semester.name,
      year: semester.year,
      type: semester.type,
      start: semester.start,
      end: semester.end,
      school: school.id,
    })
    .onConflictDoUpdate({
      target: pk(t.semesters),
      set: {
        name: semester.name,
        start: semester.start,
        end: semester.end,
      },
    });

  await db
    .delete(t.yearSemesters)
    .where(
      and(
        eq(t.yearSemesters.school, school.id),
        eq(t.yearSemesters.startYear, year.startYear),
      ),
    )
    .execute();
  await db
    .insert(t.yearSemesters)
    .values({
      school: school.id,
      startYear: year.startYear,
      semesterYear: semester.year,
      semesterType: semester.type,
    })
    .execute();

  await db
    .insert(t.courses)
    .values(
      courses.map((course) => ({
        id: course.id,
        name: course.name,
        subject: course.subject,
        isMandatory: course.isMandatory,
        school: school.id,
        semesterType: semester.type,
        semesterYear: semester.year,
      })),
    )
    .onConflictDoUpdate({
      target: pk(t.courses),
      set: {
        name: sql.raw(`excluded.${t.courses.name.name}`),
        subject: sql.raw(`excluded.${t.courses.subject.name}`),
        isMandatory: sql.raw(`excluded.${t.courses.isMandatory.name}`),
        semesterType: sql.raw(`excluded.${t.courses.semesterType.name}`),
        semesterYear: sql.raw(`excluded.${t.courses.semesterYear.name}`),
        school: sql.raw(`excluded.${t.courses.school.name}`),
        isMember: sql.raw(`excluded.${t.courses.isMember.name}`),
      },
    });

  for (const course of courses) {
    await db
      .insert(t.coursesToClasses)
      .values({
        course: course.id,
        school: school.id,
        classIdentifier: classIdentifier,
        classStartYear: year.startYear,
      })
      .onConflictDoNothing();

    for (const teacher of course.teachers) {
      await db
        .insert(t.persons)
        .values({
          id: teacher.id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          abbrv: teacher.abbrv,
          salutation: teacher.salutation,
        })
        .onConflictDoUpdate({
          target: pk(t.persons),
          set: {
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            abbrv: teacher.abbrv,
            salutation: teacher.salutation,
          },
        });

      await db
        .insert(t.coursesToTeachers)
        .values({
          course: course.id,
          teacher: teacher.id,
        })
        .onConflictDoNothing();
    }
  }
};

type Course = BaseCourse & WithTeachers;

export default function ClassAndCourses() {
  const studentQuery = useQuery(currentStudent());
  const semester = api.schools.semesters.getCurrent.useQuery();
  const currentCourses = useQuery(getMyCoursesForSemester(semester.data));
  const queryClient = useQueryClient();
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

      await bootstrap({
        school: {
          id: student.year.school,
          name: "IGS Lilienthal",
          stateCode: "NI",
        },
        year: student.year,
        classIdentifier: student.class.identifierInYear,
        semester: semester.data,
        courses,
      });
      console.log("bootstrapped");
      await Promise.all(
        courses.map((course) =>
          ingest("student.courseAssigned", student.person.id, {
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
      return courses.data.courses.reduce<BetterMap<SubjectId, Course[]>>(
        (acc, course) => {
          acc.getWithDefault(course.subject, []).push(course);
          return acc;
        },
        new BetterMap(),
      );
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
        Bitte wähle deine Kurse aus. Du kannst diese später jederzeit ändern.
        Tippe auf die Fächer, um deine Kurse auszuwählen.
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
                  options={courses
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))}
                  subject={subject}
                  getOptionLabel={(item) =>
                    item
                      ? `${item.name.toLowerCase()} (${item.teachers.map(formalNameShort).join(", ")})`
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

      <Button
        label="Fertig"
        className="self-end"
        onPress={() => form.handleSubmit()}
      />
    </View>
  );
}
