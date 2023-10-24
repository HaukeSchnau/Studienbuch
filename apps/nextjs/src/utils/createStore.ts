import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export const createStore = (initializer: Parameters<typeof immer>) =>
  create(immer(...initializer));
