import fs from "fs/promises";
import p from "path";

import { ensureParentDir } from "@schnau/lib-server";

import { getRouterStructure } from "./getRouterStructure";
import {
  isProcedure,
  isRouter,
  ObjectType,
  Procedure,
  Property,
  RootRouter,
  Router,
  Type,
  Union,
} from "./trpc.type";

const capitalize = (str?: string | null) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const snakeToCamel = (str: string) =>
  str
    .toLowerCase()
    .replace(/([-_][a-z])/g, (group) =>
      group.toUpperCase().replace("-", "").replace("_", ""),
    );

const fileName = process.argv[2];
const outputDir = process.argv[3];
if (!fileName || !outputDir) {
  console.error("Usage: node generateDartClient.js <fileName> <outputDir>");
  process.exit(1);
}

main(fileName, outputDir).catch((err) => {
  console.error(err);
  process.exit(1);
});

// Maps type names to Dart code
const typeNameMap = new Map<string, string>();
// Maps dart code to the type name
const typeCodeMap = new Map<string, string>();
const routerStructure = getRouterStructure(fileName);

async function main(fileName: string, outputDir: string) {
  const mainFileName = p.join(outputDir, "api.dart");
  await ensureParentDir(mainFileName);

  await fs.writeFile(mainFileName, createMainFile(routerStructure));
  await fs.writeFile(
    p.join(outputDir, "types.dart"),
    "// ignore_for_file: unnecessary_question_mark\n\n" +
      [...typeNameMap.entries()]
        .map(([name, code]) => code.replaceAll("$$NAME$$", name))
        .join("\n"),
  );
}

function createMainFile(routerStructure: RootRouter) {
  const routers = routerStructure.members.filter(isRouter);
  const procedures = routerStructure.members.filter(isProcedure);

  return `// GENERATED FILE - DO NOT MODIFY
// ignore_for_file: always_use_package_imports

import 'package:http/http.dart' as http;
import 'dart:convert';
import './types.dart';

class ApiClient {
  final Uri baseUri;
  final http.Client client;
${routers.map((m) => `  late final ${capitalize(m.name)}Api ${m.name};`).join("\n")}

  ApiClient({required this.baseUri, http.Client? client})
      : client = client ?? http.Client() {
${routers.map((m) => `    ${m.name} = ${capitalize(m.name)}Api(this);`).join("\n")}
  }

${procedures.map(createProcedureFile("")).join("\n")}

  void dispose() {
    client.close();
  }
}

abstract class BaseApi {
  final ApiClient _client;

  BaseApi(this._client);

  http.Client get client => _client.client;

  Uri get baseUri => _client.baseUri;
}

${routers.map(createRouterFile).join("\n")}
`;
}

function createRouterFile(router: Router) {
  const routers = router.members.filter(isRouter);
  const procedures = router.members.filter(isProcedure);

  return `
class ${capitalize(router.name)}Api extends BaseApi {
  ${capitalize(router.name)}Api(super.client);

${routers.map((m) => `  late final ${capitalize(m.name)}Api ${m.name};`).join("\n")}
${procedures.map(createProcedureFile(router.name)).join("\n")}
}
`;
}

function createProcedureFile(parentName: string) {
  return (p: Procedure) => {
    const input = writeType(
      `${capitalize(parentName)}${capitalize(p.name)}Input`,
      p.input,
    );
    const output = writeType(
      `${capitalize(parentName)}${capitalize(p.name)}Output`,
      p.output,
    );

    if (p.name === "login") {
      return ""; // TODO: Fix login with discriminated unions etc
    }

    const inputNullableSymbol = p.input.nullable || p.input.optional ? "?" : "";
    const outputNullableSymbol =
      p.output.nullable || p.output.optional ? "?" : "";

    if (input && p.input.type === "object") {
      const namedParams = p.input.properties
        .map((p) =>
          p.type.optional || p.type.nullable
            ? `${writeType(p.name, p.type)}? ${getVariableName(p.name)}`
            : `required ${writeType(p.name, p.type)} ${getVariableName(p.name)}`,
        )
        .join(", ");

      return `Future<${output ?? "void"}${outputNullableSymbol}> ${p.name}({ ${namedParams}}) async {
        final input = ${input}(
          ${p.input.properties
            .map(
              (p) => `${getVariableName(p.name)}: ${getVariableName(p.name)}`,
            )
            .join(",\n")}
        );
      ${writeProcedureBody(p, input, output, parentName ? `${parentName}.${p.name}` : p.name, p.input, p.output)}
    }`;
    }

    return `Future<${output ?? "void"}${outputNullableSymbol}> ${p.name}(${input ? `${input}${inputNullableSymbol} input` : ""}) async {
      ${writeProcedureBody(p, input, output, parentName ? `${parentName}.${p.name}` : p.name, p.input, p.output)}
    }`;
  };
}

