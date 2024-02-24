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
  metadataBase: new URL(
    env.VERCEL_ENV === "production"
      ? "https://studienbuch.app"
      : "http://localhost:3000",
  ),
  title: "Das Studienbuch",
  description: "Das Studienbuch der IGS Lilienthal",
  openGraph: {
    title: "Das Studienbuch",
    description: "Das Studienbuch der IGS Lilienthal",
    url: "https://studienbuch.app",
    siteName: "Das Studienbuch",
  },
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
