# AMCS milk-collection sync

Pulls our milk collections from the society's AMCS server (the one the **Member AMCS** phone app
talks to) and imports them into the dairy app:

- every pour is stored in `amcs_collections` (litres, FAT, SNF, CLR, rate, amount, whether quality
  and litres were read by the machine or keyed in by hand);
- one `MilkDispatch` per date + shift is created for the customer **Milking Society T.DASARAHALLI**
  (the society that buys the milk for KMF Nandini), and the day's `MILK_SALES` income is
  recalculated, so the dashboard shows what the society actually paid;
- Production History shows FAT / SNF / CLR under each shift with an **A** (machine) or **M**
  (keyed in by hand) badge.

Imports are idempotent: rows match on member + date + shift + sample no, so re-fetching an
overlapping range updates rows instead of duplicating them.

## The backend does it (recommended)

The Sthirvaa backend fetches from AMCS itself at **10:00** (after the morning collection) and
**19:45** (after the evening one), Asia/Kolkata, re-reading the last 7 days each time so a missed
run or a late correction is picked up. Nothing runs on the phone.

Set these environment variables on the **server** (never in `application.properties`, never in git):

| Variable | Value |
|---|---|
| `AMCS_SYNC_ENABLED` | `true` (default `false`) |
| `AMCS_TOKEN` | `token` from the Member AMCS request body |
| `AMCS_DEVICE_ID` | `deviceId` |
| `AMCS_IDENTITY_CODE` | `identityCode` |
| `AMCS_IMEI` | `imei` |
| `AMCS_MEMBER_CODE` | `memberCode` |
| `AMCS_CUSTOMER_NAME` | optional; default `Milking Society T.DASARAHALLI` |
| `AMCS_SYNC_DAYS_BACK` | optional; default `7` |

The job also requires `app.scheduler.enabled` (`SCHEDULER_ENABLED`) to be on, the same switch as the
chore reminders, so a laptop backend that shares the production database (`run-backend.bat` sets
`SCHEDULER_ENABLED=false`) never runs it.

**Check a deployment:** log in as an admin and call `POST /api/amcs/sync?days=7`. It runs the
same fetch + import now and returns the counts. If AMCS rejects the token you get HTTP 502 with
`"tokenRejected": true` (never 401, which the UI treats as "logged out").

**When it fails:** if AMCS rejects the token, the admins get a push notification (at most once a
day); three failed runs in a row for any other reason do the same. Nothing is imported and nothing
is lost - refresh the credentials and call `POST /api/amcs/sync?days=31` to catch up.

**Dates already dispatched by hand are not touched.** The Distribute screen stores `COMBINED` rows
for the same customer, so for any date where that customer already has such rows the AMCS data is
still stored, but no second dispatch is added and that day's income is left alone. The import
reply lists these in `datesSkippedManualDispatch`.

## Refreshing the token

The token lives inside the request body the app sends (the AMCS server uses plain HTTP, there is no
auth header). To read it again:

1. Install **Reqable** on the phone, start capture, open Member AMCS and load any screen.
2. Open the `collection-data` request -> Raw -> save it and copy the JSON body fields `token`,
   `deviceId`, `identityCode`, `imei`, `memberCode` into the server's environment variables.
3. Stop the capture and delete the saved request.

Treat the token like a password: whoever has it can read your milk data.

## The standalone script (alternative)

`amcs_sync.py` does the same fetch from any machine and posts to the backend's
`POST /api/amcs/import`. Use it only if the server cannot reach AMCS. Needs Python 3.8+, no packages.

```
python amcs_sync.py --days 31 --dry-run   # fetch and report, send nothing
python amcs_sync.py --limit 1             # import only the most recent pour (first test)
python amcs_sync.py                       # last 7 days
```

It reads `~/.amcs/credentials.json` (copy `credentials.example.json`) and the environment
variables `DAIRY_API_URL`, `DAIRY_USER`, `DAIRY_PASSWORD`. Exit codes: 0 ok | 1 config | 2 AMCS
rejected the token | 3 AMCS unreachable | 4 dairy app login/import failed.

Take a database backup before the first real import (`mysqldump` of `milk_dispatches`, `income`,
`customers`, `amcs_collections`).
