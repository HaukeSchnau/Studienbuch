"use client";

import { useCallback, useEffect, useState } from "react";
import { useImmer } from "use-immer";

import { formalName } from "@schnau/lib/src/users/teacher";

import type { User } from "./user.type";
import { Button } from "~/components/form/Button";
import { Card } from "~/components/layout/Card";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { ModalWithData } from "~/components/layout/Modal";
import { PageHeading } from "~/components/layout/PageHeading";
import { api } from "~/infrastructure/trpc/react";
import { ChangePasswordModalContent } from "./components/NewPasswordModalContent";
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

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const [deleteModalUser, setDeleteModalUser] = useState<User | null>(null);
  const [changePasswordModalUser, setChangePasswordModalUser] =
    useState<User | null>(null);

  const updateUsersMutation = api.users.updateMany.useMutation({
    onSuccess: () => {
      setUpdates(new Map());
      void utils.users.list.invalidate();
    },
  });

  const deleteUserMutation = api.users.delete.useMutation({
    onSuccess: () => {
      closeDeleteModal();
      void utils.users.list.invalidate();
    },
  });

  const closeDeleteModal = () => {
    deleteUserMutation.reset();
    setDeleteModalUser(null);
  };

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
        <div className="flex gap-4">
          {updates.size > 0 && (
            <Button
              variant="yellow"
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
        <UsersTable
          users={users}
          updateRow={updateRow}
          updates={updates}
          onClickChangePassword={setChangePasswordModalUser}
          onClickDelete={setDeleteModalUser}
        />
      </Card>

      <ModalWithData
        data={changePasswordModalUser}
        onClose={() => setChangePasswordModalUser(null)}
      >
        {(user) => (
          <ChangePasswordModalContent
            user={user}
            onClose={() => setChangePasswordModalUser(null)}
          />
        )}
      </ModalWithData>

      <ModalWithData data={deleteModalUser} onClose={closeDeleteModal}>
        {(user) => (
          <div>
            <h2 className="text-xl font-bold text-green-text">
              Nutzer löschen
            </h2>
            <p>
              Möchtest du <strong>{formalName(user)}</strong> wirklich löschen?
            </p>
            {deleteUserMutation.isError && (
              <div className="text-red">{deleteUserMutation.error.message}</div>
            )}
            <div className="flex justify-end gap-4 pt-8">
              <Button variant="secondary" onClick={closeDeleteModal}>
                Abbrechen
              </Button>
              <Button
                variant="danger"
                disabled={deleteUserMutation.isPending}
                onClick={() => {
                  deleteUserMutation.mutate(user.id);
                }}
              >
                Löschen
              </Button>
            </div>
          </div>
        )}
      </ModalWithData>
    </div>
  );
};
