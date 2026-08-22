import { useRouter } from "expo-router";
import { ConfirmPageContent } from "~/domain-ui/confirm-page-content";
import { PageScaffold } from "~/ui/navigation/page-scaffold";
import { Text } from "~/ui/text";
import type { Absence } from "~/compat/mobile-v0";
import { useProfile } from "~/features/profile";
import { useAbsences } from "../use-absences";

export const ExcuseParent = ({ absence }: { absence: Absence }) => {
  const router = useRouter();
  const { signAbsence } = useAbsences();
  const { profile: user } = useProfile();

  return (
    <PageScaffold
      title="Fehlzeit entschuldigen (Eltern)"
      contentClassName="p-8"
      useDefaultPadding={false}
    >
      <ConfirmPageContent
        onCancel={() => router.back()}
        heading="Bitte lasse deine Eltern hier unterschreiben"
        major={absence.reason}
        confirmLabel="Entschuldigen"
        onConfirm={() => signAbsence(absence.id, "parent")}
        signatureLabel="Unterschrift des Erziehungsberechtigten"
      >
        Ich bestätige, dass mein Kind <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{absence.date.toLocaleDateString("de-DE")}</Text> mit folgender
        Begründung nicht am Unterricht teilnehmen konnte.
      </ConfirmPageContent>
    </PageScaffold>
  );
};
