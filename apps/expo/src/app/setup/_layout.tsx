import { useEffect } from "react";
import {
  LayoutAnimation,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, Slot, Stack, usePathname } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { and, eq, sql } from "drizzle-orm";
import { pk } from "@stu/student/schema";

import type {
  Course,
  SchoolId,
  SemesterType,
  StateCode,
  SubjectId,
  WithTeachers,
} from "@stu/lib";
import * as t from "@stu/student/schema";

import type { SetupForm } from "~/features/setup/form";
import { shadow } from "~/components/styles/shadow";
import { Text } from "~/components/text";
import { db } from "~/db/client";
import { currentStudent } from "~/db/queries/user";
import { getMyCoursesForSemester } from "~/features/profile/queries/get-my-courses";
import { FormContext } from "~/features/setup/form";
import { api } from "~/utils/api";
import { useLicenseKey } from "~/utils/auth";
import { ingest } from "~/utils/events/ingest";
import { setStorage } from "~/utils/storage";
import logoImage from "../../../assets/icon.png";

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
    .insert(t.schools)
    .values({
      id: school.id,
      name: school.name,
      stateCode: school.stateCode,
    })
    .onConflictDoUpdate({
      target: pk(t.schools),
      set: {
        name: school.name,
        stateCode: school.stateCode,
      },
    });
  await db
    .insert(t.years)
    .values({
      name: year.name,
      graduationYear: year.graduationYear,
      startYear: year.startYear,
      school: school.id,
    })
    .onConflictDoUpdate({
      target: pk(t.years),
      set: {
        name: year.name,
        graduationYear: year.graduationYear,
      },
    });
  await db
    .insert(t.classes)
    .values({
      identifierInYear: classIdentifier,
      startYear: year.startYear,
      school: school.id,
    })
    .onConflictDoNothing();
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
        longName: course.longName,
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
        longName: sql.raw(`excluded.${t.courses.longName.name}`),
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

const DEFAULT_LICENSE_KEY = __DEV__ ? "KJ27-MP16-LS14-JM22" : "";

const useSetupForm = () => {
  const licenseKey = useLicenseKey();

  const utils = api.useUtils();

  const activateLicenseKey = api.auth.activateLicenseKey.useMutation();

  const semester = api.schools.semesters.getCurrent.useQuery();

  const currentUser = useQuery(currentStudent());
  const courses = useQuery(getMyCoursesForSemester(semester.data));

  return useForm({
    defaultValues: {
      licenseKey: licenseKey ?? DEFAULT_LICENSE_KEY,
      name: currentUser.data
        ? `${currentUser.data.person.firstName} ${currentUser.data.person.lastName}`
        : "Hauke",
      isOfAge: currentUser.data?.isOfAge ?? false,
      year: currentUser.data?.year,
      class: currentUser.data?.class,
      chosenCourses:
        courses.data?.reduce(
          (acc, course) => {
            acc[course.subject] = course;
            return acc;
          },
          {} as Partial<Record<SubjectId, Course & WithTeachers>>,
        ) ?? {},
    } satisfies SetupForm as SetupForm,
    onSubmit: async ({ value, formApi }) => {
      console.log("onSubmit");
      if (!semester.data) {
        console.error("No semesters");
        return; // TODO: show error
      }

      if (!value.class || !value.year) {
        console.error("No class or year");
        return; // TODO: show error
      }

      console.log("bootstrapping");
      const courses = Object.values(value.chosenCourses).filter(Boolean);
      await bootstrap({
        school: {
          id: value.year.school,
          name: "IGS Lilienthal",
          stateCode: "NI",
        },
        year: value.year,
        classIdentifier: value.class.identifierInYear,
        semester: semester.data,
        courses,
      });
      console.log("bootstrapped");

      const { session, error } = await activateLicenseKey.mutateAsync({
        licenseKey: value.licenseKey,
      });
      if (error) {
        console.error(error);
        formApi.setFieldMeta(error.field, (prev) => ({
          ...prev,
          errors: prev.errors.concat(error.message),
        }));

        return;
      }
      await ingest(
        "auth.licenseActivated",
        session.userId,
        {
          licenseKey: value.licenseKey,
          userId: session.userId,
        },
        true,
      );

      await setStorage("auth.licenseKey", value.licenseKey);
      await setStorage("auth.session", {
        token: session.token,
        user: session.userId,
      });

      await ingest("student.joined", session.userId, {
        class: {
          identifier: value.class.identifierInYear,
          startYear: value.class.startYear,
        },
        isOfAge: value.isOfAge,
        name: value.name,
        school: "igs-lil",
        studentId: session.userId,
      });

      await Promise.all(
        courses.map((course) =>
          ingest("student.courseAssigned", session.userId, {
            courseId: course.id,
            studentId: session.userId,
          }),
        ),
      );

      await utils.invalidate();

      router.replace("/");
    },
  });
};

export default function SetupLayout() {
  const { height } = useAnimatedKeyboard();
  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: height.value,
  }));

  const form = useSetupForm();

  const pathname = usePathname();
  useEffect(() => {
    LayoutAnimation.easeInEaseOut();
  }, [pathname]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Backdrop />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <SafeAreaView
          style={{
            flex: 1,
          }}
        >
          <Animated.View
            style={[
              {
                justifyContent: "center",
                alignItems: "center",
                gap: 16 * 2,
                paddingHorizontal: 32,
                height: "100%",
                flex: 1,
              },
              animatedStyle,
            ]}
          >
            <Logo />
            <View
              className="w-full rounded-3xl bg-white px-6 py-8"
              style={shadow}
            >
              <FormContext.Provider value={form}>
                <Slot />
              </FormContext.Provider>
            </View>

            <LegalText />
          </Animated.View>
        </SafeAreaView>
      </ScrollView>
    </>
  );
}

const LegalText = () => {
  return (
    <View className="gap-4 self-center">
      <TouchableOpacity
        onPress={() => openBrowserAsync("https://studienbuch.app/impressum")}
      >
        <Text className="text-md text-center text-[#6A6A6A]">Impressum</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => openBrowserAsync("https://studienbuch.app/datenschutz")}
      >
        <Text className="text-md text-center text-[#6A6A6A]">Datenschutz</Text>
      </TouchableOpacity>
    </View>
  );
};

const Logo = () => {
  return (
    <View
      className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-[#6EB867]"
      style={shadow}
    >
      <Image
        source={logoImage}
        style={{ width: 120, height: 120, borderRadius: 50 }}
      />
    </View>
  );
};

const Backdrop = () => {
  return (
    <>
      <View className="absolute -left-36 top-36 h-72 w-72 rounded-full bg-[#9DBFEC]" />
      <View className="absolute -right-28 top-96 h-56 w-56 rounded-full bg-[#92C78E]" />
      <View className="absolute -left-24 top-[600px] h-48 w-48 rounded-full bg-[#CA9093]" />
    </>
  );
};
