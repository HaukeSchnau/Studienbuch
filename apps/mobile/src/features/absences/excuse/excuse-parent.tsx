import { ConfirmPageContent } from "~/components/layout/confirm-page-content";
import { PageScaffold } from "~/components/layout/page-scaffold";
import { Text } from "~/components/ui/text";
import type { Absence } from "@stu/core";
import { useMockAbsences } from "~/mock-app/hooks";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";

export const ExcuseParent = ({ absence }: { absence: Absence }) => {
  const { signAbsence } = useMockAbsences();
  const { user } = useRequiredAuthenticatedSession();

  return (
    <PageScaffold
      title="Fehlzeit entschuldigen (Eltern)"
      contentClassName="p-8"
      useDefaultPadding={false}
    >
      <ConfirmPageContent
        heading="Bitte lasse deine Eltern hier unterschreiben"
        major={absence.reason}
        confirmLabel="Entschuldigen"
        onConfirm={() => signAbsence(absence.id, "parent")}
        signatureLabel="Unterschrift des Erziehungsberechtigten"
      >
        Ich bestätige, dass mein Kind <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{absence.date.toLocaleDateString("de-DE")}</Text> mit folgender
        Begruendung nicht am Unterricht teilnehmen konnte.
      </ConfirmPageContent>
    </PageScaffold>
  );
};
