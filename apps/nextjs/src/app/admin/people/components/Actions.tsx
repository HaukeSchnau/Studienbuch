import type { Person } from "../user.type";
import { IconButton } from "~/components/form/IconButton";

interface Props {
  user: Person;
  onClickDelete: (user: Person) => void;
}

export const Actions = ({ user, onClickDelete }: Props) => {
  return (
    <div className="flex w-full items-center justify-between">
      <IconButton icon="delete" onClick={() => onClickDelete(user)} />
    </div>
  );
};
