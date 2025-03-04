import type { SchoolId, StateCode } from "./schools";

export type Entity =
  | {
      type: "school";
      id: SchoolId;
    }
  | {
      type: "holiday";
      state: StateCode;
      year: number;
    }
  | {
      type: "year";
      school: SchoolId;
      startYear: number;
    }
  | {
      type: "class";
      school: SchoolId;
      startYear: number;
      identifier: string;
    }
  | {
      type: "course";
      id: string;
    }
  | {
      type: "person";
      id: string;
    }
  | {
      type: "license";
      key: string;
    };

export type EntityType = Entity["type"];

/*
    WHAT DO WE WANT FOR THE QUERY?
    - no events that the user has already received
    - 
*/
