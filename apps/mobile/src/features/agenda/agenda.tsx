import { add, format, isSameDay, isTomorrow, isWithinInterval } from "date-fns";
import { de as localeDE } from "date-fns/locale/de";
import { Fragment, useMemo } from "react";
import { View } from "react-native";
import { Card } from "~/components/card";
import { Divider } from "~/components/divider";
import { Text } from "~/components/text";
import { subjectNameMap, Teacher } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";

export const Agenda = () => {
  const { timetable, getCourse } = useMockApp();
  const now = useMemo(() => new Date(), []);

  const nextEntry = timetable
    .slice()
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .find((entry) => add(entry.start, { minutes: entry.duration }) > now);

  if (!nextEntry) {
    return (
      <>
        <View className="h-4" />
        <Card className="p-8">
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
      <Card className="py-2" style={{ padding: 0 }}>
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
