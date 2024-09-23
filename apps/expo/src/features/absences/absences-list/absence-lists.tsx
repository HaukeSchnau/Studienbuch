import { ActivityIndicator, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialIcons";

import type { Absence } from "@stu/lib";
import { colors } from "@stu/tailwind-config/native";

import type { AbsenceGroup } from "~/features/absences/absences-list/types";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { AbsenceItem } from "./absence-item";

const mapAbsenceToGroup = (absence: Absence): AbsenceGroup => {
  return {
    date: absence.date,
    reason: absence.reason,
    isExcusedByTeacher: !!absence.teacherSignature,
    isExcusedByParent: !!absence.parentSignature,
    absences: [absence],
  };
};

export const UnexcusedAbsences = () => {
  const query = api.students.absences.listUnexcused.useQuery(undefined, {
    select: (absences) => {
      const unexcusedByTeacher = absences.filter(
        (absence) => absence.parentSignature && !absence.teacherSignature,
      );
      const unexcusedByParent = absences.filter(
        (absence) => !absence.parentSignature,
      );

      const absenceGroupsByParent = new Map<number, AbsenceGroup>();
      for (const absence of unexcusedByParent) {
        if (!absenceGroupsByParent.has(absence.date.getTime())) {
          absenceGroupsByParent.set(absence.date.getTime(), {
            date: absence.date,
            reason: absence.reason,
            isExcusedByTeacher: false,
            isExcusedByParent: false,
            absences: [],
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- we just set it
        absenceGroupsByParent
          .get(absence.date.getTime())!
          .absences.push(absence);
      }
      return {
        byParent: [...absenceGroupsByParent.values()],
        byTeacher: unexcusedByTeacher,
      };
    },
  });

  const heading = (
    <View className="flex-row gap-2">
      <Icon name="warning" size={24} color={colors.danger.DEFAULT} />
      <Text className="text-lg text-danger">unentschuldigte Fehlzeiten</Text>
    </View>
  );

  if (query.isPending) {
    return (
      <View className="gap-2">
        {heading}
        <ActivityIndicator />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View className="gap-2">
        {heading}
        <Text className="text-center">Ein Fehler ist aufgetreten</Text>
      </View>
    );
  }

  if (query.data.byParent.length === 0 && query.data.byTeacher.length === 0) {
    return (
      <View className="gap-2">
        {heading}
        <Text className="text-center">
          Keine unentschuldigten Fehlzeiten gefunden
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {heading}
      {query.data.byTeacher.map((absence) => (
        <AbsenceItem
          key={`${absence.date.toISOString()}-${absence.course.id}`}
          absenceGroup={mapAbsenceToGroup(absence)}
        />
      ))}
      {query.data.byParent.map((group) => (
        <AbsenceItem key={group.date.toISOString()} absenceGroup={group} />
      ))}
    </View>
  );
};

export const ExcusedAbsences = () => {
  const query = api.students.absences.listExcused.useQuery(undefined, {
    select: (absences) => {
      const groups = new Map<number, AbsenceGroup>();
      for (const absence of absences) {
        if (!groups.has(absence.date.getTime())) {
          groups.set(absence.date.getTime(), {
            date: absence.date,
            reason: absence.reason,
            isExcusedByTeacher: false,
            isExcusedByParent: false,
            absences: [],
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- we just set it
        groups.get(absence.date.getTime())!.absences.push(absence);
      }
      return [...groups.values()];
    },
  });

  const heading = (
    <View className="flex-row gap-2">
      <Icon name="verified" size={24} color={colors.primary.text} />
      <Text className="text-lg text-primary-text">
        entschuldigte Fehlzeiten
      </Text>
    </View>
  );

  if (query.isPending) {
    return (
      <View className="gap-2">
        {heading}
        <ActivityIndicator />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View className="gap-2">
        {heading}
        <Text className="text-center">Ein Fehler ist aufgetreten</Text>
      </View>
    );
  }

  if (query.data.length === 0) {
    return (
      <View className="gap-2">
        {heading}
        <Text className="text-center">
          Keine entschuldigten Fehlzeiten gefunden
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {heading}
      {query.data.map((group) => (
        <AbsenceItem key={group.date.toISOString()} absenceGroup={group} />
      ))}
    </View>
  );
};
