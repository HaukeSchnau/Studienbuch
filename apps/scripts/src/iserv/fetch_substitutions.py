import auth
from datetime import datetime
from pathlib import Path
import os

session = auth.auth_iserv("hauke.schnau", "yXPTd26D5")

url = "https://igslilienthal.de/iserv/plan/show/raw/Vertretung_OS/"

substitutions_dir = "./cache/substitutions"

Path(substitutions_dir).mkdir(parents=True, exist_ok=True)

# Download file and save it to disk
response = session.get(url)
original_pdf_name = response.url.split("/")[-1]
pdf_date = datetime.strptime(original_pdf_name.split("_")[-1], "%d.%m.%Y.pdf")
pdf_name = pdf_date.strftime("%Y-%m-%d.pdf")

pdf_path = os.path.join(substitutions_dir, pdf_name)

with open(pdf_path, "wb") as file:
    file.write(response.content)
