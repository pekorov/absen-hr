# Absen HR (Cloudflare Pages + Upstash)

Employees clock in from their phone browser (GPS + selfie). Admins review flagged
clock-ins, see today's attendance and import the weekly schedule from Excel.

## Folder layout
- public/index.html   employee app (open the site address)
- public/admin.html   admin page (/admin.html)
- functions/          the API (runs on Cloudflare, talks to Upstash)
- schedule-template.csv   example weekly schedule

## Deploy
1. Upload this whole folder to a GitHub repository (keep the folder structure).
2. Cloudflare dashboard > Workers & Pages > Create > Pages > Connect to Git > pick the repo.
3. Build settings: framework "None", build command empty, output directory `public`.
4. After the first deploy: project Settings > Variables and Secrets. Add 3 secrets:
   - UPSTASH_REDIS_REST_URL
   - UPSTASH_REDIS_REST_TOKEN
   - ADMIN_PASSWORD   (choose a long one)
5. Deploy again (Deployments > Retry) so the secrets take effect.

## First-time setup (admin.html)
1. Setup tab: check the shift codes and times, set the office location, Save.
2. Schedule tab: import the weekly file (see below).
3. Give each employee their name and PIN. They open the site address and sign in.

## Importing the weekly schedule
- Column A = Name, column B = PIN, then one column per date (7 for a week).
- Each cell = a shift code from the Setup tab (P, S, M ...) or OFF.
- Format the PIN column as Text so Excel keeps leading zeros.
- Importing again for the same dates replaces those days. New names are added.

## Notes
- Times use WIB (UTC+7). For WITA/WIT change TZ in functions/_lib.js.
- Browsers cannot detect fake GPS apps. The server checks office distance, GPS
  accuracy and impossible travel, and flags anything odd for review.
- Selfies are stored as small thumbnails in Upstash. Fine for a small team.
