/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* oxlint-disable */

import type { CancelablePromise } from "../core/CancelablePromise";
import { OpenAPI } from "../core/OpenAPI";
import { request as __request } from "../core/request";
import type { CountryResponse } from "../models/CountryResponse";
import type { LanguageResponse } from "../models/LanguageResponse";
import type { SubdivisionResponse } from "../models/SubdivisionResponse";
export class RegionalService {
  /**
   * Returns a list of all supported countries
   * @param languageIsoCode ISO-639-1 code of a language or empty
   * @returns CountryResponse OK
   * @throws ApiError
   */
  public static getCountries(languageIsoCode?: string): CancelablePromise<Array<CountryResponse>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/Countries",
      query: {
        languageIsoCode: languageIsoCode,
      },
      errors: {
        400: "Bad Request",
        500: "Internal Server Error",
      },
    });
  }
  /**
   * Returns a list of all used languages
   * @param languageIsoCode ISO-639-1 code of a language or empty
   * @returns LanguageResponse OK
   * @throws ApiError
   */
  public static getLanguages(languageIsoCode?: string): CancelablePromise<Array<LanguageResponse>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/Languages",
      query: {
        languageIsoCode: languageIsoCode,
      },
      errors: {
        400: "Bad Request",
        500: "Internal Server Error",
      },
    });
  }
  /**
   * Returns a list of relevant subdivisions for a supported country (if any)
   * @param countryIsoCode ISO 3166-1 code of the country
   * @param languageIsoCode ISO-639-1 code of a language or empty
   * @returns SubdivisionResponse OK
   * @throws ApiError
   */
  public static getSubdivisions(
    countryIsoCode: string,
    languageIsoCode?: string,
  ): CancelablePromise<Array<SubdivisionResponse>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/Subdivisions",
      query: {
        countryIsoCode: countryIsoCode,
        languageIsoCode: languageIsoCode,
      },
      errors: {
        400: "Bad Request",
        500: "Internal Server Error",
      },
    });
  }
}
