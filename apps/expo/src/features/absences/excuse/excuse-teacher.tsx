import { useRef } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import type { DrawingViewRef } from "@stu/expo-native-modules";
import type { AbsenceDayWithTeachers } from "@stu/lib";
import { formalName, isArraySingleElement } from "@stu/lib";

import { Button, TextButton } from "~/components/button";
import { SignatureField } from "~/components/signature-field";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

export const ExcuseTeacher = ({
  absence,
}: {
  absence: AbsenceDayWithTeachers;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const router = useRouter();
  const { date, reason } = absence;

  const utils = api.useUtils();
  const excuseMutation = api.students.absences.excuseTeacher.useMutation({
    onSuccess: async () => {
      await utils.students.absences.invalidate();
      router.back();
    },
  });
  const signatureRef = useRef<DrawingViewRef>(null);

  if (!isArraySingleElement(absence.absenceCourses)) {
    return <Text>Ungültige Fehlzeit.</Text>;
  }

  const [absenceCourse] = absence.absenceCourses;

  const handleConfirm = async () => {
    if (!signatureRef.current) {
      return;
    }

    const signature = await signatureRef.current.getSVG();
    excuseMutation.mutate({
      date: date,
      courseId: absenceCourse.course.id,
      signature,
    });
  };

  // We ignore other teachers for now
  const [teacher] = absenceCourse.course.teachers;
  if (!teacher) {
    return <Text>Ungültige Fehlzeit.</Text>;
  }

  return (
    <>
      <Text className="text-lg">
        Bitte lasse deinen Lehrer hier unterschreiben:
      </Text>
      <View className="h-4" />
      <Text className="text-xl">
        Ich, {formalName(teacher)} bestätige, dass der/die Schüler:in{" "}
        <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{date.toLocaleDateString()}</Text> mit folgender
        Begründung nicht am Unterricht teilnehmen konnte:
      </Text>
      <View className="h-4" />
      <Text weight="medium" className="text-xl">
        {reason}
      </Text>
      <View className="h-4" />

      <SignatureField
        label={`Unterschrift von ${formalName(teacher)}`}
        ref={signatureRef}
      />

      <View className="h-4" />

      <View className="flex-row items-center justify-end gap-4">
        <TextButton onPress={() => router.back()} label="Abbrechen" />
        <Button onPress={handleConfirm} label="Entschuldigen" />
      </View>
    </>
  );
};
