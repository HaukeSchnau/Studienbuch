import type { User } from "../user.type";
import { IconButton } from "~/components/form/IconButton";

interface Props {
  user: User;
  onClickChangePassword: (user: User) => void;
  onClickDelete: (user: User) => void;
}

export const Actions = ({
  user,
  onClickChangePassword,
  onClickDelete,
}: Props) => {
  return (
    <div className="flex w-full items-center justify-between">
      <IconButton icon="key" onClick={() => onClickChangePassword(user)} />
      <IconButton icon="delete" onClick={() => onClickDelete(user)} />
    </div>
  );
};
