"""
Run the contract-register analyzer over ALL contract PDFs in corpus/pdf/.

Sends each PDF's bytes to Content Understanding via the :analyzeBinary operation
(no blob, no SAS URL), reads back the extracted fields + confidence, prints them,
and writes one row per contract to output/extracted_register.csv.

Location-aware: finds the schema next to itself, the PDFs in corpus/pdf/, the .env
at the project root, and writes to output/. No secrets in this file (they load from
.env, which is gitignored).

Run from the project root:
    python3 extraction/run_all_contracts.py
"""

import os
import csv
import json
import time
import base64
import requests
from pathlib import Path

HERE = Path(__file__).resolve().parent      # vendor-contract-assistant/extraction
ROOT = HERE.parent                          # vendor-contract-assistant


def load_env(path):
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env(ROOT / ".env")

ENDPOINT = os.environ.get("CU_ENDPOINT", "").rstrip("/")
KEY = os.environ.get("CU_KEY", "")
API_VERSION = os.environ.get("CU_API_VERSION", "2025-11-01")

ANALYZER_FILE = HERE / "contract-analyzer-schema-v1.json"
PDF_FOLDER = ROOT / "corpus" / "pdf"
OUT_CSV = ROOT / "output" / "extracted_register.csv"
CONF_THRESHOLD = 0.50

if not ENDPOINT or not KEY:
    raise SystemExit("Missing CU_ENDPOINT or CU_KEY. Put them in the .env file at the project root.")

JSON_HEADERS = {"Ocp-Apim-Subscription-Key": KEY, "Content-Type": "application/json"}

FIELDS = ["vendor", "client_name", "service_category", "annual_value", "annual_value_note",
          "currency", "renewal_type", "renewal_date", "notice_days", "escalation_type",
          "escalation_pct", "has_dpa"]

_WORKING_METHOD = None  # cache the encoding that works, so files 2..N skip the trial


def _poll(operation_url, interval=2, timeout=300):
    waited = 0
    while True:
        r = requests.get(operation_url, headers=JSON_HEADERS)
        r.raise_for_status()
        body = r.json()
        status = str(body.get("status", "")).lower()
        if status in ("succeeded", "failed"):
            if status == "failed":
                raise RuntimeError(f"Operation failed: {json.dumps(body)[:600]}")
            return body
        time.sleep(interval)
        waited += interval
        if waited > timeout:
            raise TimeoutError("polling timed out")


def ensure_analyzer():
    with open(ANALYZER_FILE) as f:
        body = json.load(f)
    analyzer_id = body["analyzerId"]
    url = f"{ENDPOINT}/contentunderstanding/analyzers/{analyzer_id}?api-version={API_VERSION}"
    r = requests.put(url, headers=JSON_HEADERS, data=json.dumps(body))
    if r.status_code in (200, 201):
        op = r.headers.get("Operation-Location")
        if op:
            _poll(op)
    elif r.status_code == 409:
        pass
    else:
        raise RuntimeError(f"Create failed {r.status_code}: {r.text[:600]}")
    print(f"Analyzer ready: {analyzer_id}\n")
    return analyzer_id


def _readable(fields):
    """A successful read has real content; an accepted-but-garbage upload does not."""
    note = str((fields.get("annual_value_note") or (None,))[0] or "")
    if "not readable" in note.lower():
        return False
    return any((fields.get(k) or (None,))[0] for k in
               ("vendor", "client_name", "currency", "renewal_date", "annual_value"))


def analyze_pdf(analyzer_id, path):
    global _WORKING_METHOD
    url = f"{ENDPOINT}/contentunderstanding/analyzers/{analyzer_id}:analyzeBinary?api-version={API_VERSION}"
    raw = path.read_bytes()
    variants = [
        ("octet+raw", "application/octet-stream", raw),
        ("json+b64", "application/json", json.dumps(base64.b64encode(raw).decode()).encode()),
    ]
    if _WORKING_METHOD:
        variants.sort(key=lambda v: v[0] != _WORKING_METHOD)
    last = None
    for tag, ctype, body in variants:
        r = requests.post(url, headers={"Ocp-Apim-Subscription-Key": KEY, "Content-Type": ctype}, data=body)
        if r.status_code >= 400:
            last = f"{r.status_code}: {r.text[:200]}"
            continue
        result = _poll(r.headers.get("Operation-Location"))
        if _readable(read_fields(result)):
            _WORKING_METHOD = tag
            return result
        last = "accepted but content not readable"
    raise RuntimeError(f"{path.name} -> {last}")


def read_fields(result):
    out = {}
    try:
        contents = result["result"]["contents"]
    except (KeyError, TypeError):
        return out
    for content in contents:
        for name, f in content.get("fields", {}).items():
            value = (f.get("valueString") or f.get("valueNumber")
                     or f.get("valueDate") or f.get("valueInteger") or f.get("value"))
            out[name] = (value, f.get("confidence"))
    return out


def main():
    if not PDF_FOLDER.exists():
        print(f"PDF folder not found: {PDF_FOLDER}")
        return
    analyzer_id = ensure_analyzer()
    pdfs = sorted(PDF_FOLDER.glob("*.pdf"))
    if not pdfs:
        print(f"No PDFs found in {PDF_FOLDER}")
        return
    print(f"Found {len(pdfs)} PDF(s).\n")

    rows = []
    for path in pdfs:
        print(f"=== {path.name} ===")
        try:
            fields = read_fields(analyze_pdf(analyzer_id, path))
        except Exception as e:
            print(f"  ERROR: {e}\n")
            continue

        low_fields = [fld for fld in FIELDS
                      if isinstance(fields.get(fld, ("", None))[1], (int, float))
                      and fields[fld][1] < CONF_THRESHOLD]
        confs = [c for (_, c) in fields.values() if isinstance(c, (int, float))]
        if not confs:
            flag, review_fields = "review", "(no confidence data)"
        else:
            flag = "review" if low_fields else "clear"
            review_fields = ", ".join(low_fields)

        for fld in FIELDS:
            val, conf = fields.get(fld, ("", None))
            mark = "  <-- review" if fld in low_fields else ""
            print(f"  {fld:20} {str(val):<32.32} conf={conf}{mark}")
        print(f"  -> confidence_flag: {flag}  |  review_fields: {review_fields or '-'}\n")

        row = {"source_contract": path.name}
        for fld in FIELDS:
            row[fld] = fields.get(fld, ("", None))[0]
        row["confidence_flag"] = flag
        row["review_fields"] = review_fields
        rows.append(row)

    if rows:
        OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
        cols = ["source_contract"] + FIELDS + ["confidence_flag", "review_fields"]
        with open(OUT_CSV, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            w.writerows(rows)
        print(f"Wrote {len(rows)} rows to {OUT_CSV}")


if __name__ == "__main__":
    main()
