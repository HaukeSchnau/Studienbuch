export interface SubstitutionColumn {
  key: string;
  name: string;
}

export interface SubstitutionCell {
  data: string;
  rowSpan: number;
}

export type SubstitutionRow = Record<string, SubstitutionCell | undefined>;

export interface SubstitutionsResult {
  columns: SubstitutionColumn[];
  substitutions: SubstitutionRow[];
  date: Date;
  lastUpdate: Date;
}

export const addRowSpans = (rows: SubstitutionRow[]) => {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, cell]) => [key, cell ? { ...cell, rowSpan: cell.rowSpan || 1 } : undefined]),
    ),
  );
};

export const getSubstitutions = async (_school: string, _formatName: string): Promise<SubstitutionsResult> => {
  return {
    columns: [],
    substitutions: [],
    date: new Date(),
    lastUpdate: new Date(),
  };
};
