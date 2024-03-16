import type { User } from "../user.type";
import { IconButton } from "~/components/form/IconButton";

interface Props {
  user: User;
  onClickChangePassword: (user: User) => void;
}

export const Actions = ({ user, onClickChangePassword }: Props) => {
  return (
    <div className="flex gap-1">
      <IconButton icon="key" onClick={() => onClickChangePassword(user)} />
    </div>
  );
};
