from pathlib import Path
import camelot
import sys
import os


def extract_tables(file_path: str, output_dir: str, print_tables: bool = True):
    file_name = os.path.basename(file_path)
    tables = camelot.read_pdf(file_path, pages="all")
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    if print_tables:
        for table in tables:
            print(table.df)
            print()

        print("Total tables extracted:", tables.n)

    try:
        tables.export(
            os.path.join(output_dir, file_name.replace(".pdf", ".csv")), f="csv"
        )
    except Exception as e:
        print(f"Error while exporting tables from file {file_name}: {e}")


if __name__ == "__main__":
    file_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "."

    extract_tables(file_path, output_dir)
