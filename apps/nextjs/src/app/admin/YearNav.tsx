"use client";

import { NavigationItem } from "~/components/layout/nav/NavigationItem";
import { useSelectedYear } from "~/features/yearSelect/selectedYearStore";

export const YearNav = () => {
  const { selectedYear } = useSelectedYear();

  if (!selectedYear) {
    return null;
  }

  return (
    <>
      <NavigationItem href="/admin/classes">Klassen</NavigationItem>
      <NavigationItem href="/admin/courses">Kurse</NavigationItem>
      <NavigationItem href="/admin/schedules">Stundenpläne</NavigationItem>
    </>
  );
};
