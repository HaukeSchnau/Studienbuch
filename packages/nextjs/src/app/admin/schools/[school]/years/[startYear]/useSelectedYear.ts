import { SCHOOL_IDS } from "@stu/lib";
import { skipToken } from "@tanstack/react-query";
import { z } from "zod";

import { useSafeParams } from "~/infrastructure/hooks/useSafeParams";
import { api } from "~/infrastructure/trpc/react";

export const useSelectedYear = () => {
  const params = useSafeParams(z.object({ school: z.enum(SCHOOL_IDS), startYear: z.coerce.number() }));
  const year = api.schools.years.getOne.useQuery(
    params.school && params.startYear
      ? {
          school: params.school,
          startYear: params.startYear,
        }
      : skipToken,
  );

  return {
    selectedYear: year.data,
  };
};
