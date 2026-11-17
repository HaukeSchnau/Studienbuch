import { CivilTime } from "@stu/core";

const { TimeZone } = CivilTime;

// oxlint-disable-next-line studienbuch/no-literal-time-zone -- fixture: a zone written out in a feature
export const berlin = CivilTime.TimeZone.make("Europe/Berlin");

// oxlint-disable-next-line studienbuch/no-literal-time-zone -- fixture: a zone in a template literal
export const utc = CivilTime.TimeZone.makeOption(`UTC`);

// oxlint-disable-next-line studienbuch/no-literal-time-zone -- fixture: through a destructured import
export const london = TimeZone.makeEffect("Europe/London");

// A zone the caller passes in, such as the school row's, passes.
export const zoneOf = (school: { readonly timeZone: string }) =>
  CivilTime.TimeZone.make(school.timeZone);
