import { useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import type { DrawingViewRef } from "@stu/expo-native-modules";
import type { AbsenceDay } from "@stu/lib";
import { formalName, isArraySingleElement } from "@stu/lib";

import { Button, TextButton } from "~/components/button";
import { SignatureField } from "~/components/signature-field";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

export default function ExcuseAbsencePage() {
  const { courses: coursesStr, date: dateStr } = useLocalSearchParams<{
    date: string;
    courses: string;
  }>();
  const date = new Date(parseInt(dateStr));
  const courses = coursesStr.split(";");

  const absences = api.students.absences.getOne.useQuery({
    date,
    courses,
  });

  if (absences.isPending) {
    return <ActivityIndicator />;
  }

  if (absences.isError) {
    return <Text>Error: {absences.error.message}</Text>;
  }

  const absence = absences.data;

  if (!absence) {
    return <Text>Keine unentschuldigten Fehlzeiten gefunden.</Text>;
  }

  return (
    <View className="p-8">
      <Stack.Screen
        options={{
          title: "Fehlzeit entschuldigen",
          headerTintColor: "#FFFFFF",
          headerBackTitle: "Zurück",
        }}
      />

      {!absence.parentSignature ? (
        <ExcuseParent absence={absence} />
      ) : (
        <ExcuseTeacher absence={absence} />
      )}
    </View>
  );
}

const ExcuseParent = ({ absence }: { absence: AbsenceDay }) => {
  const { user } = useRequiredAuthenticatedSession();
  const router = useRouter();
  const { date, reason } = absence;

  const utils = api.useUtils();
  const excuseMutation = api.students.absences.excuseParent.useMutation({
    onSuccess: async () => {
      await utils.students.absences.invalidate();
      router.back();
    },
  });
  const signatureRef = useRef<DrawingViewRef>(null);

  const handleConfirm = async () => {
    if (!signatureRef.current) {
      return;
    }

    const signature = await signatureRef.current.getSVG();
    excuseMutation.mutate({
      date: date,
      signature,
    });
  };

  return (
    <>
      <Text className="text-lg">
        Bitte lasse deine Eltern hier unterschreiben:
      </Text>
      <View className="h-4" />
      <Text className="text-xl">
        Ich bestätige, dass mein Kind <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{date.toLocaleDateString()}</Text> mit folgender
        Begründung nicht am Unterricht teilnehmen konnte:
      </Text>
      <View className="h-4" />
      <Text weight="medium" className="text-xl">
        {reason}
      </Text>
      <View className="h-4" />

      <SignatureField
        label="Unterschrift des Erziehungsberechtigten"
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

const ExcuseTeacher = ({ absence }: { absence: AbsenceDay }) => {
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

  return (
    <>
      <Text className="text-lg">
        Bitte lasse deinen Lehrer hier unterschreiben:
      </Text>
      <View className="h-4" />
      <Text className="text-xl">
        {/* Ich, {formalName(absenceCourse.course.teacher)} <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{date.toLocaleDateString()}</Text> mit folgender
        Begründung nicht am Unterricht teilnehmen konnte: */}
      </Text>
      <View className="h-4" />
      <Text weight="medium" className="text-xl">
        {reason}
      </Text>
      <View className="h-4" />

      <SignatureField
        label="Unterschrift des Erziehungsberechtigten"
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
