import { IconButton } from "~/components/form/IconButton";
import { User } from "../user.type";

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