function writeProcedureBody(
  p: Procedure,
  input: string | null,
  output: string | null,
  path: string,
  inputType: Type,
  outputType: Type,
) {
  if (p.type === "mutation") {
    return `
      final uri = Uri.https("studienbuch.app", "api/trpc/${path}");
      final payload = {
        "json": ${getToJsonCall(inputType, "input")},
        ${getMeta(inputType)}
      };

      final response = await client.post(uri,
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: jsonEncode(payload));
      ${writeResponseParser(output, outputType, path)}
    `;
  }

  const request =
    inputType.type === "void"
      ? `
  final uri = Uri.https("studienbuch.app", "api/trpc/${path}");
  final response = await client.get(uri);
  `
      : `
  final payload = {
    "json": ${getToJsonCall(inputType, "input")},
    ${getMeta(inputType)}
  };
  final uri = Uri.https("studienbuch.app", "api/trpc/${path}", {"input": jsonEncode(payload)});
  final response = await client.get(uri);`;

  return `
  ${request}
  ${writeResponseParser(output, outputType, path)}
  `;
}

function writeResponseParser(
  output: string | null,
  outputType: Type,
  path: string,
) {
  return `
  if (response.statusCode != 200) {
    throw Exception('Failed to get ${path}: \${response.body}');
  }
  
  ${
    output
      ? `final json = jsonDecode(utf8.decode(response.bodyBytes));
  return ${getAssignment("result']['data']['json", outputType, output, getAccessor("result']['data']['json"))};`
      : ""
  }
`;
}

function getMeta(inputType: Type) {
  if (inputType.type !== "object") {
    return "";
  }

  const metaValues: string[] = [];
  for (const p of inputType.properties) {
    if (p.type.type === "Date") {
      metaValues.push(`"${p.name}": ["Date"]`);
    }
  }
  if (metaValues.length === 0) {
    return "";
  }

  return `"meta": {
  "values": {
    ${metaValues.join(",\n")}
  }
},`;
}

function getToJsonCall(type: Type | null, varName: string): string {
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

  if (type.type === "union" || type.type === "object") {
    return `${varName}${nullableSymbol}.toJson()`;
  }

  throw new Error(`Unknown type: ${JSON.stringify(type)}`);
}

function writeType(name: string, type: Type, parent?: string): string | null {
  if (type.type === "enum") {
    const code = `enum $$NAME$$ {
      ${type.values.map(snakeToCamel).join(",\n")};

      ${writeEnumConverter(type.values)}
    }`;

    name = name + "Enum";

    if (typeNameMap.has(name) && typeNameMap.get(name) !== code) {
      throw new Error(
        `Type ${name} already exists, ${typeNameMap.get(name)} !== ${code}`,
      );
    }

    if (!typeCodeMap.has(code)) {
      typeNameMap.set(name, code);
      typeCodeMap.set(code, name);
    }

    return typeCodeMap.get(code) ?? name;
  }

  if (type.type === "union") {
    const code = writeUnion(name, type);
    if (typeNameMap.has(name) && typeNameMap.get(name) !== code) {
      throw new Error(`Type ${name} already exists`);
    }

    if (!typeCodeMap.has(code)) {
      typeNameMap.set(name, code);
      typeCodeMap.set(code, name);
    }

    return typeCodeMap.get(code) ?? name;
  }

  if (type.type === "array") {
    return `List<${writeType(name, type.elementType)}>`;
  }

  if (type.type === "Date") {
    return "DateTime";
  }

  if (type.type === "string") return "String";

  if (type.type === "number") {
    if (name === "id" || name.includes("Id")) {
      return "int";
    }
    return "num";
  }

  if (type.type === "boolean") return "bool";

  if (type.type === "any") return "dynamic";

  if (type.type === "void") return null;

  if (type.type === "object") {
    const code = writeClass(name, type, parent);
    if (!code) {
      return null;
    }

    if (typeNameMap.has(name) && typeNameMap.get(name) !== code) {
      throw new Error(
        `Type ${name} already exists` +
          `: ${typeNameMap.get(name)} !== ${code}`,
      );
    }

    if (!typeCodeMap.has(code)) {
      typeNameMap.set(name, code);
      typeCodeMap.set(code, name);
    }

    return typeCodeMap.get(code) ?? name;
  }

  throw new Error(`Unknown type: ${type}`);
}

function writeUnion(name: string, union: Union) {
  union.types.forEach((m, i) => writeType(`${name}Variant${i}`, m, name));

  return `sealed class $$NAME$$ {}`;
}

function writeClass(name: string, type: ObjectType, superclass?: string) {
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

function writeEnumConverter(values: string[]) {
  return `factory $$NAME$$.fromJson(String json) {
      switch (json) {
        ${values.map((v) => `case '${v}': return $$NAME$$.${snakeToCamel(v)};`).join("\n")}
        default: throw Exception('Unknown enum value: $json');
      }
    }`;
}

function writeConverter(name: string, properties: Property[]) {
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

function getAccessor(name: string | null) {
  if (!name) {
    return "json";
  }

  return `json['${name}']`;
}

function getAssignment(
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

function getVariableName(name: string) {
  if (name === "class") {
    return "clazz";
  }
  return name;
}
