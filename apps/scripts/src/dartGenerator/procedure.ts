import { getToJsonCall } from "./converter";
import { writeType } from "./generateDartClient";
import { writeResponseParser } from "./network";
import { capitalize } from "./strings";
import { isProcedure, isRouter, Procedure, Router, Type } from "./trpc.type";
import { getVariableName } from "./util";

export function createRouterFile(router: Router) {
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

export function createProcedureFile(parentName: string) {
  return (p: Procedure) => {
    if (p.name === "login") {
      return ""; // TODO: Fix login with discriminated unions etc
    }

    const input = writeType(
      `${capitalize(parentName)}${capitalize(p.name)}Input`,
      p.input,
    );
    const output = writeType(
      `${capitalize(parentName)}${capitalize(p.name)}Output`,
      p.output,
    );

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
        final uri = baseUri.replace(path: "api/trpc/${path}");
        final payload = {
          "json": ${getToJsonCall(inputType, "input")},
          ${getMeta(inputType)}
        };
  
        final response = await client.post(uri,
          headers: <String, String>{
            'Content-Type': 'application/json; charset=UTF-8',
            'x-trpc-source': 'mobile-app',
          },
          body: jsonEncode(payload));
        ${writeResponseParser(output, outputType, path)}
      `;
  }

  const request =
    inputType.type === "void"
      ? `
      final uri = baseUri.replace(path: "api/trpc/${path}");
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });
    `
      : `
    final payload = {
      "json": ${getToJsonCall(inputType, "input")},
      ${getMeta(inputType)}
    };
    final uri = baseUri.replace(path: "api/trpc/${path}", queryParameters: {"input": jsonEncode(payload)});
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });`;

  return `
    ${request}
    ${writeResponseParser(output, outputType, path)}
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
