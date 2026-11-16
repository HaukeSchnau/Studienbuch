import { AuthHeading } from "@stu/ui/AuthHeading";
import { Button } from "@stu/ui/Button";
import { useRouter } from "expo-router";

import { AuthShell } from "../../ui/AuthShell.tsx";
import { AccountState } from "./AccountState.ts";
import { Form, Lead } from "./AccountForm.tsx";

/**
 * An address the app doesn't know, from a typo, an old link or a wrong deep link. The way back
 * goes to `/`, which is the Übersicht when signed in and the access code when not, and takes the
 * wrong address off the stack.
 */
export function NotFoundScreen() {
  const router = useRouter();
  const access = AccountState.useAccess();

  if (access === "loading") return null;

  return (
    <AuthShell>
      <AuthHeading>Seite nicht gefunden</AuthHeading>
      <Lead>
        Diese Adresse gibt es in Studienbuch nicht. Vielleicht hat sich ein Tippfehler
        eingeschlichen, oder der Link ist veraltet.
      </Lead>
      <Form>
        <Button
          kind="action"
          label={access === "signed-out" ? "Zur Startseite" : "Zur Übersicht"}
          block
          onPress={() => router.dismissTo("/")}
        />
      </Form>
    </AuthShell>
  );
}
