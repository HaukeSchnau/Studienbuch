/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CancelablePromise } from "../core/CancelablePromise";
import { OpenAPI } from "../core/OpenAPI";
import { request as __request } from "../core/request";
import type { HolidayByDateResponse } from "../models/HolidayByDateResponse";
import type { HolidayResponse } from "../models/HolidayResponse";
export class HolidaysService {
  /**
   * Returns list of public holidays for a given country
   * @param countryIsoCode ISO 3166-1 code of the country
   * @param validFrom Start of the date range
   * @param validTo End of the date range
   * @param languageIsoCode ISO-639-1 code of a language or empty
   * @param subdivisionCode Code of the subdivision or empty
   * @returns HolidayResponse OK
   * @throws ApiError
   */
  public static getPublicHolidays(
    countryIsoCode: string,
    validFrom: string,
    validTo: string,
    languageIsoCode?: string,
    subdivisionCode?: string,
  ): CancelablePromise<Array<HolidayResponse>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/PublicHolidays",
      query: {
        countryIsoCode: countryIsoCode,
        validFrom: validFrom,
        validTo: validTo,
        languageIsoCode: languageIsoCode,
        subdivisionCode: subdivisionCode,
      },
      errors: {
        400: "Bad Request",
        500: "Internal Server Error",
      },
    });
  }
  /**
   * Returns a list of public holidays from all countries for a given date.
   * @param date Date of interest
   * @param languageIsoCode ISO-639-1 code of a language or empty
   * @returns HolidayByDateResponse OK
   * @throws ApiError
   */
  public static getPublicHolidaysByDate(
    date: string,
    languageIsoCode?: string,
  ): CancelablePromise<Array<HolidayByDateResponse>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/PublicHolidaysByDate",
      query: {
        date: date,
        languageIsoCode: languageIsoCode,
      },
      errors: {
        400: "Bad Request",
        500: "Internal Server Error",
      },
    });
  }
  /**
   * Returns list of official school holidays for a given country
   * @param countryIsoCode ISO 3166-1 code of the country
   * @param validFrom Start of the date range
   * @param validTo End of the date range
   * @param languageIsoCode ISO-639-1 code of a language or empty
   * @param subdivisionCode Code of the subdivision or empty
   * @returns HolidayResponse OK
   * @throws ApiError
   */
  public static getSchoolHolidays(
    countryIsoCode: string,
    validFrom: string,
    validTo: string,
    languageIsoCode?: string,
    subdivisionCode?: string,
  ): CancelablePromise<Array<HolidayResponse>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/SchoolHolidays",
      query: {
        countryIsoCode: countryIsoCode,
        validFrom: validFrom,
        validTo: validTo,
        languageIsoCode: languageIsoCode,
        subdivisionCode: subdivisionCode,
      },
      errors: {
        400: "Bad Request",
        500: "Internal Server Error",
      },
    });
  }
  /**
   * Returns a list of school holidays from all countries for a given date.
   * @param date Date of interest
   * @param languageIsoCode ISO-639-1 code of a language or empty
   * @returns HolidayByDateResponse OK
   * @throws ApiError
   */
  public static getSchoolHolidaysByDate(
    date: string,
    languageIsoCode?: string,
  ): CancelablePromise<Array<HolidayByDateResponse>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/SchoolHolidaysByDate",
      query: {
        date: date,
        languageIsoCode: languageIsoCode,
      },
      errors: {
        400: "Bad Request",
        500: "Internal Server Error",
      },
    });
  }
}
