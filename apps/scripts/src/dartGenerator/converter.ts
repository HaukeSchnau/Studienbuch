import type { Property, Type } from "./trpc.type";
import { snakeToCamel } from "./strings";
import { getAccessor, getAssignment, getVariableName } from "./util";

export function writeEnumConverter(values: string[]) {
  return `factory $$NAME$$.fromJson(String json) {
        switch (json) {
          ${values.map((v) => `case '${v}': return $$NAME$$.${snakeToCamel(v)};`).join("\n")}
          default: throw Exception('Unknown enum value: $json');
        }
      }`;
}

export function writeConverter(name: string, properties: Property[]) {
  return `factory $$NAME$$.fromJson(dynamic json) {
        return $$NAME$$(
          ${properties
            .map((p) => {
              return `${getVariableName(p.name)}: ${getAssignment(p.name, p.type, name, getAccessor(p.name))}`;
            })
            .join(",\n")}
        );
      }
      
      dynamic toJson() {
        return {
          ${properties
            .map((p) => {
              return `'${p.name}': ${getToJsonCall(p.type, getVariableName(p.name))}`;
            })
            .join(",\n")}
        };
      }`;
}

export function getToJsonCall(type: Type | null, varName: string): string {
  if (!type || type.type === "void") {
    return "null";
  }

  if (
    type.type === "string" ||
    type.type === "number" ||
    type.type === "boolean" ||
    type.type === "any"
  ) {
    return varName;
  }

  const isNullable = type.nullable || type.optional;
  const nullableSymbol = isNullable ? "?" : "";

  if (type.type === "Date") {
    return `${varName}${nullableSymbol}.toIso8601String()`;
  }

  if (type.type === "array") {
    return `${varName}${nullableSymbol}.map((e) => ${getToJsonCall(type.elementType, "e")}).toList()`;
  }

  if (type.type === "enum") {
    return `${varName}${nullableSymbol}.toString()`;
  }

  return `${varName}${nullableSymbol}.toJson()`;
}
