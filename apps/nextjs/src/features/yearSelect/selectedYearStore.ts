import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { Year } from "@schnau/common";

interface SelectedYearState {
  selectedYear: Year | null;
  setSelectedYear: (year: Year) => void;
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
