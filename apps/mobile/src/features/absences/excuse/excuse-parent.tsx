import { useRouter } from "expo-router";
import { ConfirmPageContent } from "~/domain-ui/confirm-page-content";
import { PageScaffold } from "~/app-shell/navigation/page-scaffold";
import { Text } from "~/components/ui/text";
import type { Absence } from "@stu/core/compat/mobile-v0";
import { useAbsences } from "~/data/hooks";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";

export const ExcuseParent = ({ absence }: { absence: Absence }) => {
  const router = useRouter();
  const { signAbsence } = useAbsences();
  const { user } = useRequiredAuthenticatedSession();

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
