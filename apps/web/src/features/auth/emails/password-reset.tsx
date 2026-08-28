import { AuthEmail } from "./layout.tsx";

export const passwordResetEmailSubject = "Studienbuch-Passwort zurücksetzen";

/** Better Auth sends this when somebody starts the password reset flow. */
export const PasswordResetEmail = ({
  url,
  recipient,
}: {
  readonly url: string;
  readonly recipient: string;
}) => (
  <AuthEmail
    cta={{ label: "Neues Passwort setzen", url }}
    heading="Passwort zurücksetzen"
    note="Der Link ist eine Stunde gültig. Wenn du das nicht angefordert hast, kannst du diese Nachricht ignorieren – dein Passwort bleibt dann unverändert."
    preview="Setze in einem Schritt ein neues Passwort."
    recipient={recipient}
  >
    <p style={{ margin: 0 }}>
      Wir haben eine Anfrage bekommen, dein Studienbuch-Passwort zurückzusetzen. Setze über den
      Button unten ein neues Passwort.
    </p>
  </AuthEmail>
);
