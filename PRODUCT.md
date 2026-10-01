# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + TypeScript, deployed on Vercel. No database: the source sheet is public ("anyone with the link can view"), so a cached server route reads Google's export directly. Supabase was considered and is not needed for the current scope.

## Users

Staff of the Vita4you pharmacy on Tsimiski (Thessaloniki). Each employee opens the site **on their phone** to check their own week: which shift each day, which day is their ρεπό, and whether they work Sunday. They check it on the go, between shifts, often in a hurry. The rota manager may also open the whole-team view, but staff-on-mobile is the primary scene.

## Product Purpose

Turn the shared rota spreadsheet ("ΠΡΟΓΡΑΜΜΑ ΤΣΙΜΙΣΚΗ νεο", Google Sheets) into a personal weekly schedule. Pick your name once, see this week laid out day by day. Success: an employee answers "when do I work this week, when is my day off, do I work Sunday?" in under five seconds without scanning the whole sheet.

## Positioning

The sheet is the single source of truth and stays that way. Nobody re-enters data. The site reads the sheet as-is, untangles its inconsistencies (mixed date formats, spelling variants of names, inline time overrides), and shows one person's week.

## Operating Context

- The rota manager edits the sheet in Google Sheets and appends a new weekly block below the previous one (Sheet2). Each block has a weekday header row (Δευτέρα…Κυριακή), a date row, then one row per shift slot. Names sit in the weekday columns, the shift time sits in column H, and notes sit in column I (ΕΦΗΜΕΡΙΑ, ΟΛΟΝΥΧΤΙΑ, ΛΟΓΩ ΚΥΡΙΑΚΗΣ, αναρρωτική…).
- Special rows: `ρεπο` (day off), `ΑΔΕΙΑ` (leave), `ΓΟΝΙΚΗ ΑΔΕΙΑ` (parental leave).
- Pharmacy duty: `εφημερία` (on-duty evening/night) and `ολονυχτία` (all-night) shifts, including on weekends.
- The next week is usually published mid-week, so staff look ahead as well as at the current week.
- The sheet changes during the week; staff need to know whether what they see is up to date.

## Capabilities and Constraints

- Language: Greek UI. Names and notes are shown as written in the sheet (after normalization).
- Name list: only current staff (people appearing in recent weeks); spelling variants are merged into one person.
- Default view: the current week (Europe/Athens), with previous/next week navigation.
- Per-day: shift time(s), notes (εφημερία etc.), day off, leave, and coworkers on the same shift.
- Week summary: day off(s), Sunday status, total scheduled hours.
- Refresh button: re-reads the sheet and reports whether anything changed.
- Add to phone calendar: download the week as `.ics`.
- Whole-team week view: a cleaned-up rendering of the week for everyone.
- Remember the last selected name on the device.
- Access: anyone with the link, no login; hidden from search engines.
- The sheet's data quality is low and will stay low. Parsing must tolerate typos and never crash on a malformed block.

## Brand Commitments

- Name: "Vita4you Τσιμισκή" with the product named "Πρόγραμμα". No official Vita4you logo or brand colors are used. The site has its own look.
- Standing visual preference (chosen by the user over an assigned concept direction): the **category standard, played straight**. A familiar staff-scheduling app with no metaphor and no smuggled quirk. Craft bar: purpose-built shift apps (Deputy, When I Work) for the rota content, and Apple Calendar / iOS for calm, native-feeling polish.

## Evidence on Hand

- The real spreadsheet (public): `1nHy_toJCbpsnTEE1aVXvF4YqZnhcmB5ay-rMPvTQs2c`, Sheet2 holding ~54 weekly blocks from 29/09/2025 onward.
- A snapshot export is kept as a test fixture for the parser.
- No logo, photography, or testimonials. Don't fabricate any.

## Product Principles

1. **The answer first.** Today and this week's shape are visible before any chrome.
2. **The sheet is the truth.** Never invent data. When the sheet is ambiguous, say so instead of guessing silently.
3. **One-handed, on the move.** Every primary action is reachable with a thumb on a phone.
4. **Trust through freshness.** Always show when the data was last read and whether it changed.

## Accessibility & Inclusion

WCAG 2.2 AA contrast. Fully usable by keyboard. Respects reduced motion. Greek text needs fonts with full Greek glyph coverage (including accented capitals).
