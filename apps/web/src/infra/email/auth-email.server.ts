import { readFile } from "node:fs/promises";
import nodemailer from "nodemailer";

type AuthEmail = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

const readSmtpUrl = async () => {
  const directValue = process.env.STUDIENBUCH_SMTP_URL?.trim();
  if (directValue !== undefined && directValue !== "") return directValue;

  const file = process.env.STUDIENBUCH_SMTP_URL_FILE?.trim();
  if (file === undefined || file === "") return undefined;
  const fileValue = (await readFile(file, "utf8")).trim();
  return fileValue === "" ? undefined : fileValue;
};

const deliver = async (email: AuthEmail) => {
  const mode = process.env.STUDIENBUCH_AUTH_EMAIL_MODE?.trim();
  const useConsole =
    mode === "console" || (mode === undefined && process.env.NODE_ENV !== "production");
  if (useConsole) {
    console.info(`[auth-email] To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}`);
    return;
  }

  const smtpUrl = await readSmtpUrl();
  const from = process.env.STUDIENBUCH_EMAIL_FROM?.trim();
  if (smtpUrl === undefined || smtpUrl === "" || from === undefined || from === "") {
    // oxlint-disable-next-line anti-slop/no-throwing-errors -- Nodemailer's callback contract reports delivery failure by rejecting its promise.
    throw new Error(
      "STUDIENBUCH_SMTP_URL or STUDIENBUCH_SMTP_URL_FILE and STUDIENBUCH_EMAIL_FROM are required to deliver auth email",
    );
  }
  transporter ??= nodemailer.createTransport(smtpUrl);
  await transporter.sendMail({ from, ...email });
};

export const sendVerificationEmail = async (data: {
  readonly user: { readonly email: string };
  readonly url: string;
}) =>
  deliver({
    to: data.user.email,
    subject: "E-Mail-Adresse für Studienbuch bestätigen",
    text: `Bestätige deine E-Mail-Adresse über diesen Link:\n\n${data.url}\n\nDer Link ist eine Stunde gültig. Wenn du dich nicht bei Studienbuch angemeldet hast, kannst du diese Nachricht ignorieren.`,
  });

export const sendPasswordResetEmail = async (data: {
  readonly user: { readonly email: string };
  readonly url: string;
}) =>
  deliver({
    to: data.user.email,
    subject: "Studienbuch-Passwort zurücksetzen",
    text: `Setze dein Studienbuch-Passwort über diesen Link zurück:\n\n${data.url}\n\nDer Link ist eine Stunde gültig. Wenn du das nicht angefordert hast, kannst du diese Nachricht ignorieren.`,
  });
