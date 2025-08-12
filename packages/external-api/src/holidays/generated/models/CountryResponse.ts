/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LocalizedText } from "./LocalizedText";
/**
 * Representation of a country as defined in ISO 3166-1
 */
export type CountryResponse = {
  /**
   * ISO 3166-1 country code
   */
  isoCode: string;
  /**
   * Localized country names
   */
  name: Array<LocalizedText>;
  /**
   * Official ISO-639-1 language codes
   */
  officialLanguages: Array<string>;
};
