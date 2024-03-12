import { api } from "~/infrastructure/trpc/react";

interface Props {
  yearId: number;
}

export const ClassList = ({ yearId }: Props) => {
  const courses = api.courses.list.useQuery({ yearId });

};
