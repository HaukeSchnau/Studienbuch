import fs from "node:fs";

import Papa from "papaparse";

const normalizeHeader = (value: string | undefined, index: number) => {
  const trimmed = value?.trim();
  if (trimmed) {
    return trimmed;
  }
  return `column_${index + 1}`;
};

export type ParsedScheduleCsvRow = Record<string, string>;

export const parseScheduleCsv = async (csvPath: string, withHeader = true): Promise<ParsedScheduleCsvRow[]> => {
  const rawCsv = await fs.promises.readFile(csvPath, "utf8");
  const parseResult = Papa.parse<string[]>(rawCsv, {
    delimiter: ";",
    skipEmptyLines: true,
  });

  if (parseResult.errors.length > 0) {
    const error = parseResult.errors[0];
    throw new Error(`Failed to parse CSV at row ${error?.row ?? "unknown"}: ${error?.message ?? "unknown error"}`);
  }

  const rows = parseResult.data;
  if (rows.length === 0) {
    return [];
  }

  if (!withHeader) {
    return rows.map((row) =>
      Object.fromEntries(row.map((value, index) => [`column_${index + 1}`, (value ?? "").trim()])),
    );
  }

  const [header, ...body] = rows;
  const headers = (header ?? []).map((column, index) => normalizeHeader(column, index));

  return body.map((row) =>
    Object.fromEntries(headers.map((headerName, index) => [headerName, (row[index] ?? "").trim()])),
  );
};
