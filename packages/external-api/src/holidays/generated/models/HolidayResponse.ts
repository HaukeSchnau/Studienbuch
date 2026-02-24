/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* oxlint-disable */
import type { HolidayType } from "./HolidayType";
import type { LocalizedText } from "./LocalizedText";
import type { RegionalScope } from "./RegionalScope";
import type { SubdivisionReference } from "./SubdivisionReference";
import type { TemporalScope } from "./TemporalScope";
/**
 * Representation of a holiday
 */
export type HolidayResponse = {
  /**
   * Additional localized comments
   */
  comment?: Array<LocalizedText> | null;
  /**
   * End date of the holiday
   */
  endDate: string;
  /**
   * Unqiue holiday id
   */
  id: string;
  /**
   * Localized names of the holiday
   */
  name: Array<LocalizedText>;
  /**
   * Is the holiday nationwide?
   */
  nationwide: boolean;
  regionalScope?: RegionalScope;
  /**
   * Start date of the holiday
   */
  startDate: string;
  /**
   * List of subdivision references
   */
  subdivisions: Array<SubdivisionReference>;
  temporalScope?: TemporalScope;
  type: HolidayType;
};
