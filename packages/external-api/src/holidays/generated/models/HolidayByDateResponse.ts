/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CountryReference } from "./CountryReference";
import type { HolidayType } from "./HolidayType";
import type { LocalizedText } from "./LocalizedText";
import type { RegionalScope } from "./RegionalScope";
import type { SubdivisionReference } from "./SubdivisionReference";
import type { TemporalScope } from "./TemporalScope";
/**
 * Representation of a holiday by date
 */
export type HolidayByDateResponse = {
  /**
   * Additional localized comments
   */
  comment?: Array<LocalizedText> | null;
  country: CountryReference;
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
   * List of subdivision references
   */
  subdivisions: Array<SubdivisionReference>;
  temporalScope?: TemporalScope;
  type: HolidayType;
};
