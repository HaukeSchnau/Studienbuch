import { View } from "react-native";
import { format } from "date-fns";

import type { Grade, GradeType } from "@stu/lib";
import { formatGradeShort } from "@stu/lib";
import { colors } from "@stu/tailwind-config/native";

import { OutlinedButton } from "~/components/button";
import { Card } from "~/components/card";
import { ConfirmationStatus } from "~/components/confirmation-status";
import { Text } from "~/components/text";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

const TYPE_MAP: Record<GradeType, string> = {
  MASTER: "Aktuelle Gesamtnote",
  ORAL: "Mündliche Note",
  WRITTEN: "Klausur",
};

export const GradeCard = ({
  grade,
  actionText,
  onClick,
}: {
  grade: Grade;
  actionText: string;
  onClick: () => void;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const isConfirmed = !!grade.parentSignature && !!grade.teacherSignature;

  return (
    <Card
      noShadow
      style={{
        backgroundColor: isConfirmed ? colors.primary.des : colors.danger.des,
      }}
    >
      <View className="flex-row items-center">
        <Text weight="bold" className="text-2xl">
          {formatGradeShort(grade.result)}
        </Text>
        <View className="w-3" />
        <View>
          <Text className="text-lg">
            {TYPE_MAP[grade.type]} vom {format(grade.date, "dd.MM.yyyy")}
          </Text>
          <ConfirmationStatus
            isOfAge={user.isOfAge}
            order="teacherParent"
            parent={!!grade.parentSignature}
            teacher={!!grade.teacherSignature}
          />
        </View>
      </View>
      <OutlinedButton
        label={actionText}
        color={colors.primary.text}
        className="self-end"
        onPress={onClick}
      />
    </Card>
  );
};
