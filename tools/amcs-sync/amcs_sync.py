#!/usr/bin/env python3
"""Pull our milk collections from the society's AMCS server and import them into the dairy app.

    python amcs_sync.py              # last 7 days
    python amcs_sync.py --days 31    # backfill a month
    python amcs_sync.py --dry-run    # fetch and report, do not touch the dairy app
    python amcs_sync.py --limit 1    # import only the most recent pour (for a first test)

Safe to run as often as you like: the dairy app matches rows on member + date + shift + sample
number, so overlapping date ranges update rows instead of duplicating them.

Configuration (environment variables, nothing secret lives in this file):
    AMCS_CREDENTIALS   path to the AMCS credentials JSON   (default ~/.amcs/credentials.json)
    DAIRY_API_URL      dairy backend base URL              (default http://localhost:8080)
    DAIRY_USER         dairy login used for the import
    DAIRY_PASSWORD     its password

Exit codes: 0 ok | 1 bad usage/config | 2 AMCS rejected us (token probably expired) |
            3 AMCS unreachable | 4 dairy app login/import failed
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

AMCS_URL = "http://bamul.amcs.coop/webservice/v4/collection/collection-data"
REQUIRED_KEYS = ("token", "deviceId", "identityCode", "imei", "memberCode")


def log(msg):
    print(f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}", flush=True)


def load_credentials():
    path = Path(os.environ.get("AMCS_CREDENTIALS", Path.home() / ".amcs" / "credentials.json"))
    try:
        creds = json.loads(path.read_text(encoding="utf-8-sig"))  # tolerate a Windows BOM
    except FileNotFoundError:
        log(f"AMCS credentials file not found: {path} (see README.md)")
        sys.exit(1)
    except ValueError as ex:
        log(f"AMCS credentials file is not valid JSON: {path}: {ex}")
        sys.exit(1)
    missing = [k for k in REQUIRED_KEYS if not creds.get(k)]
    if missing:
        log(f"AMCS credentials file {path} is missing: {', '.join(missing)}")
        sys.exit(1)
    creds.setdefault("type", "1")
    return creds


def post_json(url, payload, content_type, headers=None, timeout=60):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": content_type, **(headers or {})},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_amcs(creds, start, end):
    # The AMCS server expects exactly this body (captured from the member app). The login
    # identity travels in the body; there is no auth header.
    body = {
        "content": {
            "fromDate": f"{start:%Y-%m-%d} 00:00:00.000000",
            "toDate": f"{end:%Y-%m-%d} 23:59:59.000000",
        },
        "deviceId": creds["deviceId"],
        "identityCode": creds["identityCode"],
        "imei": creds["imei"],
        "memberCode": creds["memberCode"],
        "requestTime": f"{date.today():%Y-%m-%d}",
        "token": creds["token"],
        "type": str(creds["type"]),
    }
    try:
        reply = post_json(AMCS_URL, body, "text/x-markdown; charset=utf-8")
    except urllib.error.HTTPError as ex:
        log(f"AMCS answered HTTP {ex.code}")
        sys.exit(2 if ex.code in (401, 403) else 3)
    except (urllib.error.URLError, TimeoutError, ValueError) as ex:
        log(f"AMCS unreachable or sent something unreadable: {ex}")
        sys.exit(3)

    error = reply.get("error") or {}
    if reply.get("status") != "success" or error.get("code") not in (200, None):
        log(f"AMCS refused the request: status={reply.get('status')!r} error={error!r}")
        log("The login token has probably expired. Re-capture the credentials (README.md).")
        sys.exit(2)

    data = reply.get("data")
    if data in ("", None, {}):
        return []  # AMCS sends an empty string when the range has no collections
    if not isinstance(data, list):
        log(f"Unexpected AMCS data shape: {type(data).__name__}")
        sys.exit(2)
    return data


def import_to_dairy(rows):
    base = os.environ.get("DAIRY_API_URL", "http://localhost:8080").rstrip("/")
    user, password = os.environ.get("DAIRY_USER"), os.environ.get("DAIRY_PASSWORD")
    if not user or not password:
        log("Set DAIRY_USER and DAIRY_PASSWORD (or use --dry-run).")
        sys.exit(1)
    try:
        auth = post_json(f"{base}/api/auth/login", {"username": user, "password": password},
                         "application/json")
        summary = post_json(f"{base}/api/amcs/import", rows, "application/json",
                            headers={"Authorization": f"Bearer {auth['token']}"})
    except (urllib.error.URLError, TimeoutError, KeyError, ValueError) as ex:
        detail = ex.read().decode("utf-8", "replace")[:300] if isinstance(ex, urllib.error.HTTPError) else ex
        log(f"Dairy app import failed: {detail}")
        sys.exit(4)
    return summary


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--days", type=int, default=7, help="how many days back to fetch (default 7)")
    ap.add_argument("--dry-run", action="store_true", help="fetch and report only")
    ap.add_argument("--limit", type=int, default=0,
                    help="import only the N most recent pours (default: all fetched)")
    args = ap.parse_args()
    if args.days < 1:
        log("--days must be at least 1")
        sys.exit(1)

    end = date.today()
    start = end - timedelta(days=args.days - 1)
    creds = load_credentials()

    rows = fetch_amcs(creds, start, end)
    if args.limit > 0:
        rows = sorted(rows, key=lambda r: (r.get("collectionDate") or ""))[-args.limit:]
        log(f"--limit {args.limit}: keeping only the most recent {len(rows)} row(s)")
    litres = sum(float(r.get("quantity") or 0) for r in rows)
    amount = sum(float(r.get("amount") or 0) for r in rows)
    log(f"AMCS {start} .. {end}: {len(rows)} rows, {litres:.1f} L, Rs {amount:.0f}")

    if args.dry_run:
        log("dry run - nothing sent to the dairy app")
        return
    if not rows:
        log("nothing to import")
        return

    summary = import_to_dairy(rows)
    log(f"Dairy import: {json.dumps(summary)}")
    if summary.get("rejected"):
        log("Some rows were rejected - see 'rejected' above")


if __name__ == "__main__":
    main()
