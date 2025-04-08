import { useEffect, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { useStore } from "@tanstack/react-form";
import { skipToken } from "@tanstack/react-query";

import type { Course as BaseCourse, SubjectId, WithTeachers } from "@stu/lib";
import {
  BetterMap,
  formalNameShort,
  formatClassName,
  isArraySingleElement,
} from "@stu/lib";

import { Button } from "~/components/button";
import { SelectCourse } from "~/components/select-course";
import { SelectField } from "~/components/select-field";
import { TempError } from "~/components/temp-error";
import { Text } from "~/components/text";
import { useFormContext } from "~/features/setup/form";
import { api } from "~/utils/api";

type Course = BaseCourse & WithTeachers;

export default function ClassAndCourses() {
  const { form, handleSubmitStep } = useFormContext({
    step: 2,
    onSubmitStep: async () => {
      await form.handleSubmit().catch((e) => {
        console.error(e);
      });
    },
  });

  const selectedYear = useStore(form.store, (state) => state.values.year);
  const selectedClass = useStore(form.store, (state) => state.values.class);

  const classes = api.schools.classes.list.useQuery({
    school: "igs-lil",
    startYear: selectedYear.startYear,
  });

  const courses = api.schools.courses.listChoices.useQuery(
    selectedClass
      ? {
          class: {
            school: "igs-lil",
            startYear: selectedYear.startYear,
            identifierInYear: selectedClass.identifierInYear,
          },
        }
      : skipToken,
  );

  useEffect(() => {
    if (classes.data && isArraySingleElement(classes.data)) {
      form.setFieldValue("class", classes.data[0]);
    }
  }, [classes.data, form]);

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

  if (classes.isError || courses.isError) {
    return (
      <TempError
        error={`${classes.error?.message} ${courses.error?.message}`}
      />
    );
  }

  if (classes.isPending || courses.isPending) {
    return <ActivityIndicator />;
  }

  const hasClasses = classes.data.length > 1;

  return (
    <View>
      <Text variant="heading" className="text-center">
        {hasClasses ? "Klassen und Kurse" : "Kurse"}
      </Text>
      <Text>
        {hasClasses
          ? "Bitte wähle deine Klasse und deine Wahlpflichtkurse aus. Du kannst diese später jederzeit ändern. Tippe auf die Fächer, um deine Kurse auszuwählen."
          : "Bitte wähle deine Kurse aus. Du kannst diese später jederzeit ändern. Tippe auf die Fächer, um deine Kurse auszuwählen."}
      </Text>

      <View className="h-6" />

      {hasClasses && (
        <>
          <form.Field
            name="class"
            children={(field) => (
              <SelectField
                options={classes.data}
                label="Klasse"
                getKey={(item) => item.identifierInYear}
                getOptionLabel={(item) => formatClassName(item, selectedYear)}
                onChange={field.setValue}
                value={field.state.value}
              />
            )}
          />
          <View className="h-6" />
        </>
      )}

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

      <Button label="Fertig" className="self-end" onPress={handleSubmitStep} />
    </View>
  );
}
