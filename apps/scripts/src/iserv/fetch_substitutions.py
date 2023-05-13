import auth
import datetime
from pathlib import Path

session = auth.auth_iserv("hauke.schnau", "yXPTd26D5")

url = "https://igslilienthal.de/iserv/plan/show/raw/Vertretung_OS/"

today = datetime.date.today()

substitutions_dir = "./cache/substitutions"

Path(substitutions_dir).mkdir(parents=True, exist_ok=True)

# Download file and save it to disk as "VPlan-<date>.pdf"
response = session.get(url)
with open(substitutions_dir + "/" + today.strftime("%Y-%m-%d") + ".pdf", "wb") as file:
    file.write(response.content)
