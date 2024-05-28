export interface RootRouter {
  type: "router";
  members: Member[];
}

export interface Router {
  type: "router";
  name: string;
  members: Member[];
}

export interface Query {
  type: "query";
  name: string;
  input: Type;
  output: Type;
}

export interface Mutation {
  type: "mutation";
  name: string;
  input: Type;
  output: Type;
}

export type PrimitiveType =
  | "string"
  | "number"
  | "boolean"
  | "Date"
  | "any"
  | "void";
export interface BaseType {
  nullable: boolean;
  optional: boolean;
}
export interface Union {
  type: "union";
  types: Type[];
}
export interface ArrayType {
  type: "array";
  elementType: Type;
}
export interface Property {
  name: string;
  type: Type;
}
export interface ObjectType {
  type: "object";
  properties: Property[];
}
export interface EnumType {
  type: "enum";
  values: string[];
}
export type Type = BaseType &
  (
    | {
        type: PrimitiveType;
      }
    | ArrayType
    | EnumType
    | Union
    | ObjectType
  );

export type Procedure = Query | Mutation;
export type Member = Router | Procedure;

export const ANY_TYPE = {
  type: "any",
  nullable: false,
  optional: false,
} as const;

export const isRouter = (member: Member): member is Router =>
  member.type === "router";
export const isQuery = (member: Member): member is Query =>
  member.type === "query";
export const isMutation = (member: Member): member is Mutation =>
  member.type === "mutation";
export const isProcedure = (member: Member): member is Procedure =>
  isQuery(member) || isMutation(member);
