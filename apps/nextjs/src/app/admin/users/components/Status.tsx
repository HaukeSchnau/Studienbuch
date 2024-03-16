import type { User } from "../user.type";

export const Status = ({ user }: { user: User }) => {
  return (
    <div className="p-2">
      {(!user.hasPassword || !user.email) && "Kein Zugang"}
    </div>
  );
};
