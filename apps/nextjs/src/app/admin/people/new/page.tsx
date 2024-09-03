"use client";

import { useRouter } from "next/navigation";

import { Card } from "~/components/layout/Card";
import { PageHeading } from "~/components/layout/PageHeading";
import { api } from "~/infrastructure/trpc/react";
import { UserForm } from "./components/UserForm";

export default function NewUserPage() {
  const router = useRouter();

  const utils = api.useUtils();
  const addUser = api.users.add.useMutation({
    onSuccess: () => {
      void utils.users.list.invalidate();
      router.push("/admin/users");
    },
  });

  return (
    <div>
      <PageHeading color="white">Neuer Jahrgang</PageHeading>

      <div className="h-4" />

      <Card>
        <UserForm
          onSubmit={({ value }) => {
            addUser.mutate({
              name: value.name,
              email: value.email,
              password: value.password,
              salutation: value.title,
              abbrv: value.abbrv,
            });
          }}
          isPending={addUser.isPending}
          error={addUser.error?.message}
        />
      </Card>
    </div>
  );
}
