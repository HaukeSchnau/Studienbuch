declare module "pdf-table-extractor" {
    type Table = string[];
    
      type PageTable = {
          tables: Table[]
      };
    
      export type Document = {
        pageTables: PageTable[];
      };
    
      export default function pdf_table_extractor(
        pdfPath: string,
        success: (doc: Document) => void,
        error: (err: Error) => void
      ): void;
    
    }
