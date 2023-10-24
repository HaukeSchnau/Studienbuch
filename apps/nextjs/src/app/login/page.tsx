import Head from "next/head";
import { redirect } from "next/navigation";

import { Card, CardHeading } from "~/components/Card";
import { isLoggedIn } from "~/features/auth/isLoggedIn";
import { LoginForm } from "~/features/auth/LoginForm";

export default function LoginPage() {
  if (isLoggedIn()) {
    return redirect("/");
  }

  return (
    <div>
      <Head>
        <title>Anmelden | Digitales Studienbuch</title>
      </Head>
      <svg className="absolute h-full w-full">
        <circle cx="0" cy="2%" r="20%" opacity=".5" className="fill-blue" />
        <circle
          cx="100%"
          cy="50%"
          r="15%"
          opacity=".5"
          className="fill-green"
        />
        <circle cx="0" cy="80%" r="10%" opacity=".5" className="fill-red" />
      </svg>
      <div className="absolute flex h-screen w-full flex-col items-center justify-center">
        <div className="bg-blue my-8 rounded-full p-4">
          <img src="/assets/logo.svg" alt="IGS Lilienthal Logo" />
        </div>
        <Card>
          <CardHeading>Anmelden</CardHeading>
          <div className="flex max-w-md">
            <LoginForm />
          </div>
        </Card>
      </div>
    </div>
  );
}
