import { Fragment, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import {
  add,
  format,
  getISOWeek,
  getISOWeekYear,
  isAfter,
  isSameDay,
  isTomorrow,
} from "date-fns";
import { de as localeDE } from "date-fns/locale/de";

import type { AgendaEntry } from "@stu/lib";
import { formalName, subjectNameMap } from "@stu/lib";

import { Card } from "~/components/card";
import { Text } from "~/components/text";
import { api } from "~/utils/api";

export const Agenda = () => {
  const now = useMemo(() => new Date(), []);

  // We intentionally overfetch here to update the cache for the entire week.
  // This way, we can avoid refetching the data when the user navigates to a different day or wants to see the entire week.
  // If this is a performance issue, we can consider optimizing.
  const timetable = api.students.timetable.getWeek.useQuery(
    { isoWeekYear: getISOWeekYear(now), isoWeek: getISOWeek(now) },
    {
      select: (entries) => {
        // const todaysEntries = entries.filter((entry) => isSameDay(entry.start, now));

        const nextEntry = entries.find((entry) =>
          isAfter(
            add(entry.start, {
              minutes: entry.duration,
            }),
            now,
          ),
        );

        if (!nextEntry) {
          return {
            entries: [],
            date: null,
          };
        }

        return {
          entries: entries.filter((entry) =>
            isSameDay(entry.start, nextEntry.start),
          ),
          date: nextEntry.start,
        };
      },
    },
  );

  if (timetable.isPending) {
    return (
      <>
        <View className="h-4" />
        <Card className="py-2" style={{ padding: 0 }}>
          <ActivityIndicator />
        </Card>
      </>
    );
  }

  if (timetable.isError) {
    return (
      <>
        <View className="h-4" />
        <Card className="py-2" style={{ padding: 0 }}>
          <Text>Error: {timetable.error.message}</Text>
        </Card>
      </>
    );
  }

  const { date, entries } = timetable.data;

  if (!date) {
    return (
      <Text className="color-white text-2xl">Heute ist nichts geplant!</Text>
    );
  }

  const dateFormatted = (() => {
    if (isSameDay(date, now)) {
      return "heute";
    }

    if (isTomorrow(date)) {
      return "morgen";
    }

    return `am ${format(date, "EEEE", {
      locale: localeDE,
    })}`;
  })();

  return (
    <>
      <Text className="color-white text-2xl">
        Das steht {dateFormatted} an:
      </Text>

      <View className="h-4" />

      <Card className="py-2" style={{ padding: 0 }}>
        {entries.map((entry, i) => (
          <Fragment key={`${entry.start.toISOString()}-${entry.course.id}`}>
            {i !== 0 && <Divider />}
            <AgendaEntry entry={entry} />
          </Fragment>
        ))}
      </Card>
    </>
  );
};

const AgendaEntry = ({ entry }: { entry: AgendaEntry }) => {
  return (
    <View className="flex-row px-6 py-2">
      <View>
        <Text className="text-sm opacity-80">
          {format(entry.start, "HH:mm")}
        </Text>
        <Text className="text-lg text-primary-text">
          {subjectNameMap[entry.course.subject]}
        </Text>
        <Text className="text-md opacity-80">
          {entry.course.teachers.map(formalName).join(", ")}
        </Text>
      </View>
    </View>
  );
};

const Divider = () => {
  return <View style={{ height: 1, backgroundColor: "#00000022" }} />;
};
