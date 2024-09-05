"use client";

import { useCallback, useEffect, useState } from "react";
import { useImmer } from "use-immer";

import type { User } from "./user.type";
import { Button } from "~/components/form/Button";
import { Card } from "~/components/layout/Card";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { ModalWithData } from "~/components/layout/Modal";
import { PageHeading } from "~/components/layout/PageHeading";
import { api } from "~/infrastructure/trpc/react";
import { DeleteUserModalContent } from "./components/DeleteUserModalContent";
import { ChangePasswordModalContent } from "./components/NewPasswordModalContent";
import { PermissionsModalContent } from "./components/PermissionsModalContent";
import { UsersTable } from "./components/UsersTable";

export default function UsersPage() {
  const {
    data: users,
    isPending,
    isError,
    error,
  } = api.management.users.list.useQuery();

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
  const [updates, setUpdates] = useState(new Map<string, Partial<User>>());

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers, setUsers]);

  const [deleteModalUser, setDeleteModalUser] = useState<User | null>(null);
  const [permissionsModalUser, setPermissionsModalUser] = useState<User | null>(
    null,
  );
  const [changePasswordModalUser, setChangePasswordModalUser] =
    useState<User | null>(null);

  const updateUsersMutation = api.management.users.updateMany.useMutation({
    onSuccess: () => {
      setUpdates(new Map<string, Partial<User>>());
      void utils.management.users.list.invalidate();
    },
  });

  const { reset: resetDeleteMutation } =
    api.management.users.delete.useMutation();

  const closeDeleteModal = () => {
    resetDeleteMutation();
    setDeleteModalUser(null);
  };

  const updateRow = useCallback(
    (rowIndex: number, update: Pick<User, "id"> & Partial<User>) => {
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
                // updateUsersMutation.mutate(
                //   [...updates.entries()].map(([id, update]) => ({
                //     id,
                //     ...update,
                //   })),
                // );
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
          onClickPermissions={setPermissionsModalUser}
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
          <DeleteUserModalContent user={user} onClose={closeDeleteModal} />
        )}
      </ModalWithData>

      <ModalWithData
        data={permissionsModalUser}
        onClose={() => setPermissionsModalUser(null)}
      >
        {(user) => (
          <PermissionsModalContent
            user={user}
            onClose={() => setPermissionsModalUser(null)}
          />
        )}
      </ModalWithData>
    </div>
  );
};
