"use client";

import { SCHOOL_IDS } from "@stu/lib";
import { skipToken } from "@tanstack/react-query";
import { z } from "zod";

import { useSafeParams } from "~/infrastructure/hooks/useSafeParams";
import { api } from "~/infrastructure/trpc/react";

export const SchoolLogo = () => {
  const { school } = useSafeParams(z.object({ school: z.enum(SCHOOL_IDS) }));
  const query = api.schools.getTheme.useQuery(school ? school : skipToken);

  if (!query.data?.image) {
    return <img src="/assets/stu-logo.png" className="rounded-full" alt="Studienbuch" />;
  }

  return <img src={query.data.image} className="rounded-full" alt="Schullogo" />;
};
