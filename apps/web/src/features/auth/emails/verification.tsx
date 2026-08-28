import { AuthEmail } from "./layout.tsx";

export const verificationEmailSubject = "E-Mail-Adresse für Studienbuch bestätigen";

/** Better Auth sends this on sign-up and on sign-in for an unverified address. */
export const VerificationEmail = ({
  url,
  recipient,
}: {
  readonly url: string;
  readonly recipient: string;
}) => (
  <AuthEmail
    cta={{ label: "E-Mail-Adresse bestätigen", url }}
    heading="E-Mail-Adresse bestätigen"
    note="Der Link ist eine Stunde gültig. Wenn du dich nicht bei Studienbuch angemeldet hast, kannst du diese Nachricht ignorieren."
    preview="Ein Klick, und dein Konto ist aktiviert."
    recipient={recipient}
  >
    <p style={{ margin: 0 }}>
      Willkommen bei Studienbuch! Bestätige deine E-Mail-Adresse über den Button unten, um
      weiterzumachen.
    </p>
  </AuthEmail>
);
