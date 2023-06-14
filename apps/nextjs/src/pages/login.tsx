import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import Head from "next/head";
import { getCsrfToken } from "next-auth/react";
import { useForm, type SubmitHandler } from "react-hook-form";

import { Button } from "~/components/Button";
import { Card, CardHeading } from "~/components/Card";
import { TextField } from "~/components/TextField";

type Inputs = {
  email: string;
};

export default function Login({
  csrfToken,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>();
  const onSubmit: SubmitHandler<Inputs> = async ({ email }) => {
    const response = await fetch("/api/auth/signin/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, csrfToken }),
    });

    if (response.status === 200) {
      alert("Du hast eine E-Mail mit einem Link zum Einloggen erhalten.");
    }

    if (response.status === 403) {
      alert("Du hast keine Berechtigung, dich einzuloggen.");
    }
  };

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
          <form onSubmit={handleSubmit(onSubmit)}>
            <TextField
              label="E-Mail-Adresse"
              error={errors.email?.message}
              {...register("email")}
              type="email"
              required
            />
            <Button type="submit">Einloggen</Button>
          </form>
        </Card>
      </div>
    </div>
    // <form method="post" action="/api/auth/signin/email">
    //   <input name="csrfToken" type="hidden" defaultValue={csrfToken} />
    //   <label>
    //     Email address
    //     <input type="email" id="email" name="email" />
    //   </label>
    //   <button type="submit">Sign in with Email</button>
    // </form>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const csrfToken = await getCsrfToken(context);
  return {
    props: { csrfToken },
  };
}
