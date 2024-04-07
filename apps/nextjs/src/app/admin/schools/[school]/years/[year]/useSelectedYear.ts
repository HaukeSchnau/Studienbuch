import { z } from "zod";

import { useSafeParams } from "~/infrastructure/hooks/useSafeParams";
import { api } from "~/infrastructure/trpc/react";

export const useSelectedYear = () => {
  const params = useSafeParams(z.object({ year: z.coerce.number() }));
  const year = api.years.getOne.useQuery(params.year ?? -1, {
    enabled: params.year !== undefined,
  });

  return {
    selectedYear: year.data,
  };
};
