import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardHeading } from "~/components/layout/Card";
import { isLoggedIn } from "~/features/auth/isLoggedIn";
import { LoginForm } from "~/features/auth/LoginForm";

export const metadata: Metadata = {
  title: "Anmelden | Digitales Studienbuch",
};

export default async function LoginPage() {
  if (await isLoggedIn()) {
    return redirect("/");
  }

  return (
    <div>
      <svg className="absolute h-full w-full">
        <circle cx="0" cy="2%" r="20%" opacity=".5" className="fill-accent" />
        <circle cx="100%" cy="50%" r="15%" opacity=".5" className="fill-primary" />
        <circle cx="0" cy="80%" r="10%" opacity=".5" className="fill-danger" />
      </svg>
      <div className="relative z-10 flex h-screen flex-col items-center justify-center">
        <div className="my-8 rounded-full bg-accent p-4">
          <img src="/assets/logo.svg" alt="IGS Lilienthal Logo" />
        </div>
        <Card className="w-[min(100%,24rem)]">
          <CardHeading>Anmelden</CardHeading>
          <LoginForm />
        </Card>
      </div>
    </div>
  );
}
