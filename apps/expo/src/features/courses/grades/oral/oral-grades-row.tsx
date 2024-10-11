import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { format } from "date-fns";

import type { Grade } from "@stu/lib";
import { formatGrade, isGradeConfirmed } from "@stu/lib";

import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { OutlinedButton } from "~/components/button";
import { ConfirmationStatus } from "~/components/confirmation-status";
import { IconButton } from "~/components/icon-button";
import { Text } from "~/components/text";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { EditOralGrade } from "./edit-oral-grade";
import OralIcon from "./oral.svg";

export const OralGradesRow = ({
  oralGrades,
  courseId,
}: {
  oralGrades: Grade[];
  courseId: string;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const { currentOralGrade, mostRecentConfirmedOralGrade } = useMemo(() => {
    const currentOralGrade = oralGrades[0];
    const mostRecentConfirmedOralGrade =
      oralGrades.find(isGradeConfirmed) ?? null;

    return {
      currentOralGrade,
      mostRecentConfirmedOralGrade:
        currentOralGrade !== mostRecentConfirmedOralGrade
          ? mostRecentConfirmedOralGrade
          : null,
    };
  }, [oralGrades]);

  const [isEditVisible, setIsEditVisible] = useState(false);

  return (
    <View className="flex-row gap-4">
      <PortaledBottomSheet onClose={() => setIsEditVisible(false)}>
        {isEditVisible && (
          <EditOralGrade
            courseId={courseId}
            onClose={() => setIsEditVisible(false)}
            mostRecentConfirmedOralGrade={mostRecentConfirmedOralGrade}
          />
        )}
      </PortaledBottomSheet>

      <OralIcon
        width={64}
        height={64}
        style={{
          opacity:
            !currentOralGrade || isGradeConfirmed(currentOralGrade) ? 1 : 0.25,
        }}
      />

      <View className="grow">
        <View className="flex-row items-center justify-between">
          <Text className="grow text-3xl" weight="semi-bold">
            {currentOralGrade ? formatGrade(currentOralGrade.result) : "—"}
          </Text>

          <IconButton
            icon="edit"
            opacity={0.8}
            size={24}
            onPress={() => setIsEditVisible(true)}
          />
        </View>
        <Text className="text-lg opacity-60">mündlich</Text>
        <Text className="text-lg opacity-60">
          Stand:{" "}
          {currentOralGrade ? format(currentOralGrade.date, "dd.MM.yyyy") : "—"}
        </Text>
        {currentOralGrade && (
          <>
            <View className="h-2" />
            <View className="flex-row items-center justify-between gap-2">
              <ConfirmationStatus
                isOfAge={user.isOfAge}
                order="teacherParent"
                parent={!!currentOralGrade.parentSignature}
                teacher={!!currentOralGrade.teacherSignature}
              />
              {isGradeConfirmed(currentOralGrade) && (
                <Link
                  href={{
                    pathname: "/courses/[course]/grades/[type]/[date]",
                    params: {
                      course: courseId,
                      date: currentOralGrade.date.getTime(),
                      type: "ORAL",
                    },
                  }}
                  asChild
                >
                  <IconButton icon="visibility" opacity={0.8} size={24} />
                </Link>
              )}
            </View>
            {!isGradeConfirmed(currentOralGrade) && (
              <View className="flex-row justify-end">
                <Link
                  href={{
                    pathname: "/courses/[course]/grades/[type]/[date]",
                    params: {
                      course: courseId,
                      date: currentOralGrade.date.getTime(),
                      type: "ORAL",
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
