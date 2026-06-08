import { Fragment, useMemo, useState } from "react";
import { View } from "react-native";

import { Button, TextButton } from "~/components/ui/button";
import { CheckboxRow } from "~/components/fields/checkbox-row";
import { DateField } from "~/components/fields/date-field";
import { SheetCallout } from "~/components/layout/sheet-callout";
import { SheetScaffold } from "~/components/layout/sheet-scaffold";
import { Text } from "~/components/ui/text";
import { TextField } from "~/components/fields/text-field";
import { getEntriesForSchoolDay, getNextSchoolDay } from "~/domain-ui/school-day";
import { subjectNameMap } from "@stu/core";
import { useAbsences, useCourses, useScheduleData } from "~/data/hooks";
import { haptics } from "~/platform/haptics";

interface Props {
  onClose: () => void;
}

export const AddAbsence = ({ onClose }: Props) => {
  const { addAbsence } = useAbsences();
  const { getCourse } = useCourses();
  const { timetable } = useScheduleData();
  const [date, setDate] = useState(() => getNextSchoolDay(timetable));
  const [reason, setReason] = useState("");
  const [courseIds, setCourseIds] = useState<string[]>([]);

  const courseOptionsForDay = useMemo(
    () => getEntriesForSchoolDay(timetable, date),
    [date, timetable],
  );

  const handleDateChange = (nextDate: Date) => {
    setDate(nextDate);
    setCourseIds([]);
  };

  return (
    <SheetScaffold
      title="Fehlzeit eintragen"
      subtitle="Wähle den Tag und markiere die Kurse, in denen du gefehlt hast."
      footer={
        <View className="flex-row items-center justify-end gap-4">
          <TextButton label="Abbrechen" onPress={onClose} />
          <Button
            label="Eintragen"
            onPress={() => {
              addAbsence({ date, courseIds, reason: reason || "Ohne Angabe" });
              haptics.success();
              onClose();
            }}
            disabled={courseIds.length === 0}
          />
        </View>
      }
    >
      <DateField onChange={handleDateChange} value={date} label="Datum" iosContainer="plain" />

      {courseOptionsForDay.length > 0 ? (
        <View className="gap-2">
          <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
            Fächer
          </Text>
          <View className="overflow-hidden rounded-[24px] border border-[#DCE4EE] bg-[#F6F8FB]">
            {courseOptionsForDay.map((entry, index) => {
              const course = getCourse(entry.courseId);
              if (!course) return null;
              const checked = courseIds.includes(course.id);

              return (
                <Fragment key={entry.id}>
                  <CheckboxRow
                    presentation="grouped"
                    textStyle={{ fontSize: 16, color: "#111827" }}
                    label={subjectNameMap[course.subject]}
                    value={checked}
                    onChange={(nextValue) =>
                      setCourseIds((current) =>
                        nextValue
                          ? [...current, course.id]
                          : current.filter((courseId) => courseId !== course.id),
                      )
                    }
                  />
                  {index < courseOptionsForDay.length - 1 ? (
                    <View className="ml-16 h-px bg-[#E5EAF0]" />
                  ) : null}
                </Fragment>
              );
            })}
          </View>
        </View>
      ) : (
        <SheetCallout>An diesem Tag hast du keine Kurse.</SheetCallout>
      )}

      <TextField
        label="Begründung"
        placeholder="Optional: kurze Erklärung"
        onChangeText={setReason}
        value={reason}
      />
    </SheetScaffold>
  );
};
