import { formalName } from "@stu/lib";

import type { User } from "../user.type";
import { Button } from "~/components/form/Button";
import { api } from "~/infrastructure/trpc/react";

interface Props {
  user: User;
  onClose: () => void;
}

export const DeleteUserModalContent = ({ user, onClose }: Props) => {
  const utils = api.useUtils();
  const deleteUserMutation = api.management.users.delete.useMutation({
    onSuccess: () => {
      onClose();
      void utils.management.users.list.invalidate();
    },
  });

  return (
    <div>
      <h2 className="text-xl font-bold text-primary-text">Nutzer löschen</h2>
      <p>
        Möchtest du <strong>{formalName(user.person)}</strong> wirklich löschen?
      </p>
      {deleteUserMutation.isError && (
        <div className="text-danger">{deleteUserMutation.error.message}</div>
      )}
      <div className="flex justify-end gap-4 pt-8">
        <Button variant="secondary" onClick={onClose}>
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
  );
};
