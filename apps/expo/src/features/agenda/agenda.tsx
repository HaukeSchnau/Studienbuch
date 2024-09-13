import { Fragment, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { format, isSameDay } from "date-fns";

import type { AgendaEntry } from "@stu/lib";
import { formalName, subjectNameMap } from "@stu/lib";

import { Card } from "~/components/card";
import { Text } from "~/components/text";
import { api } from "~/utils/api";

export const Agenda = () => {
  const today = useMemo(() => new Date(), []);
  // We intentionally overfetch here to update the cache for the entire week.
  // This way, we can avoid refetching the data when the user navigates to a different day or wants to see the entire week.
  // If this is a performance issue, we can consider optimizing.
  const timetable = api.students.timetable.getWeek.useQuery(
    { date: today },
    {
      select: (data) => data.filter((entry) => isSameDay(entry.start, today)),
    },
  );

  return (
    <Card className="py-2" style={{ padding: 0 }}>
      {timetable.isPending ? (
        <ActivityIndicator />
      ) : timetable.isError ? (
        <Text>Error: {timetable.error.message}</Text>
      ) : (
        timetable.data.map((entry, i) => (
          <Fragment key={`${entry.start.toISOString()}-${entry.course.id}`}>
            {i !== 0 && <Divider />}
            <AgendaEntry entry={entry} />
          </Fragment>
        ))
      )}
    </Card>
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
