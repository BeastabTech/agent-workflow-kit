---
name: timezones-i18n
description: Get dates, times, time zones, locales, currencies and units right for users in many countries - store UTC, compute "today" in the user's zone, local-day ranges for history and reports, cron and reminders per user zone, DST, formatting and translations. Use whenever a change touches dates, daily logs, streaks, schedules, reports, prices or user-facing text for several regions.
---

# Time zones and localisation

## Rules
1. **Store instants in UTC** (`timestamptz` / ISO 8601 with `Z`). Store the user's IANA zone (`Europe/Berlin`, `America/New_York`), never an offset.
2. **"Today" belongs to the user.** Convert the user's local date to UTC boundaries for queries: `[localMidnight(date, tz), localMidnight(date + 1, tz))`. Never compare raw UTC date strings for "same day".
3. **Date-only values** (birthday, log date, due date) are dates, not instants: store `date` or `YYYY-MM-DD`, do not run them through the browser's time zone.
4. **Never assume the server's zone** or one country. Read the zone from the user (or the entity: store, branch, event venue).
5. **Crons and reminders**: run often (for example every 15 minutes) and pick the users whose local time matches, or schedule per user in their zone. Take a lock if several instances run.
6. **DST**: some local days are 23 or 25 hours; some local times do not exist or happen twice. Use a real library (`Temporal`, `date-fns-tz`, `Luxon`, `zoneinfo`, `java.time`), never `+ 24h` arithmetic for "next day".
7. **Reuse the project's helpers.** Search for existing zone helpers before writing new date logic and add them to `docs/context/` if missing.
8. **Money**: integer minor units plus currency code; format with `Intl.NumberFormat(locale, { style: 'currency', currency })`. Never float money.
9. **Formatting**: `Intl.DateTimeFormat` / `toLocaleString` with the user's locale and zone; show the zone when it can be ambiguous.
10. **Text**: keep user-facing strings in translation files when the product supports more than one language; no string concatenation for sentences; plan for longer text and right-to-left.
11. **Units**: store one canonical unit (metric), convert for display by user preference.

## Tests
Every date change gets at least one non-UTC case, one zone far from the server (for example UTC+5:30 and UTC−8), a DST boundary, and a "just before / just after local midnight" case.
