import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { Year } from "@acme/db";

interface SelectedYearState {
  selectedYear: Omit<Year, "createdAt"> | null;
  setSelectedYear: (year: Omit<Year, "createdAt">) => void;
}

export const useSelectedYear = create(
  immer<SelectedYearState>((set) => ({
    selectedYear: null,
    setSelectedYear: (year) => {
      set((state) => {
        state.selectedYear = year;
      });
    },
  })),
);
