import { useQuery } from "@tanstack/react-query";
import { add, format, getISOWeek, getISOWeekYear, isAfter, isSameDay, isTomorrow, isWithinInterval } from "date-fns";
import { de as localeDE } from "date-fns/locale/de";
import { Fragment, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";

import type { AgendaEntry } from "@stu/lib";
import { formalName, subjectNameMap } from "@stu/lib";

import { Card } from "~/components/card";
import { Divider } from "~/components/divider";
import { Text } from "~/components/text";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { getHolidays } from "../holidays/queries/get-holidays";
import { getTimetableWeek } from "./queries/week";

const matchHolidayName = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("winter")) {
    return "Winterferien";
  } else if (n.includes("oster")) {
    return "Osterferien";
  } else if (n.includes("pfingst")) {
    return "Pfingstferien";
  } else if (n.includes("sommer")) {
    return "Sommerferien";
  } else if (n.includes("herbst")) {
    return "Herbstferien";
  } else if (n.includes("weihnacht")) {
    return "Weihnachtsferien";
  } else {
    return "Ferien";
  }
};

const EmptyState = () => {
  const { userId } = useRequiredAuthenticatedSession();
  const holiday = useQuery({
    ...getHolidays({
      year: new Date().getFullYear(),
      userId,
    }),
    select: (holidays) =>
      holidays.find((holiday) =>
        isWithinInterval(new Date(), {
          start: holiday.start,
          end: holiday.end,
        }),
      ),
  });

  if (!holiday.data) {
    return <Text className="color-white text-2xl">Heute ist nichts geplant. 🎉</Text>;
  }

  return (
    <>
      <View className="h-4" />
      <Card className="p-8">
        <Text className="text-center text-2xl">Schöne {matchHolidayName(holiday.data.name)}! 🎉</Text>
        <View className="h-4" />
        <Text className="text-center opacity-80">
          {format(holiday.data.start, "dd.MM.yyyy")} - {format(holiday.data.end, "dd.MM.yyyy")}
        </Text>
      </Card>
    </>
  );
};

export const Agenda = () => {
  const now = useMemo(() => new Date(), []);

  // We intentionally overfetch here to update the cache for the entire week.
  // This way, we can avoid refetching the data when the user navigates to a different day or wants to see the entire week.
  // If this is a performance issue, we can consider optimizing.
  const timetable = useQuery({
    ...getTimetableWeek({
      isoWeekYear: getISOWeekYear(now),
      isoWeek: getISOWeek(now),
    }),
    select: (entries) => {
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
        entries: entries.filter((entry) => isSameDay(entry.start, nextEntry.start)),
        date: nextEntry.start,
      };
    },
  });

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
    return <EmptyState />;
  }

  const dateFormatted = (() => {
    if (isSameDay(date, now)) {
      return "heute";
    }

    if (isTomorrow(date)) {
      return "morgen";
    }

    if (isWithinInterval(date, { start: now, end: add(now, { days: 6 }) })) {
      return `am ${format(date, "EEEE", {
        locale: localeDE,
      })}`;
    }

    return `am ${format(date, "dd.MM.yyyy")}`;
  })();

  return (
    <>
      <Text className="color-white text-2xl">Das steht {dateFormatted} an:</Text>

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
        <Text className="text-sm opacity-80">{format(entry.start, "HH:mm")}</Text>
        <Text className="text-lg text-primary-text">{subjectNameMap[entry.course.subject]}</Text>
        <Text className="text-md opacity-80">{entry.course.teachers.map(formalName).join(", ")}</Text>
      </View>
    </View>
  );
};
