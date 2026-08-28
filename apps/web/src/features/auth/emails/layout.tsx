import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/*
 * Emails render from inline styles, not from the app's Tailwind theme, so the brand tokens from
 * `src/styles.css` are mirrored here. Keep the values in step when a colour changes.
 */
const color = {
  background: "#eef5ed",
  card: "#ffffff",
  ink: "#203755",
  inkSoft: "#5b6b80",
  primaryText: "#098a00",
  accent: "#3b7fd9",
  accentSec: "#4d75a8",
  divider: "#e5e5e5",
} as const;

const fontFamily = '"Nunito Variable", Nunito, "Avenir Next", Avenir, "Segoe UI", sans-serif';

/**
 * The app icon as the recipient's mail client can load it: from the deployed web app. The
 * bare `studienbuch.app` still serves the legacy Flutter shell, which has no `/brand` assets.
 */
const iconUrl = "https://beta.studienbuch.app/brand/icon-512.png";

const body = {
  fontFamily,
  fontSize: 15,
  lineHeight: "26px",
  color: color.ink,
} as const;

const button = {
  fontFamily,
  fontSize: 16,
  fontWeight: 700,
  color: "#ffffff",
  backgroundColor: color.accent,
  borderRadius: 9999,
  padding: "13px 30px",
  textDecoration: "none",
  display: "inline-block",
} as const;

const fallbackLink = {
  fontFamily,
  fontSize: 13,
  lineHeight: "20px",
  color: color.accent,
  wordBreak: "break-all" as const,
} as const;

const note = {
  fontFamily,
  fontSize: 13,
  lineHeight: "21px",
  color: color.inkSoft,
  margin: 0,
} as const;

const footerText = {
  fontFamily,
  fontSize: 12,
  lineHeight: "19px",
  color: color.inkSoft,
  margin: "0 0 6px",
} as const;

const footerLink = {
  fontFamily,
  fontSize: 12,
  color: color.inkSoft,
  textDecoration: "underline",
} as const;

export type AuthEmailProps = {
  /** Inbox snippet line, shown after the subject in mail clients. */
  readonly preview: string;
  readonly heading: string;
  /** The body copy between heading and call to action. */
  readonly children: ReactNode;
  readonly cta: { readonly label: string; readonly url: string };
  /** Validity and "was not you" line under the fallback link. */
  readonly note: string;
  readonly recipient: string;
};

/**
 * The frame every account email sits in, shaped after the auth screens: the wordmark on the pale
 * green ground, a white card, one centred call to action.
 */
export const AuthEmail = ({
  preview,
  heading,
  children,
  cta,
  note: noteText,
  recipient,
}: AuthEmailProps) => (
  <Html lang="de">
    <Head>
      <Font
        fontFamily='"Nunito Variable"'
        fallbackFontFamily={["Verdana", "sans-serif"]}
        webFont={{
          url: "https://fonts.gstatic.com/s/nunito/v32/XRXV3I6Li01BKof4N-yGbss.woff2",
          format: "woff2",
        }}
        fontWeight={400}
      />
    </Head>
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: color.background, margin: 0, padding: "32px 12px" }}>
      <Container
        style={{
          maxWidth: 480,
          backgroundColor: color.card,
          borderRadius: 24,
          border: "1px solid rgba(32, 55, 85, 0.08)",
          padding: "40px 32px 32px",
        }}
      >
        <Section style={{ textAlign: "center" }}>
          <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: "0 auto" }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign: "middle", paddingRight: 10 }}>
                  <Img
                    alt=""
                    height={44}
                    src={iconUrl}
                    style={{ borderRadius: 11, display: "block" }}
                    width={44}
                  />
                </td>
                <td
                  style={{
                    fontFamily,
                    fontSize: 20,
                    fontWeight: 700,
                    color: color.primaryText,
                    verticalAlign: "middle",
                  }}
                >
                  Studienbuch
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
        <Section style={{ marginTop: 28 }}>
          <Text
            style={{
              fontFamily,
              fontSize: 23,
              fontWeight: 700,
              lineHeight: "30px",
              color: color.primaryText,
              textAlign: "center",
              margin: "0 0 20px",
            }}
          >
            {heading}
          </Text>
          <div style={body}>{children}</div>
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button href={cta.url} style={button}>
              {cta.label}
            </Button>
          </Section>
          <Text style={{ ...note, marginBottom: 8 }}>
            Falls der Button bei dir nicht funktioniert, öffne diesen Link:
          </Text>
          <Link href={cta.url} style={fallbackLink}>
            {cta.url}
          </Link>
          <Text style={{ ...note, marginTop: 20 }}>{noteText}</Text>
        </Section>
      </Container>
      <Container
        style={{ maxWidth: 480, margin: "0 auto", padding: "20px 8px 0", textAlign: "center" }}
      >
        <Text style={footerText}>
          <Link href="https://studienbuch.app/impressum" style={footerLink}>
            Impressum
          </Link>
          {" · "}
          <Link href="https://studienbuch.app/datenschutz" style={footerLink}>
            Datenschutz
          </Link>
        </Text>
        <Text style={{ ...footerText, margin: 0 }}>
          Diese E-Mail wurde an {recipient} gesendet.
        </Text>
      </Container>
    </Body>
  </Html>
);
