/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise";
import { OpenAPI } from "../core/OpenAPI";
import { request as __request } from "../core/request";
import type { HolidayDto } from "../models/HolidayDto";

export class HolidayWsV1ImplService {
  /**
   * getHolidays
   * @returns HolidayDto OK
   * @throws ApiError
   */
  public static getHolidaysUsingGet(): CancelablePromise<Array<HolidayDto>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/holidays",
      errors: {
        401: `Unauthorized`,
        403: `Forbidden`,
        404: `Not Found`,
      },
    });
  }
  /**
   * getHolidays
   * @returns HolidayDto OK
   * @throws ApiError
   */
  public static getHolidaysUsingGet1(): CancelablePromise<Array<HolidayDto>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/holidays.json",
      errors: {
        401: `Unauthorized`,
        403: `Forbidden`,
        404: `Not Found`,
      },
    });
  }
  /**
   * getHolidaysForState
   * @param state state
   * @returns HolidayDto OK
   * @throws ApiError
   */
  public static getHolidaysForStateUsingGet(
    state:
      | "BB"
      | "BE"
      | "BW"
      | "BY"
      | "HB"
      | "HE"
      | "HH"
      | "MV"
      | "NI"
      | "NW"
      | "RP"
      | "SH"
      | "SL"
      | "SN"
      | "ST"
      | "TH",
  ): CancelablePromise<Array<HolidayDto>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/holidays/{state}",
      path: {
        state: state,
      },
      errors: {
        401: `Unauthorized`,
        403: `Forbidden`,
        404: `Not Found`,
      },
    });
  }
  /**
   * getHolidaysForState
   * @param state state
   * @returns HolidayDto OK
   * @throws ApiError
   */
  public static getHolidaysForStateUsingGet1(
    state:
      | "BB"
      | "BE"
      | "BW"
      | "BY"
      | "HB"
      | "HE"
      | "HH"
      | "MV"
      | "NI"
      | "NW"
      | "RP"
      | "SH"
      | "SL"
      | "SN"
      | "ST"
      | "TH",
  ): CancelablePromise<Array<HolidayDto>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/holidays/{state}.json",
      path: {
        state: state,
      },
      errors: {
        401: `Unauthorized`,
        403: `Forbidden`,
        404: `Not Found`,
      },
    });
  }
  /**
   * getHolidaysForStateAndYear
   * @param state state
   * @param year year
   * @returns HolidayDto OK
   * @throws ApiError
   */
  public static getHolidaysForStateAndYearUsingGet(
    state:
      | "BB"
      | "BE"
      | "BW"
      | "BY"
      | "HB"
      | "HE"
      | "HH"
      | "MV"
      | "NI"
      | "NW"
      | "RP"
      | "SH"
      | "SL"
      | "SN"
      | "ST"
      | "TH",
    year: number,
  ): CancelablePromise<Array<HolidayDto>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/holidays/{state}/{year}",
      path: {
        state: state,
        year: year,
      },
      errors: {
        401: `Unauthorized`,
        403: `Forbidden`,
        404: `Not Found`,
      },
    });
  }
  /**
   * getHolidaysForStateAndYear
   * @param state state
   * @param year year
   * @returns HolidayDto OK
   * @throws ApiError
   */
  public static getHolidaysForStateAndYearUsingGet1(
    state:
      | "BB"
      | "BE"
      | "BW"
      | "BY"
      | "HB"
      | "HE"
      | "HH"
      | "MV"
      | "NI"
      | "NW"
      | "RP"
      | "SH"
      | "SL"
      | "SN"
      | "ST"
      | "TH",
    year: number,
  ): CancelablePromise<Array<HolidayDto>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/holidays/{state}/{year}.json",
      path: {
        state: state,
        year: year,
      },
      errors: {
        401: `Unauthorized`,
        403: `Forbidden`,
        404: `Not Found`,
      },
    });
  }
}
