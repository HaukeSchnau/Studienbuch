from iserv import auth
from datetime import datetime, timedelta
from pathlib import Path
import os
from extract_tables import extract_tables

session = auth.auth_iserv("hauke.schnau", "yXPTd26D5")

url = "https://igslilienthal.de/iserv/plan/show/raw/Vertretung_OS/"

substitutions_dir = "./cache/substitutions"
substitutions_csv_dir = "./cache/substitutions_csv"


def fetch_substitutions(date):
    response = session.get(url + "OS_V_{}.pdf".format(date.strftime("%d.%m.%Y")))
    original_pdf_name = response.url.split("/")[-1]
    pdf_date = datetime.strptime(original_pdf_name.split("_")[-1], "%d.%m.%Y.pdf")
    pdf_name = pdf_date.strftime("%Y-%m-%d.pdf")

    pdf_path = os.path.join(substitutions_dir, pdf_name)

    with open(pdf_path, "wb") as file:
        file.write(response.content)

    extract_tables(pdf_path, substitutions_csv_dir)


Path(substitutions_dir).mkdir(parents=True, exist_ok=True)

fetch_substitutions(datetime.now())
fetch_substitutions(datetime.now() + timedelta(days=1))
