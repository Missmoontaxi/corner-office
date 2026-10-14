"""Import Paula's seed Sheet into persona/executive-life/*.json.

Usage: python3 scripts/seed_from_sheet.py <path-to-xlsx>

Only structured fields come from the Sheet. Long text Claude writes
(email bodies, newsletter items, call transcripts) lives in hand-edited
files under persona/executive-life/ and is never overwritten here.
"""
import json
import os
import sys

import openpyxl

OUT = os.path.join(os.path.dirname(__file__), "..", "persona", "executive-life")

TABS = {
    "Settings": ("brand.json", ["id", "setting", "value", "notes", "source"]),
    "Cast": ("cast.json", ["id", "name", "role", "pronouns", "age", "email", "voice", "wants", "source"]),
    "KPIs": ("kpis.json", ["id", "area", "metric", "value", "unit", "as_of", "story", "source"]),
    "Calendar": ("show-day/calendar.json", ["id", "day", "start", "end", "title", "attendees", "status", "notes", "source"]),
    "Inbox": ("inbox/index.json", ["id", "received", "from", "address", "subject", "gist", "flag", "source"]),
    "Newsletters": ("newsletters/index.json", ["id", "section", "publication", "item", "why", "source"]),
    "Decisions": ("show-day/decisions.json", ["id", "question", "choice", "alternative", "tradeoff", "unknown", "where", "builders_call", "source"]),
    "Household Facts": ("household/facts.json", ["id", "fact", "fact_source", "dated", "notes", "source"]),
    "Household Rights": ("household/rights.json", ["id", "granted_by", "holder", "rights", "basis", "granted_on", "source"]),
    "Household Tasks": ("household/tasks.json", ["id", "task", "plan_item", "status", "proof", "owner", "due", "provider", "notes", "source"]),
    "Providers": ("household/providers.json", ["id", "name", "type", "scope", "release_on_file", "verified_on", "notes", "source"]),
}


def clean(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def main(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    for tab, (fname, keys) in TABS.items():
        ws = wb[tab]
        rows = []
        for r in ws.iter_rows(min_row=2, values_only=True):
            if not r or not r[0]:
                continue
            rows.append({k: clean(v) for k, v in zip(keys, r)})
        dest = os.path.join(OUT, fname)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w") as f:
            json.dump({"imported_from": os.path.basename(path), "rows": rows}, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"{tab:18} {len(rows):3} rows -> {fname}")


if __name__ == "__main__":
    main(sys.argv[1])
