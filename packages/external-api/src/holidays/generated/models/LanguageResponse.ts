/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* oxlint-disable */
import type { LocalizedText } from "./LocalizedText";
/**
 * Representation of a language as defined in ISO-639-1
 */
export type LanguageResponse = {
  /**
   * ISO-639-1 language code
   */
  isoCode: string;
  /**
   * Localized language names
   */
  name: Array<LocalizedText>;
};
