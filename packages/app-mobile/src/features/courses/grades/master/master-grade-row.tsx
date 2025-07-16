import Icon from "@expo/vector-icons/MaterialIcons";
import { format } from "date-fns";
import { Link } from "expo-router";
import React, { useMemo, useState } from "react";
import { View } from "react-native";

import type { Grade } from "@stu/lib";
import { formatGrade, isGradeConfirmed } from "@stu/lib";
import { colors } from "@stu/tailwind-config/native";

import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { OutlinedButton } from "~/components/button";
import { ConfirmationStatus } from "~/components/confirmation-status";
import { IconButton } from "~/components/icon-button";
import { Text } from "~/components/text";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { EditMasterGrade } from "./edit-master-grade";

export const MasterGradeRow = ({
  masterGrades,
  courseId,
}: {
  masterGrades: Grade[];
  courseId: string;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const { currentMasterGrade, mostRecentConfirmedMasterGrade } = useMemo(() => {
    const currentMasterGrade = masterGrades[0];
    const mostRecentConfirmedMasterGrade = masterGrades.find(isGradeConfirmed) ?? null;

    return {
      currentMasterGrade,
      mostRecentConfirmedMasterGrade:
        currentMasterGrade !== mostRecentConfirmedMasterGrade ? mostRecentConfirmedMasterGrade : null,
    };
  }, [masterGrades]);

  const [isEditVisible, setIsEditVisible] = useState(false);

  return (
    <View className="flex-row gap-4">
      <PortaledBottomSheet onClose={() => setIsEditVisible(false)}>
        {isEditVisible && (
          <EditMasterGrade
            courseId={courseId}
            onClose={() => setIsEditVisible(false)}
            mostRecentConfirmedMasterGrade={mostRecentConfirmedMasterGrade}
          />
        )}
      </PortaledBottomSheet>

      <Icon
        name="star"
        size={64}
        color={colors.primary.DEFAULT}
        style={{
          opacity: !currentMasterGrade || isGradeConfirmed(currentMasterGrade) ? 1 : 0.25,
        }}
      />

      <View className="grow">
        <View className="flex-row items-center justify-between">
          <Text className="grow text-3xl" weight="semi-bold">
            {currentMasterGrade ? formatGrade(currentMasterGrade.result) : "—"}
          </Text>

          <IconButton icon="edit" opacity={0.8} size={24} onPress={() => setIsEditVisible(true)} />
        </View>
        <Text className="text-lg opacity-60">aktuelle Gesamtnote</Text>
        <Text className="text-lg opacity-60">
          Stand: {currentMasterGrade ? format(currentMasterGrade.date, "dd.MM.yyyy") : "—"}
        </Text>
        {currentMasterGrade && (
          <>
            <View className="h-2" />
            <View className="flex-row items-center justify-between gap-2">
              <ConfirmationStatus
                isOfAge={user.isOfAge}
                order="teacherParent"
                parent={!!currentMasterGrade.parentSignature}
                teacher={!!currentMasterGrade.teacherSignature}
              />
              {isGradeConfirmed(currentMasterGrade) && (
                <Link
                  href={{
                    pathname: "/courses/[course]/grades/[type]/[date]",
                    params: {
                      course: courseId,
                      date: currentMasterGrade.date.getTime(),
                      type: "MASTER",
                    },
                  }}
                  asChild
                >
                  <IconButton icon="visibility" opacity={0.8} size={24} />
                </Link>
              )}
            </View>
            {!isGradeConfirmed(currentMasterGrade) && (
              <View className="flex-row justify-end">
                <Link
                  href={{
                    pathname: "/courses/[course]/grades/[type]/[date]",
                    params: {
                      course: courseId,
                      date: currentMasterGrade.date.getTime(),
                      type: "MASTER",
                    },
                  }}
                  asChild
                >
                  <OutlinedButton label="Jetzt bestätigen" />
                </Link>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
};
