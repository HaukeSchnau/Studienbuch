import type { FormApi, ReactFormApi } from "@tanstack/react-form";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useForm } from "@tanstack/react-form";
import { getISOWeek, getISOWeekYear, isSameDay, startOfDay } from "date-fns";

import { subjectNameMap } from "@stu/lib";

import { Button } from "~/components/button";
import { CheckboxRow } from "~/components/checkbox-row";
import { DateField } from "~/components/date-field";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { api } from "~/utils/api";

interface AbsenceForm {
  date: Date;
  courses: string[];
  reason: string;
}

interface Props {
  onClose: () => void;
}

export const AddAbsence = ({ onClose }: Props) => {
  const utils = api.useUtils();
  const mutation = api.students.absences.add.useMutation({
    onSettled: () => {
      void utils.students.absences.listUnexcused.invalidate();
      onClose();
    },
  });

  const form = useForm<AbsenceForm>({
    defaultValues: {
      date: startOfDay(new Date()),
      courses: [],
      reason: "",
    },
    onSubmit: ({ value }) => {
      mutation.mutate({
        date: value.date,
        courseIds: value.courses,
        reason: value.reason,
      });
    },
  });

  return (
    <View className="px-4 py-2">
      <Text variant="heading" className="text-center">
        Fehlzeit eintragen
      </Text>

      <View className="h-4" />

      <form.Field name="date">
        {(field) => (
          <DateField
            onChange={(date) => field.setValue(date)}
            value={field.state.value}
            label="Datum"
          />
        )}
      </form.Field>

      <View
        style={{
          height: 1,
          backgroundColor: "#E6E6E6",
        }}
      />

      <View className="h-4" />

      <CoursesSelect form={form} />

      <View className="h-4" />

      <View
        style={{
          height: 1,
          backgroundColor: "#E6E6E6",
        }}
      />

      <View className="h-4" />

      <form.Field name="reason">
        {(field) => (
          <TextField
            label="Begrundung"
            onChangeText={field.setValue}
            value={field.state.value}
          />
        )}
      </form.Field>

      <View className="h-6" />

      <form.Subscribe selector={(form) => form.isSubmitting}>
        {(isSubmitting) => (
          <Button
            className="self-end"
            label="Eintragen"
            onPress={form.handleSubmit}
            disabled={isSubmitting}
          />
        )}
      </form.Subscribe>
    </View>
  );
};

const CoursesSelect = ({
  form,
}: {
  form: FormApi<AbsenceForm, undefined> & ReactFormApi<AbsenceForm, undefined>;
}) => {
  const selectedDate = form.useField({
    name: "date",
  });

  useEffect(() => {
    void form.setFieldValue("courses", [], {
      dontUpdateMeta: true,
    });
  }, [selectedDate.state.value, form]);

  const courseOptions = api.students.timetable.getWeek.useQuery({
    isoWeekYear: getISOWeekYear(selectedDate.state.value),
    isoWeek: getISOWeek(selectedDate.state.value),
  });

  if (courseOptions.isPending) {
    return <ActivityIndicator />;
  }

  if (courseOptions.isError) {
    return <Text>Error: {courseOptions.error.message}</Text>;
  }

  const courseOptionsForDay = courseOptions.data
    .filter((entry) => isSameDay(entry.start, selectedDate.state.value))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (courseOptionsForDay.length === 0) {
    return <Text className="px-8">An diesem Tag hast du keine Kurse.</Text>;
  }

  return (
    <form.Field name="courses" mode="array">
      {(field) => (
        <View className="gap-4 px-4">
          <Text className="px-4 text-xl" weight="medium">
            Fächer, in denen du gefehlt hast:
          </Text>
          {courseOptionsForDay.map((entry) => (
            <CheckboxRow
              textStyle={{ fontSize: 16, color: "#000000dd" }}
              key={`${entry.course.id}-${entry.start.toISOString()}`}
              label={subjectNameMap[entry.course.subject]}
              value={field.state.value.includes(entry.course.id)}
              onChange={(checked) => {
                if (checked) {
                  field.pushValue(entry.course.id);
                } else {
                  void field.removeValue(
                    field.state.value.indexOf(entry.course.id),
                  );
                }
              }}
            />
          ))}
        </View>
      )}
    </form.Field>
  );
};
