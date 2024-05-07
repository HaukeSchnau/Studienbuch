import fs from "fs/promises";
import p from "path";

import { ensureParentDir } from "@schnau/lib-server";

import { writeEnumConverter } from "./converter";
import { getRouterStructure } from "./getRouterStructure";
import { createProcedureFile, createRouterFile } from "./procedure";
import { capitalize, snakeToCamel } from "./strings";
import { isProcedure, isRouter, RootRouter, Type } from "./trpc.type";
import { writeClass, writeUnion } from "./types";

// Maps type names to Dart code
const typeNameMap = new Map<string, string>();
// Maps dart code to the type name
const typeCodeMap = new Map<string, string>();

export async function generateDartClient(fileName: string, outputDir: string) {
  const routerStructure = getRouterStructure(fileName);
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

abstract class ApiClient {
  final http.Client client;
${routers.map((m) => `  late final ${capitalize(m.name)}Api ${m.name};`).join("\n")}

  ApiClient({http.Client? client})
      : client = client ?? http.Client() {
${routers.map((m) => `    ${m.name} = ${capitalize(m.name)}Api(this);`).join("\n")}
  }

  Uri get baseUri;

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

export function writeType(
  name: string,
  type: Type,
  parent?: string,
): string | null {
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
