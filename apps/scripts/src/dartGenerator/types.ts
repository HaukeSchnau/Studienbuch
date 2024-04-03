import { writeConverter } from "./converter";
import { writeType } from "./generateDartClient";
import { capitalize } from "./strings";
import { ObjectType, Union } from "./trpc.type";
import { getVariableName } from "./util";

export function writeUnion(name: string, union: Union) {
  union.types.forEach((m, i) => writeType(`${name}Variant${i}`, m, name));

  return `sealed class $$NAME$$ {}`;
}

export function writeClass(
  name: string,
  type: ObjectType,
  superclass?: string,
) {
  const { properties } = type;
  if (properties.length === 0 && !superclass) {
    return null;
  }

  return `class $$NAME$$ ${superclass ? `extends ${superclass}` : ""} {
      ${properties
        .map((p) => {
          const type =
            writeType(`${name}${capitalize(p.name)}`, p.type) ?? "dynamic";
          const nullable = p.type.nullable || p.type.optional;

          return `final ${type}${nullable ? "?" : ""} ${getVariableName(p.name)};`;
        })
        .join("\n")}
  
      $$NAME$$({
        ${properties.map((p) => `required this.${getVariableName(p.name)}`).join(",\n")}
      });
  
      ${writeConverter(name, properties)}
    }`;
}
