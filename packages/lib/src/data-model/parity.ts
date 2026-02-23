import type { SchemaParityContract } from "./contracts";

export interface SchemaParityActualTable {
  columns: readonly string[];
  primaryKeyColumns: readonly string[];
}

export type SchemaParityActualTables = Readonly<Record<string, SchemaParityActualTable | undefined>>;

export interface SchemaParityTableResult {
  tableName: string;
  missingTable: boolean;
  missingRequiredColumns: readonly string[];
  expectedPrimaryKeyColumns: readonly string[];
  actualPrimaryKeyColumns: readonly string[];
  primaryKeyMatches: boolean;
  passed: boolean;
}

export interface SchemaParityResult {
  passed: boolean;
  tables: readonly SchemaParityTableResult[];
}

const hasExactColumnOrder = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const evaluateTableParity = (
  contract: SchemaParityContract,
  actualTable: SchemaParityActualTable | undefined,
): SchemaParityTableResult => {
  if (!actualTable) {
    return {
      tableName: contract.tableName,
      missingTable: true,
      missingRequiredColumns: contract.requiredColumns,
      expectedPrimaryKeyColumns: contract.primaryKeyColumns,
      actualPrimaryKeyColumns: [],
      primaryKeyMatches: false,
      passed: false,
    };
  }

  const missingRequiredColumns = contract.requiredColumns.filter((column) => !actualTable.columns.includes(column));
  const primaryKeyMatches = hasExactColumnOrder(contract.primaryKeyColumns, actualTable.primaryKeyColumns);

  return {
    tableName: contract.tableName,
    missingTable: false,
    missingRequiredColumns,
    expectedPrimaryKeyColumns: contract.primaryKeyColumns,
    actualPrimaryKeyColumns: actualTable.primaryKeyColumns,
    primaryKeyMatches,
    passed: missingRequiredColumns.length === 0 && primaryKeyMatches,
  };
};

export const evaluateSchemaParity = (
  contracts: readonly SchemaParityContract[],
  actualTables: SchemaParityActualTables,
): SchemaParityResult => {
  const tables = contracts.map((contract) => evaluateTableParity(contract, actualTables[contract.tableName]));
  return {
    passed: tables.every((table) => table.passed),
    tables,
  };
};
