import { useEffect, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { Link } from "expo-router";

import type { Course } from "@schnau/lib";
import { formatClassName, isArraySingleElement } from "@schnau/lib";

import { Button } from "~/components/button";
import { DropdownSelect } from "~/components/dropdown-select";
import { SelectField } from "~/components/select-field";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { useFormContext } from "./form";

export default function ClassAndCourses() {
  const form = useFormContext(2);

  const selectedYear = form.useField({
    name: "year",
  });

  const classes = api.classes.list.useQuery({
    yearId: selectedYear.state.value.id,
  });
  const courses = api.courses.list.useQuery({
    yearId: selectedYear.state.value.id,
  });

  useEffect(() => {
    if (classes.data && isArraySingleElement(classes.data)) {
      form.setFieldValue("class", classes.data[0]);
    }
  }, [classes.data, form]);

  const courseChoices = useMemo(() => {
    if (courses.data) {
      return courses.data
        .filter((course) => course.isChoosable)
        .reduce<Record<string, Course[]>>((acc, course) => {
          acc[course.name] ??= [];
          // @ts-expect-error - we know it's defined above
          acc[course.name].push(course);
          return acc;
        }, {});
    }
    return {};
  }, [courses.data]);

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
        <form.Field
          name="class"
          children={(field) => (
            <SelectField
              options={classes.data}
              label="Klasse"
              getKey={(item) => item.id}
              getOptionLabel={(item) =>
                formatClassName(item, selectedYear.state.value)
              }
              onChange={field.setValue}
              value={field.state.value}
            />
          )}
        />
      )}
      <View className="h-6" />

      <View className="flex flex-row flex-wrap">
        {Object.entries(courseChoices).map(([name, courses], idx) => (
          <View
            key={idx}
            style={{
              width: "50%",
              paddingLeft: idx % 2 === 1 ? 4 : 0,
              paddingRight: idx % 2 === 0 ? 4 : 0,
              paddingTop: idx >= 2 ? 12 : 0,
            }}
          >
            <form.Field
              name={`chosenCourses.${name}`}
              key={name}
              children={(field) => (
                <DropdownSelect
                  options={courses}
                  label={name}
                  getKey={(item) => item?.id.toString() ?? ""}
                  getOptionLabel={(item) => item.courseId}
                  onChange={field.setValue}
                  value={field.state.value}
                />
              )}
            />
          </View>
        ))}
      </View>

      <View className="h-6" />

      <Link href="/setup/name-and-year" asChild>
        <Button label="Fertig" className="self-end" />
      </Link>
    </View>
  );
}
