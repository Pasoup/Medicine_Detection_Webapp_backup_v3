import csv
import os
from database import get_db, init_db

CSV = os.path.join(os.path.dirname(__file__), "data", "medicine_db.csv")

init_db()

with get_db() as conn:
    with open(CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = row.get("name", "").strip()
            if name:
                conn.execute(
                    "INSERT OR IGNORE INTO drugs (name) VALUES (?)", (name,)
                )
print("Migration done")