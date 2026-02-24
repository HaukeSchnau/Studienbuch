/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* oxlint-disable */
import type { LocalizedText } from "./LocalizedText";
/**
 * Representation of a subdivision
 */
export type SubdivisionResponse = {
  /**
   * Localized categories of the subdivision
   */
  category: Array<LocalizedText>;
  /**
   * Child subdivisions
   */
  children?: Array<SubdivisionResponse> | null;
  /**
   * Subdivision code
   */
  code: string;
  /**
   * Localized comments of the subdivision
   */
  comment: Array<LocalizedText>;
  /**
   * ISO 3166-2 subdivision code (if defined)
   */
  isoCode?: string | null;
  /**
   * Localized names of the subdivision
   */
  name: Array<LocalizedText>;
  /**
   * Official languages as ISO-639-1 codes
   */
  officialLanguages: Array<string>;
  /**
   * Short name for display
   */
  shortName: string;
};
