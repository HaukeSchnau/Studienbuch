import { ActivityIndicator, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialIcons";
import { useQuery } from "@tanstack/react-query";

import { colors } from "@stu/tailwind-config/native";

import type { AbsenceItem as AbsenceItemType } from "./types";
import { TempError } from "~/components/temp-error";
import { Text } from "~/components/text";
import { listExcused, listUnexcused } from "../queries";
import { AbsenceItem } from "./absence-item";

export const UnexcusedAbsences = () => {
  const query = useQuery({
    ...listUnexcused(),
    select: (absences) => {
      const unexcusedByTeacher: AbsenceItemType[] = [];
      const unexcusedByParent: AbsenceItemType[] = [];
      for (const absence of absences) {
        if (absence.parentSignature) {
          unexcusedByTeacher.push(
            ...absence.absenceCourses.map(
              (course): AbsenceItemType => ({
                date: absence.date,
                courses: [course.course],
                reason: absence.reason,
                isExcusedByParent: !!absence.parentSignature,
                isExcusedByTeacher: !!course.teacherSignature,
              }),
            ),
          );
        } else {
          unexcusedByParent.push({
            date: absence.date,
            courses: absence.absenceCourses.map((course) => course.course),
            reason: absence.reason,
            isExcusedByParent: !!absence.parentSignature,
            isExcusedByTeacher: false,
          });
        }
      }

      return {
        byParent: unexcusedByParent,
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
        <TempError error={query.error.message} />
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
          key={`${absence.date.toISOString()}-${absence.courses[0]?.id}`}
          absenceGroup={absence}
        />
      ))}
      {query.data.byParent.map((group) => (
        <AbsenceItem key={group.date.toISOString()} absenceGroup={group} />
      ))}
    </View>
  );
};

export const ExcusedAbsences = () => {
  const query = useQuery({
    ...listExcused(),
    select: (absences) => {
      return absences.map((absence) => ({
        date: absence.date,
        courses: absence.absenceCourses.map((course) => course.course),
        reason: absence.reason,
        isExcusedByTeacher: true,
        isExcusedByParent: true,
      }));
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
        <TempError error={query.error.message} />
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
