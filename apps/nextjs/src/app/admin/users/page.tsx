"use client";

import { useCallback, useState } from "react";
import { useImmer } from "use-immer";

import type { User } from "@schnau/lib/src/users/user";

import { Button } from "~/components/form/Button";
import { Card } from "~/components/layout/Card";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { PageHeading } from "~/components/layout/PageHeading";
import { api } from "~/infrastructure/trpc/react";
import { UsersTable } from "./components/UsersTable";

export default function UsersPage() {
  const { data: users, isPending, isError, error } = api.users.list.useQuery();

  return isPending ? (
    <LoadingIndicator />
  ) : isError ? (
    <div>{error.message}</div>
  ) : (
    <UsersPageContent initialUsers={users} />
  );
}

const UsersPageContent = ({ initialUsers }: { initialUsers: User[] }) => {
  const utils = api.useUtils();
  const [users, setUsers] = useImmer<User[]>(initialUsers);
  const [updates, setUpdates] = useState(new Map<number, Partial<User>>());

  const updateUsersMutation = api.users.updateMany.useMutation({
    onSuccess: () => {
      setUpdates(new Map());
      void utils.users.list.invalidate();
    },
  });

  const updateRow = useCallback(
    (rowIndex: number, update: Pick<User, "id"> & Partial<User>) => {
      setUpdates((updates) => {
        updates.set(update.id, { ...updates.get(update.id), ...update });
        return updates;
      });

      setUsers((users) => {
        users[rowIndex] = { ...users[rowIndex]!, ...update };
      });
    },
    [setUsers],
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <PageHeading color="white">Nutzer</PageHeading>
        {updates.size > 0 && (
          <Button
            onClick={() => {
              updateUsersMutation.mutate(
                [...updates.entries()].map(([id, update]) => ({
                  id,
                  ...update,
                })),
              );
            }}
          >
            Speichern
          </Button>
        )}
      </div>

      <Card noPadding className="overflow-hidden">
        <UsersTable users={users} updateRow={updateRow} updates={updates} />
      </Card>
    </div>
  );
};
