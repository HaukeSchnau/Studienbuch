"use client";

import type { ReactNode } from "react";

import { useSelectedYear } from "~/features/yearSelect/selectedYearStore";

export const YearNav = ({ children }: { children: ReactNode }) => {
  const { selectedYear } = useSelectedYear();

  if (!selectedYear) {
    return null;
  }

  return children;
};
