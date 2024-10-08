import { Stack, useRouter } from "expo-router";

import type { AbsenceDay } from "@stu/lib";

import { ConfirmPageContent } from "~/components/confirm-page-content";
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

  const handleConfirm = (signature: string) =>
    excuseMutation.mutate({
      date: date,
      signature,
    });

  return (
    <>
      <Stack.Screen
        options={{
          title: "Fehlzeit entschuldigen (Eltern)",
        }}
      />
      <ConfirmPageContent
        heading="Bitte lasse deine Eltern hier unterschreiben"
        major={reason}
        confirmLabel="Entschuldigen"
        onConfirm={handleConfirm}
        signatureLabel="Unterschrift des Erziehungsberechtigten"
      >
        Ich bestätige, dass mein Kind <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{date.toLocaleDateString()}</Text> mit folgender
        Begründung nicht am Unterricht teilnehmen konnte
      </ConfirmPageContent>
    </>
  );
};
