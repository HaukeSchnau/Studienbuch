import { useSession } from "next-auth/react";

import { api } from "~/utils/api";

export default function SchedulesPage() {
  //   const years = api.years.get.useQuery();

  //   console.log(years.error);

  return <h1 className="text-5xl font-semibold text-white ">Stundenpläne</h1>;
}
