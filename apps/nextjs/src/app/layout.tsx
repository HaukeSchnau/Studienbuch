import type { Metadata } from "next";
import { Nunito } from "next/font/google";

import "~/styles/globals.css";

import { headers } from "next/headers";

import { TRPCReactProvider } from "./providers";

const fontSans = Nunito({
  subsets: ["latin"],
  variable: "--font-sans",
});

/**
 * Since we're passing `headers()` to the `TRPCReactProvider` we need to
 * make the entire app dynamic. You can move the `TRPCReactProvider` further
 * down the tree (e.g. /dashboard and onwards) to make part of the app statically rendered.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "urbs",
  openGraph: {
    title: "urbs",
    url: "https://urbs.vercel.app",
    siteName: "urbs",
  },
};

export default function Layout(props: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={["font-sans", fontSans.variable].join(" ")}>
        <TRPCReactProvider headers={headers()}>
          {props.children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
