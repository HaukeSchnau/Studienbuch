import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { Year } from "@schnau/lib/src/year";

interface SelectedYearState {
  selectedYear: Year | undefined;
  setSelectedYear: (year: Year | undefined) => void;
}

export const useSelectedYear = create(
  immer<SelectedYearState>((set) => ({
    selectedYear: undefined,
    setSelectedYear: (year) => {
      set((state) => {
        state.selectedYear = year;
      });
    },
  })),
);
