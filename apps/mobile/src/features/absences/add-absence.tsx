import { getISOWeek, getISOWeekYear, isSameDay, startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Button } from "~/components/button";
import { CheckboxRow } from "~/components/checkbox-row";
import { DateField } from "~/components/date-field";
import { Divider } from "~/components/divider";
import { SheetScaffold } from "~/components/sheet-scaffold";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { haptics } from "~/utils/haptics";
import { subjectNameMap } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";

interface Props {
  onClose: () => void;
}

export const AddAbsence = ({ onClose }: Props) => {
  const { timetable, getCourse, addAbsence } = useMockApp();
  const [date, setDate] = useState(startOfDay(new Date()));
  const [reason, setReason] = useState("");
  const [courseIds, setCourseIds] = useState<string[]>([]);

  const courseOptionsForDay = useMemo(
    () =>
      timetable
        .filter((entry) => isSameDay(entry.start, date))
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [date, timetable],
  );

  void getISOWeek(date);
  void getISOWeekYear(date);

  return (
    <SheetScaffold
      title="Fehlzeit eintragen"
      footer={
        <Button
          className="self-end"
          label="Eintragen"
          onPress={() => {
            addAbsence({ date, courseIds, reason: reason || "Ohne Angabe" });
            haptics.success();
            onClose();
          }}
          disabled={courseIds.length === 0}
        />
      }
    >
      <DateField onChange={setDate} value={date} label="Datum" />
      <Divider />
      <View className="h-4" />

      {courseOptionsForDay.length > 0 ? (
        <View className="gap-4 px-4">
          <Text className="px-4 text-xl" weight="medium">
            Fächer, in denen du gefehlt hast:
          </Text>
          {courseOptionsForDay.map((entry) => {
            const course = getCourse(entry.courseId);
            if (!course) return null;
            const checked = courseIds.includes(course.id);
            return (
              <CheckboxRow
                key={entry.id}
                textStyle={{ fontSize: 16, color: "#000000dd" }}
                label={subjectNameMap[course.subject]}
                value={checked}
                onChange={(value) =>
                  setCourseIds((current) =>
                    value
                      ? [...current, course.id]
                      : current.filter((courseId) => courseId !== course.id),
                  )
                }
              />
            );
          })}
        </View>
      ) : (
        <Text className="px-8">An diesem Tag hast du keine Kurse.</Text>
      )}

      <View className="h-4" />
      <Divider />
      <View className="h-4" />
      <TextField label="Begründung" onChangeText={setReason} value={reason} />
    </SheetScaffold>
  );
};
