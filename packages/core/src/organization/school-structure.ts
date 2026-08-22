import * as Schema from "effect/Schema";
import { NonBlankText } from "../foundation/non-blank-text";
import { BuildingId, DepartmentId, RoomId, SchoolId } from "./identity";

export const Department = Schema.Struct({
  id: DepartmentId,
  schoolId: SchoolId,
  name: NonBlankText,
  code: Schema.optional(NonBlankText),
});
export interface Department extends Schema.Schema.Type<typeof Department> {}

export const Building = Schema.Struct({
  id: BuildingId,
  schoolId: SchoolId,
  name: NonBlankText,
  code: Schema.optional(NonBlankText),
});
export interface Building extends Schema.Schema.Type<typeof Building> {}

export const Room = Schema.Struct({
  id: RoomId,
  schoolId: SchoolId,
  name: NonBlankText,
  code: Schema.optional(NonBlankText),
  capacity: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  buildingId: Schema.optional(BuildingId),
  departmentId: Schema.optional(DepartmentId),
});
export interface Room extends Schema.Schema.Type<typeof Room> {}
