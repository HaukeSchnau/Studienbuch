import { useRef } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import type { DrawingViewRef } from "@stu/expo-native-modules";
import type { AbsenceDay } from "@stu/lib";

import { Button, TextButton } from "~/components/button";
import { SignatureField } from "~/components/signature-field";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

export const ExcuseParent = ({ absence }: { absence: AbsenceDay }) => {
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
