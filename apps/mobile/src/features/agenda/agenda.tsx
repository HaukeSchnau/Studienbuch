import { add, format, isSameDay, isTomorrow, isWithinInterval } from "date-fns";
import { de as localeDE } from "date-fns/locale/de";
import { Fragment, useMemo } from "react";
import { View } from "react-native";
import { Card } from "~/components/ui/card";
import { Divider } from "~/components/ui/divider";
import { Text } from "~/components/ui/text";
import { subjectNameMap, Teacher } from "@stu/core";
import { useMockCourses, useMockSchedule } from "~/mock-app/hooks";

const matchHolidayName = (name: string) => {
  const normalized = name.toLowerCase();
  if (normalized.includes("winter")) return "Winterferien";
  if (normalized.includes("oster")) return "Osterferien";
  if (normalized.includes("pfingst")) return "Pfingstferien";
  if (normalized.includes("sommer")) return "Sommerferien";
  if (normalized.includes("herbst")) return "Herbstferien";
  if (normalized.includes("weihnacht")) return "Weihnachtsferien";
  return "Ferien";
};

export const Agenda = () => {
  const { getCourse } = useMockCourses();
  const { getActiveHoliday, timetable } = useMockSchedule();
  const now = useMemo(() => new Date(), []);

  const nextEntry = timetable
    .slice()
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .find((entry) => add(entry.start, { minutes: entry.duration }) > now);

  if (!nextEntry) {
    const holiday = getActiveHoliday(now);

    if (holiday) {
      return (
        <>
          <View className="h-4" />
          <Card padding="md">
            <Text className="text-center text-2xl">
              Schöne {matchHolidayName(holiday.name)}! 🎉
            </Text>
            <View className="h-4" />
            <Text className="text-center opacity-80">
              {format(holiday.start, "dd.MM.yyyy")} - {format(holiday.end, "dd.MM.yyyy")}
            </Text>
          </Card>
        </>
      );
    }

    return (
      <>
        <View className="h-4" />
        <Card padding="md">
          <Text className="text-center text-2xl">Heute ist nichts geplant. 🎉</Text>
        </Card>
      </>
    );
  }

  const entries = timetable.filter((entry) => isSameDay(entry.start, nextEntry.start));
  const dateFormatted = (() => {
    if (isSameDay(nextEntry.start, now)) return "heute";
    if (isTomorrow(nextEntry.start)) return "morgen";
    if (isWithinInterval(nextEntry.start, { start: now, end: add(now, { days: 6 }) })) {
      return `am ${format(nextEntry.start, "EEEE", { locale: localeDE })}`;
    }
    return `am ${format(nextEntry.start, "dd.MM.yyyy")}`;
  })();

  return (
    <>
      <Text className="text-2xl text-white">Das steht {dateFormatted} an:</Text>
      <View className="h-4" />
      <Card padding="none" style={{ paddingVertical: 8 }}>
        {entries.map((entry, index) => {
          const course = getCourse(entry.courseId);
          if (!course) return null;
          return (
            <Fragment key={entry.id}>
              {index !== 0 && <Divider />}
              <View className="flex-row px-6 py-2">
                <View>
                  <Text className="text-sm opacity-80">{format(entry.start, "HH:mm")}</Text>
                  <Text className="text-lg text-primary-text">
                    {subjectNameMap[course.subject]}
                  </Text>
                  <Text className="text-base opacity-80">
                    {course.teachers.map((teacher) => Teacher.formalName(teacher)).join(", ")}
                  </Text>
                </View>
              </View>
            </Fragment>
          );
        })}
      </Card>
    </>
  );
};
