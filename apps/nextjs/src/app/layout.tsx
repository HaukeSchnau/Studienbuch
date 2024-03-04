import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";

import "~/styles/globals.css";

import { env } from "~/env";
import { TRPCReactProvider } from "~/infrastructure/trpc/react";

const fontSans = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.BASE_URL),
  title: "Das Studienbuch",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function Layout(props: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={["font-sans", fontSans.variable].join(" ")}>
        <TRPCReactProvider>{props.children}</TRPCReactProvider>
      </body>
    </html>
  );
}
