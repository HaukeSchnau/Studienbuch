import { CivilTime, School } from "@stu/core";

const { TimeZone } = CivilTime;

// oxlint-disable-next-line studienbuch/no-literal-time-zone -- fixture: a zone outside core
export const berlin = CivilTime.TimeZone.make("Europe/Berlin");

// oxlint-disable-next-line studienbuch/no-literal-time-zone -- fixture: through a destructured import
export const utc = TimeZone.makeOption(`UTC`);

// A zone that comes from data passes.
export const zoneOf = (text: string) => CivilTime.TimeZone.makeOption(text);

// Other ids made from a literal pass.
export const school = School.Id.make("demo-schule");
