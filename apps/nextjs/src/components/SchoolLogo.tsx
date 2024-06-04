"use client";

import { z } from "zod";

import { useSafeParams } from "~/infrastructure/hooks/useSafeParams";
import { api } from "~/infrastructure/trpc/react";

export const SchoolLogo = () => {
  const { school } = useSafeParams(z.object({ school: z.coerce.number() }));
  const query = api.schools.getTheme.useQuery(school ?? -1, {
    enabled: school !== undefined,
  });

  if (!query.data?.image) {
    return (
      <img
        src="/assets/stu-logo.png"
        className="rounded-full"
        alt="Schullogo"
      />
    );
  }

  return (
    <img src={query.data?.image} className="rounded-full" alt="Schullogo" />
  );
};
