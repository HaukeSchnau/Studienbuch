import { IconButton } from "~/components/form/IconButton";
import type { User } from "../user.type";

interface Props {
  user: User;
  onClickChangePassword: (user: User) => void;
  onClickPermissions: (user: User) => void;
  onClickDelete: (user: User) => void;
}

export const Actions = ({
  user,
  onClickChangePassword,
  onClickPermissions,
  onClickDelete,
}: Props) => {
  return (
    <div className="flex w-full items-center justify-between">
      <IconButton icon="key" onClick={() => onClickChangePassword(user)} />
      <IconButton icon="shield" onClick={() => onClickPermissions(user)} />
      <IconButton icon="delete" onClick={() => onClickDelete(user)} />
    </div>
  );
};
