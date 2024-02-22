declare module "pdf-table-extractor" {
  type Table = string[];

  interface PageTable {
    tables: Table[];
  }

  export interface Document {
    pageTables: PageTable[];
  }

  export default function pdf_table_extractor(
    pdfPath: string,
    success: (doc: Document) => void,
    error: (err: Error) => void,
  ): void;
}
