import type { Theme } from "./theme";
import { defaultTheme } from "./theme";

export interface School {
  id: SchoolId;
  name: string;
}

export const SCHOOL_IDS = ["igs-lil"] as const;
export type SchoolId = (typeof SCHOOL_IDS)[number];

export const STATE_CODES = [
  "BB",
  "BE",
  "BW",
  "BY",
  "HB",
  "HE",
  "HH",
  "MV",
  "NI",
  "NW",
  "RP",
  "SH",
  "SL",
  "SN",
  "ST",
  "TH",
] as const;
export type StateCode = (typeof STATE_CODES)[number];

export const SEMESTER_TYPES = ["SUMMER", "WINTER"] as const;

export const defaultSchools: Record<
  SchoolId,
  {
    name: string;
    image: string;
    founded: Date;
    theme: Theme;
    stateCode: StateCode;
  }
> = {
  "igs-lil": {
    name: "IGS Lilienthal",
    image: "",
    founded: new Date("2012-09-01"),
    theme: defaultTheme,
    stateCode: "NI",
  },
};
