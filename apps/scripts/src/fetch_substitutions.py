import datetime
from iserv import auth
from pathlib import Path
import os
from extract_tables import extract_tables
import PyPDF2
import re

session = auth.auth_iserv("hauke.schnau", "yXPTd26D5", log=False)

url = "https://igslilienthal.de/iserv/plan/show/raw/Vertretung_OS/"

substitutions_dir = "./cache/substitutions"
substitutions_csv_dir = "./cache/substitutions_csv"


def try_parsing_date(text: str):
    for fmt in ("%d.%m.", "%d.%-m.", "%-d.%m.", "%-d.%-m."):
        try:
            return datetime.datetime.strptime(text, fmt)
        except ValueError:
            pass
    raise ValueError("no valid date format found")


def fetch_substitutions(date: datetime.datetime):
    response = session.get(url + "OS_V_{}.pdf".format(date.strftime("%d.%m.%Y")))
    pdf_name = "temp.pdf"

    pdf_path = os.path.join(substitutions_dir, pdf_name)

    with open(pdf_path, "wb") as file:
        file.write(response.content)

    with open(pdf_path, "rb") as file:
        try:
            reader = PyPDF2.PdfReader(file)
        except Exception as e:
            print(
                f"Error while reading newly downloaded PDF file. Maybe there is no substitutions for {date.strftime('%d.%m.%Y')}?"
            )
            return

        # Extract date from PDF in String that looks like "Lehrer  23.5. / Dienstag" using regex
        regex = r"Lehrer +(\d{1,2}\.\d{1,2}\.)"
        pdf_text = reader.pages[0].extract_text()

        for line in pdf_text.split("\n"):
            # Check if line matches regex and extract date from it if it does
            match = re.match(regex, line)
            if match:
                date_str = match.group(1)
                date = try_parsing_date(date_str)
                current_year = datetime.date.today().year
                date = date.replace(year=current_year)
                break

        new_path = os.path.join(substitutions_dir, date.strftime("%Y-%m-%d.pdf"))
        existed_before = os.path.exists(new_path)
        # Move file to new name with date in it
        os.rename(pdf_path, new_path)

    extract_tables(new_path, substitutions_csv_dir, print_tables=not existed_before)


Path(substitutions_dir).mkdir(parents=True, exist_ok=True)

fetch_substitutions(datetime.datetime.now())
# TODO: Find a way to check if tomorrow's substitutions are already available
fetch_substitutions(datetime.datetime.now() + datetime.timedelta(days=1))
