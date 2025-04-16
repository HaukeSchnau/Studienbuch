"use client";

import { useCallback, useEffect, useState } from "react";
import { useImmer } from "use-immer";

import { Button } from "~/components/form/Button";
import { Card } from "~/components/layout/Card";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { ModalWithData } from "~/components/layout/Modal";
import { PageHeading } from "~/components/layout/PageHeading";
import { api } from "~/infrastructure/trpc/react";
import { DeleteUserModalContent } from "./components/DeleteUserModalContent";
import { PersonsTable } from "./components/PersonsTable";
import type { Person } from "./user.type";

export default function UsersPage() {
  const {
    data: users,
    isPending,
    isError,
    error,
  } = api.management.persons.list.useQuery();

  return isPending ? (
    <LoadingIndicator />
  ) : isError ? (
    <div>{error.message}</div>
  ) : (
    <UsersPageContent initialUsers={users} />
  );
}

const UsersPageContent = ({ initialUsers }: { initialUsers: Person[] }) => {
  const utils = api.useUtils();
  const [users, setUsers] = useImmer<Person[]>(initialUsers);
  const [updates, setUpdates] = useState(new Map<string, Partial<Person>>());

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers, setUsers]);

  const [deleteModalUser, setDeleteModalUser] = useState<Person | null>(null);

  const updateUsersMutation = api.management.persons.updateMany.useMutation({
    onSuccess: () => {
      setUpdates(new Map<string, Partial<Person>>());
      void utils.management.persons.list.invalidate();
    },
  });

  const { reset: resetDeleteMutation } =
    api.management.persons.delete.useMutation();

  const closeDeleteModal = () => {
    resetDeleteMutation();
    setDeleteModalUser(null);
  };

  const updateRow = useCallback(
    (rowIndex: number, update: Pick<Person, "id"> & Partial<Person>) => {
      setUpdates((updates) => {
        updates.set(update.id, { ...updates.get(update.id), ...update });
        return updates;
      });

      setUsers((users) => {
        const existingUser = users[rowIndex];
        if (!existingUser) {
          return;
        }
        users[rowIndex] = { ...existingUser, ...update };
      });
    },
    [setUsers],
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <PageHeading color="white">Nutzer</PageHeading>
        <div className="flex gap-4">
          {updates.size > 0 && (
            <Button
              variant="danger"
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
          <Button href="/admin/users/new">Neuer Nutzer</Button>
        </div>
      </div>

      <Card noPadding className="overflow-hidden">
        <PersonsTable
          users={users}
          updateRow={updateRow}
          updates={updates}
          onClickDelete={setDeleteModalUser}
        />
      </Card>

      <ModalWithData data={deleteModalUser} onClose={closeDeleteModal}>
        {(user) => (
          <DeleteUserModalContent user={user} onClose={closeDeleteModal} />
        )}
      </ModalWithData>
    </div>
  );
};
