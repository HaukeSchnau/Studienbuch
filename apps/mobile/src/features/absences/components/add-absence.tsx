import { addMinutes, format, startOfDay } from "date-fns";
import { de as localeDE } from "date-fns/locale/de";
import { useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { Button, TextButton } from "~/ui/button";
import { NativeCheckbox, NativeDateTimePicker, NativeHost } from "~/ui/native/expo-ui";
import { PressableSurface } from "~/ui/feedback/pressable-surface";
import { SheetCallout } from "~/ui/layout/sheet-callout";
import { SheetScaffold } from "~/ui/layout/sheet-scaffold";
import { SystemIcon } from "~/ui/system-icon";
import { Text } from "~/ui/text";
import { TextField } from "~/ui/fields/text-field";
import { getEntriesForSchoolDay, getNextSchoolDay } from "~/domain-ui/school-day";
import { SubjectIcon } from "~/domain-ui/subject-icon";
import { subjectNameMap, type SubjectId, type TimetableEntry } from "~/compat/mobile-v0";
import { useCourses } from "~/features/courses";
import { useSchedule } from "~/features/schedule";
import { haptics } from "~/infra/native/haptics";
import { colors } from "~/ui/colors";
import { nativeHostThemeProps } from "~/ui/native-theme";
import { useAbsences } from "../use-absences";

interface Props {
  onClose: () => void;
}

export const AddAbsence = ({ onClose }: Props) => {
  const { addAbsence } = useAbsences();
  const { getCourse } = useCourses();
  const { timetable } = useSchedule();
  const initialDate = useMemo(() => getNextSchoolDay(timetable), [timetable]);
  const [date, setDate] = useState(initialDate);
  const [reason, setReason] = useState("");
  const [courseIds, setCourseIds] = useState(() => getCourseIdsForDate(timetable, initialDate));

  const courseOptionsForDay = useMemo(
    () => getEntriesForSchoolDay(timetable, date),
    [date, timetable],
  );

  const handleDateChange = (nextDate: Date) => {
    setDate(nextDate);
    setCourseIds(getCourseIdsForDate(timetable, nextDate));
  };

  const allCourseIds = useMemo(
    () =>
      courseOptionsForDay
        .map((entry) => entry.courseId)
        .filter((courseId, index, ids) => ids.indexOf(courseId) === index),
    [courseOptionsForDay],
  );
  const areAllCoursesSelected =
    allCourseIds.length > 0 && allCourseIds.every((courseId) => courseIds.includes(courseId));

  return (
    <SheetScaffold
      title="Fehlzeit eintragen"
      subtitle="Wähle den Tag und die betroffenen Kurse."
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
      <DateSelectionRow onChange={handleDateChange} value={date} />

      {courseOptionsForDay.length > 0 ? (
        <View className="gap-2.5">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-[15px] text-[#5B6472]" weight="medium">
              Kurse an diesem Tag
            </Text>
            {allCourseIds.length > 1 ? (
              <PressableSurface
                accessibilityLabel={
                  areAllCoursesSelected ? "Alle Kurse abwählen" : "Alle Kurse auswählen"
                }
                borderRadius={16}
                className="px-2 py-1"
                haptic="selection"
                onPress={() => {
                  setCourseIds(areAllCoursesSelected ? [] : allCourseIds);
                }}
                pressedScale={0.98}
              >
                <Text className="text-[14px] text-primary-text" weight="bold">
                  {areAllCoursesSelected ? "Alle abwählen" : "Alle markieren"}
                </Text>
              </PressableSurface>
            ) : null}
          </View>
          <View style={styles.selectionGroup}>
            {courseOptionsForDay.map((entry, index) => {
              const course = getCourse(entry.courseId);
              if (!course) return null;
              const checked = courseIds.includes(course.id);

              return (
                <View key={entry.id}>
                  <CourseSelectionRow
                    checked={checked}
                    label={subjectNameMap[course.subject]}
                    onPress={() =>
                      setCourseIds((current) => toggleCourseId(current, course.id, !checked))
                    }
                    subject={course.subject}
                    timeLabel={`${format(entry.start, "HH:mm")} - ${format(
                      addMinutes(entry.start, entry.duration),
                      "HH:mm",
                    )}`}
                  />
                  {index < courseOptionsForDay.length - 1 ? (
                    <View style={styles.rowDivider} />
                  ) : null}
                </View>
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

const getCourseIdsForDate = (timetable: TimetableEntry[], date: Date) =>
  getEntriesForSchoolDay(timetable, date)
    .map((entry) => entry.courseId)
    .filter((courseId, index, ids) => ids.indexOf(courseId) === index);

const toggleCourseId = (courseIds: string[], courseId: string, selected: boolean) => {
  if (selected) {
    return courseIds.includes(courseId) ? courseIds : [...courseIds, courseId];
  }

  return courseIds.filter((currentCourseId) => currentCourseId !== courseId);
};

const DateSelectionRow = ({ onChange, value }: { onChange: (date: Date) => void; value: Date }) => {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const pickerValue = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
  const formattedDate = format(value, "dd.MM.yyyy");
  const weekday = format(value, "EEEE", { locale: localeDE });

  const handleDateChange = (nextDate: Date) => {
    onChange(startOfDay(nextDate));
  };

  return (
    <View style={styles.selectionGroup}>
      <PressableSurface
        accessibilityLabel={`Datum: ${formattedDate}`}
        borderRadius={24}
        className="min-h-[64px] justify-center px-4 py-3"
        haptic="selection"
        onPress={Platform.OS === "android" ? () => setShowAndroidPicker(true) : undefined}
        pressedScale={0.99}
      >
        <View className="flex-row items-center gap-3">
          <View style={styles.dateIcon}>
            <SystemIcon name="calendar-today" color={colors.primary.text} size={21} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[14px] leading-5 text-[#6B7583]" weight="medium">
              Datum
            </Text>
            <Text className="text-[17px] leading-6 text-[#111827]" weight="semi-bold">
              {weekday}
            </Text>
          </View>
          {Platform.OS === "ios" ? (
            <NativeDateTimePicker
              accentColor={colors.primary.text}
              display="compact"
              locale="de_DE"
              mode="date"
              onValueChange={(_, date) => handleDateChange(date)}
              style={{ height: 38, width: 146 }}
              value={pickerValue}
            />
          ) : (
            <View className="flex-row items-center gap-1">
              <Text className="text-[17px] leading-6 text-[#111827]" weight="semi-bold">
                {formattedDate}
              </Text>
              <SystemIcon name="chevron-right" color="#92A0AF" size={21} />
            </View>
          )}
        </View>
      </PressableSurface>

      {showAndroidPicker ? (
        <NativeDateTimePicker
          value={pickerValue}
          mode="date"
          accentColor={colors.primary.text}
          presentation="dialog"
          onValueChange={(_, date) => {
            setShowAndroidPicker(false);
            handleDateChange(date);
          }}
          onDismiss={() => {
            setShowAndroidPicker(false);
          }}
        />
      ) : null}
    </View>
  );
};

const CourseSelectionRow = ({
  checked,
  label,
  onPress,
  subject,
  timeLabel,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
  subject: SubjectId;
  timeLabel: string;
}) => (
  <PressableSurface
    accessibilityLabel={`${label}, ${timeLabel}`}
    accessibilityRole={Platform.OS === "ios" ? "button" : "checkbox"}
    accessibilityState={{ checked }}
    borderRadius={0}
    className="min-h-[72px] justify-center px-4 py-3"
    haptic="none"
    highlightColor={Platform.OS === "ios" ? "rgba(9, 138, 0, 0.08)" : "rgba(9, 138, 0, 0.12)"}
    onPress={() => {
      haptics.toggle(!checked);
      onPress();
    }}
    pressedScale={0.997}
  >
    <View className="flex-row items-center gap-3">
      {Platform.OS === "android" ? (
        <NativeHost matchContents {...nativeHostThemeProps(colors.primary.DEFAULT)}>
          <NativeCheckbox value={checked} onValueChange={() => undefined} />
        </NativeHost>
      ) : null}

      <View style={styles.subjectIcon}>
        <SubjectIcon subject={subject} size={30} />
      </View>

      <View className="min-w-0 flex-1">
        <Text className="text-[17px] leading-6 text-[#111827]" weight="semi-bold">
          {label}
        </Text>
        <Text className="text-[14px] leading-5 text-[#6B7583]">{timeLabel}</Text>
      </View>

      {Platform.OS === "ios" && checked ? (
        <SystemIcon name="checkmark" color={colors.primary.text} size={23} />
      ) : null}
    </View>
  </PressableSurface>
);

const styles = StyleSheet.create({
  dateIcon: {
    alignItems: "center",
    backgroundColor: colors.primary.des,
    borderRadius: 18,
    borderCurve: "continuous",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  rowDivider: {
    backgroundColor: "#E5EAF0",
    height: StyleSheet.hairlineWidth,
    marginLeft: Platform.OS === "ios" ? 62 : 100,
  },
  selectionGroup: {
    backgroundColor: "#F7F9FC",
    borderColor: "rgba(124, 143, 166, 0.24)",
    borderCurve: "continuous",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  subjectIcon: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34,
  },
});
