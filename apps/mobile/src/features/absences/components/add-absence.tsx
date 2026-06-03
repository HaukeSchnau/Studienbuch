import { getISOWeek, getISOWeekYear, isSameDay, startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { Button } from "~/components/button";
import { CheckboxRow } from "~/components/checkbox-row";
import { DateField } from "~/components/date-field";
import { SheetCallout } from "~/components/sheet-callout";
import { SheetScaffold } from "~/components/sheet-scaffold";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { subjectNameMap } from "@stu/core";
import { useMockApp } from "~/mock-app/provider";
import { haptics } from "~/utils/haptics";

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
      subtitle="Wähle den Tag und markiere die Kurse, in denen du gefehlt hast."
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

      {courseOptionsForDay.length > 0 ? (
        <View className="rounded-[28px] border border-[#E5EAF0] bg-[#FBFCFE] p-4">
          <Text className="text-[15px] text-[#5B6472]" weight="medium">
            Fächer
          </Text>
          <View className="h-3" />
          <View className="gap-3">
            {courseOptionsForDay.map((entry) => {
              const course = getCourse(entry.courseId);
              if (!course) return null;
              const checked = courseIds.includes(course.id);

              return (
                <CheckboxRow
                  key={entry.id}
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
