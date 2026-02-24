/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* oxlint-disable */

import type { CancelablePromise } from "../core/CancelablePromise";
import { OpenAPI } from "../core/OpenAPI";
import { request as __request } from "../core/request";
import type { StatisticsResponse } from "../models/StatisticsResponse";
export class StatisticsService {
  /**
   * Returns statistical data about public holidays for a given country.
   * @param countryIsoCode ISO 3166-1 code of the country
   * @param subdivisionCode Code of the subdivision or empty
   * @returns StatisticsResponse OK
   * @throws ApiError
   */
  public static getStatisticsPublicHolidays(
    countryIsoCode: string,
    subdivisionCode?: string,
  ): CancelablePromise<Array<StatisticsResponse>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/Statistics/PublicHolidays",
      query: {
        countryIsoCode: countryIsoCode,
        subdivisionCode: subdivisionCode,
      },
      errors: {
        400: "Bad Request",
        500: "Internal Server Error",
      },
    });
  }
  /**
   * Returns statistical data about school holidays for a given country
   * @param countryIsoCode ISO 3166-1 code of the country
   * @param subdivisionCode Code of the subdivision or empty
   * @returns StatisticsResponse OK
   * @throws ApiError
   */
  public static getStatisticsSchoolHolidays(
    countryIsoCode: string,
    subdivisionCode?: string,
  ): CancelablePromise<Array<StatisticsResponse>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/Statistics/SchoolHolidays",
      query: {
        countryIsoCode: countryIsoCode,
        subdivisionCode: subdivisionCode,
      },
      errors: {
        400: "Bad Request",
        500: "Internal Server Error",
      },
    });
  }
}
