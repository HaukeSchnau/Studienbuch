import { writeType } from "./generateDartClient";
import { capitalize } from "./strings";
import { Type } from "./trpc.type";

export function getAccessor(name: string | null) {
  if (!name) {
    return "json";
  }

  return `json['${name}']`;
}

export function getAssignment(
  name: string | null,
  propType: Type,
  propTypeName: string,
  accessor: string,
): string {
  const p = {
    type: propType,
  };
  if (p.type.type === "Date") {
    if (p.type.optional || p.type.nullable) {
      return `${accessor} != null ? DateTime.parse(${accessor}) : null`;
    }

    return `DateTime.parse(${accessor})`;
  }

  if (
    p.type.type === "string" ||
    p.type.type === "number" ||
    p.type.type === "boolean" ||
    p.type.type === "any" ||
    p.type.type === "void"
  ) {
    return `${accessor}`;
  }

  if (p.type.type === "array") {
    const type = writeType(
      name
        ? capitalize(name + "Element")
        : capitalize(propTypeName + "Element"),
      p.type.elementType,
    );
    const parsing = `(${accessor} as List<dynamic>).map<${type}>((e) => ${getAssignment(
      null,
      p.type.elementType,
      propTypeName + "Element",
      "e",
    )}).toList()`;

    if (p.type.nullable || p.type.optional) {
      return `${accessor} != null ? ${parsing} : null`;
    }

    return parsing;
  }

  const type = writeType(capitalize(propTypeName + "ASDF"), p.type);

  if (type === null) {
    throw new Error(`Type is null: ${JSON.stringify(p)}`);
  }

  if (p.type.nullable || p.type.optional) {
    return `${accessor} != null ? ${type}.fromJson(${accessor}) : null`;
  }

  return `${type}.fromJson(${accessor})`;
}

export function getVariableName(name: string) {
  if (name === "class") {
    return "clazz";
  }
  if (name === "default") {
    return "def";
  }
  return name;
}
