import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import localFont from "next/font/local";

import "./globals.css";

import type { ReactNode } from "react";
import { AxiomWebVitals } from "next-axiom";

import { Theme } from "~/components/Theme";
import { env } from "~/env";
import { TRPCReactProvider } from "~/infrastructure/trpc/react";

const fontSans = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

const materialIcons = localFont({
  src: "./MaterialSymbolsRounded.woff2",
  variable: "--font-material-icons",
  display: "block",
  style: "normal",
  weight: "300",
  adjustFontFallback: false,
  fallback: [],
});

const getTitle = () => {
  switch (env.DEPLOYMENT_ENV) {
    case "dev":
      return "(DEV) Das Studienbuch";
    case "beta":
      return "(BETA) Das Studienbuch";
    case "prod":
      return "Das Studienbuch";
  }
};

export const metadata: Metadata = {
  metadataBase: new URL(env.BASE_URL),
  title: getTitle(),
  description: "Das Studienbuch der IGS Lilienthal",
  applicationName: "Das Studienbuch",
  authors: [{ name: "Hauke Schnau", url: "https://haukeschnau.de" }],
  creator: "Hauke Schnau",
  publisher: "Hauke Schnau",
  openGraph: {
    title: "Das Studienbuch",
    description: "Das Studienbuch der IGS Lilienthal",
    url: "https://studienbuch.app",
    siteName: "Das Studienbuch",
    type: "website",
  },
  appLinks: {
    ios: {
      url: "https://apps.apple.com/de/app/igs-lilienthal/id6449227364",
      app_name: "IGS Lilienthal",
      app_store_id: "6449227364",
    },
    android: {
      package: "de.haukeschnau.class_mate",
      app_name: "IGS Lilienthal",
      url: "https://play.google.com/store/apps/details?id=de.haukeschnau.class_mate",
    },
  },
  keywords: [
    "Studienbuch",
    "IGS Lilienthal",
    "Lilienthal",
    "Schule",
    "Digitales Studienbuch",
  ],
};

export const viewport: Viewport = {
  themeColor: "#34A32C",
};

export default function Layout(props: { children: ReactNode }) {
  return (
    <html lang="de">
      <AxiomWebVitals />

      <body
        className={[
          "font-sans",
          fontSans.variable,
          materialIcons.variable,
        ].join(" ")}
      >
        <TRPCReactProvider>
          <Theme />
          {props.children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
