import { format } from "date-fns";
import type { Href } from "expo-router";
import { Link } from "expo-router";
import { View } from "react-native";

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
  action,
}: {
  grade: Grade;
  action:
    | {
        label: string;
        onClick: () => void;
      }
    | {
        label: string;
        href: Href;
      }
    | null;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const isConfirmed = !!grade.parentSignature && !!grade.teacherSignature;
  const actionColor = isConfirmed ? colors.primary.text : colors.danger.DEFAULT;

  return (
    <Card
      noShadow
      style={{
        backgroundColor: isConfirmed ? colors.primary.des : colors.danger.des,
      }}
    >
      <View className="flex-row items-center">
        <Text weight="bold" className="w-8 text-center text-2xl">
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
      {action && (
        <>
          <View className="h-2" />
          {"href" in action ? (
            <Link href={action.href} asChild>
              <OutlinedButton
                label={action.label}
                color={actionColor}
                className="self-end"
              />
            </Link>
          ) : (
            <OutlinedButton
              label={action.label}
              color={actionColor}
              className="self-end"
              onPress={action.onClick}
            />
          )}
        </>
      )}
    </Card>
  );
};
