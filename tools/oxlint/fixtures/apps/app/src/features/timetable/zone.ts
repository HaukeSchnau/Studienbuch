import { CivilTime } from "@stu/core";

// oxlint-disable-next-line studienbuch/no-literal-time-zone -- fixture: a zone written out in a feature
export const berlin = CivilTime.TimeZone.make("Europe/Berlin");

// oxlint-disable-next-line studienbuch/no-literal-time-zone -- fixture: a zone in a template literal
export const utc = CivilTime.TimeZone.makeOption(`UTC`);

// A zone the caller passes in, such as the school row's, passes.
export const zoneOf = (school: { readonly timeZone: string }) =>
  CivilTime.TimeZone.make(school.timeZone);
