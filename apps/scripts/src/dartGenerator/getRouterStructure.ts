import * as ts from "typescript";

import {
  ANY_TYPE,
  Member,
  Mutation,
  Query,
  RootRouter,
  Type,
} from "./trpc.type";

export function getRouterStructure(fileName: string): RootRouter {
  let program = ts.createProgram([fileName], {
    target: ts.ScriptTarget.ES2022,
    lib: ["dom", "dom.iterable", "ES2022"],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: ts.JsxEmit.Preserve,
    noUncheckedIndexedAccess: true,
  });

  let checker = program.getTypeChecker();

  const mainFile = program
    .getSourceFiles()
    .find(
      (sourceFile) =>
        !sourceFile.isDeclarationFile &&
        sourceFile.fileName.includes("root.ts"),
    );

  if (!mainFile) {
    throw new Error("Could not find root.ts");
  }

  const routerStructure = ts.forEachChild(mainFile, visit);
  if (!routerStructure) {
    throw new Error("Could not find AppRouter type");
  }
  return routerStructure;

  function visit(node: ts.Node) {
    // Only consider exported nodes
    if (!isNodeExported(node)) {
      return;
    }

    if (
      ts.isTypeAliasDeclaration(node) &&
      node.name.getText() === "AppRouter"
    ) {
      return serializeRootRouter(checker.getTypeAtLocation(node.name)!);
    }
  }

  function serializeRootRouter(type: ts.Type): RootRouter {
    const members = type
      .getProperties()
      .filter(
        (symbol) =>
          symbol.getName() !== "_def" && symbol.getName() !== "createCaller",
      )
      .map(serializeMember);

    return {
      type: "router",
      members: members,
    };
  }

  function serializeMember(symbol: ts.Symbol): Member {
    const type = checker.getTypeOfSymbol(symbol);
    const typeSymbol = type.getSymbol();

    if (typeSymbol?.getName() === "QueryProcedure") {
      return serializeQuery(symbol);
    }

    if (typeSymbol?.getName() === "MutationProcedure") {
      return serializeMutation(symbol);
    }

    return {
      type: "router",
      name: symbol.getName(),
      members: type.getProperties().map(serializeMember),
    };
  }

  function serializeQuery(symbol: ts.Symbol): Query {
    const type = checker.getTypeOfSymbol(symbol);
    const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
    if (typeArgs.length !== 1 || !typeArgs[0]) {
      throw new Error("QueryProcedure must have exactly one type argument");
    }

    const arg = typeArgs[0];
    const input = arg.getProperty("input");
    if (!input) {
      throw new Error("QueryProcedure must have an input property");
    }

    const output = arg.getProperty("output");
    if (!output) {
      throw new Error("QueryProcedure must have an output property");
    }

    return {
      type: "query",
      name: symbol.getName(),
      input: serializeType(checker.getTypeOfSymbol(input)),
      output: serializeType(checker.getTypeOfSymbol(output)),
    };
  }

  function serializeMutation(symbol: ts.Symbol): Mutation {
    const type = checker.getTypeOfSymbol(symbol);
    const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
    if (typeArgs.length !== 1 || !typeArgs[0]) {
      throw new Error("MutationProcedure must have exactly one type argument");
    }

    const arg = typeArgs[0];
    const input = arg.getProperty("input");
    if (!input) {
      throw new Error("MutationProcedure must have an input property");
    }

    const output = arg.getProperty("output");
    if (!output) {
      throw new Error("MutationProcedure must have an output property");
    }

    return {
      type: "mutation",
      name: symbol.getName(),
      input: serializeType(checker.getTypeOfSymbol(input)),
      output: serializeType(checker.getTypeOfSymbol(output)),
    };
  }

  function isNodeExported(node: ts.Node): boolean {
    return (
      (ts.getCombinedModifierFlags(node as ts.Declaration) &
        ts.ModifierFlags.Export) !==
        0 ||
      (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
    );
  }

  function serializeTypeExceptUnion(
    type: ts.Type,
    nullable: boolean,
    optional: boolean,
  ): Type {
    if (type.isUnion()) {
      throw new Error("Expected non-union type");
    }

    if (checker.isArrayType(type)) {
      return {
        type: "array",
        elementType: serializeType(
          checker.getTypeArguments(type as ts.TypeReference)[0]!,
        ),
        nullable,
        optional,
      };
    }

    if (type.getSymbol()?.getName() === "Date") {
      return {
        type: "Date",
        nullable,
        optional,
      };
    }

    if (type === checker.getStringType()) {
      return {
        type: "string",
        nullable,
        optional,
      };
    }

    if (type === checker.getNumberType()) {
      return {
        type: "number",
        nullable,
        optional,
      };
    }

    if (type === checker.getBooleanType()) {
      return {
        type: "boolean",
        nullable,
        optional,
      };
    }

    const properties = type.getProperties();
    if (properties.length === 0) {
      return {
        type: "void",
        nullable,
        optional,
      };
    }

    return {
      type: "object",
      properties: properties.map((p) => ({
        name: p.getName(),
        type: serializeType(checker.getTypeOfSymbol(p)),
      })),
      nullable,
      optional,
    };
  }

  function serializeType(type: ts.Type): Type {
    const nullable = isNullable(type);
    const optional = isOptional(type);

    if (type.isUnion()) {
      if (type.aliasSymbol?.name === "JsonValue") {
        return ANY_TYPE;
      }

      const members = type.types.filter(
        (t) =>
          t.flags !== ts.TypeFlags.Null && t.flags !== ts.TypeFlags.Undefined,
      );
      if (members.length === 1) {
        return serializeTypeExceptUnion(members[0]!, nullable, optional);
      }

      if (
        members.length === 2 &&
        members.every(
          (t) => t === checker.getTrueType() || t === checker.getFalseType(),
        )
      ) {
        return {
          type: "boolean",
          nullable,
          optional,
        };
      }

      if (members.every((t) => t.isStringLiteral())) {
        return {
          type: "enum",
          values: members.map((t) => (t as ts.StringLiteralType).value),
          nullable,
          optional,
        };
      }

      return {
        type: "union",
        types: type.types.map(serializeType),
        nullable,
        optional,
      };
    }

    return serializeTypeExceptUnion(type, nullable, optional);
  }

  function isNullable(type: ts.Type) {
    return (
      type.isUnion() &&
      type.types.some(
        (t) => (t.getFlags() & ts.TypeFlags.Null) === ts.TypeFlags.Null,
      )
    );
  }

  function isOptional(type: ts.Type) {
    return (
      type.isUnion() &&
      type.types.some(
        (t) =>
          (t.getFlags() & ts.TypeFlags.Undefined) === ts.TypeFlags.Undefined,
      )
    );
  }
}

if (!process.argv[2]) {
  console.log("Usage: generateDartClient file.ts");
  process.exit(1);
}
