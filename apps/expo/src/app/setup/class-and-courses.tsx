import { useEffect, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { Link } from "expo-router";

import type { Course, SubjectId } from "@stu/lib";
import {
  BetterMap,
  formalNameShort,
  formatClassName,
  isArraySingleElement,
} from "@stu/lib";

import { Button } from "~/components/button";
import { SelectCourse } from "~/components/select-course";
import { SelectField } from "~/components/select-field";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { useFormContext } from "./form";

export default function ClassAndCourses() {
  const { form, handleSubmitStep } = useFormContext({
    step: 2,
    onSubmitStep: () => form.handleSubmit(),
  });

  const selectedYear = form.useField({
    name: "year",
  });

  const selectedClass = form.useField({
    name: "class",
  });

  const classes = api.classes.list.useQuery({
    school: "igs-lil",
    startYear: selectedYear.state.value.startYear,
  });

  const courses = api.courses.listChoices.useQuery({
    school: "igs-lil",
    startYear: selectedYear.state.value.startYear,
  });

  useEffect(() => {
    if (classes.data && isArraySingleElement(classes.data)) {
      form.setFieldValue("class", classes.data[0]);
    }
  }, [classes.data, form]);

  const courseChoices = useMemo(() => {
    const classVal = selectedClass.state.value;
    if (courses.data && classVal) {
      return courses.data
        .filter((course) =>
          course.classes.some(
            (cls) => cls.identifierInYear === classVal.identifierInYear,
          ),
        )
        .reduce<BetterMap<SubjectId, Course[]>>((acc, course) => {
          acc.getWithDefault(course.subject, []).push(course);
          return acc;
        }, new BetterMap());
    }
    return new BetterMap<SubjectId, Course[]>();
  }, [courses.data, selectedClass.state.value]);

  if (classes.isPending || courses.isPending) {
    return <ActivityIndicator />;
  }

  if (classes.isError || courses.isError) {
    return <Text>Fehler</Text>;
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
                getOptionLabel={(item) =>
                  formatClassName(item, selectedYear.state.value)
                }
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
              paddingLeft: idx % 2 === 1 ? 12 : 0,
              paddingRight: idx % 2 === 0 ? 12 : 0,
              paddingTop: idx >= 2 ? 12 : 0,
            }}
          >
            <form.Field
              name={`chosenCourses.${subject}`}
              children={(field) => (
                <SelectCourse
                  options={courses}
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
