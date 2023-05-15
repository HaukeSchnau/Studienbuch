import camelot
import sys
import os

file_path = sys.argv[1]
file_name = os.path.basename(file_path)

output_dir = sys.argv[2] if len(sys.argv) > 2 else "."

tables = camelot.read_pdf(file_path, pages="all")

for table in tables:
    print(table.df)
    print()

print("Total tables extracted:", tables.n)
tables.export(os.path.join(output_dir, file_name.replace(".pdf", ".csv")), f="csv")
