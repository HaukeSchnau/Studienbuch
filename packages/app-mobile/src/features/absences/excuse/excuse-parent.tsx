import type { AbsenceDay } from "@stu/lib";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";

import { ConfirmPageContent } from "~/components/confirm-page-content";
import { Text } from "~/components/text";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { useIngest } from "~/utils/events/ingest";

export const ExcuseParent = ({ absence }: { absence: AbsenceDay }) => {
  const { user } = useRequiredAuthenticatedSession();
  const router = useRouter();
  const { date, reason } = absence;

  const queryClient = useQueryClient();
  const excuseMutation = useIngest("absence.parentApproved", {
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["absences"],
      });
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
        <Text weight="bold">{date.toLocaleDateString()}</Text> mit folgender Begründung nicht am Unterricht teilnehmen
        konnte
      </ConfirmPageContent>
    </>
  );
};
