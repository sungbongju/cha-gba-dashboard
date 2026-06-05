# CHA GBA // Research Telemetry

A token-free, real-time dashboard for the **CHA Global Business AI** assistant —
trust-survey results + usage analytics. Cyber-brutalist React + Vite, deployed on
Vercel.

## How it works

```
browser ──▶ /api/stats (Vercel fn) ──▶ aiforalab.com/globalbiz-api/globalbiz-api.php
            (holds DASHBOARD_TOKEN)      survey_summary + usage_summary
```

- The school-server summary endpoints are **token-gated**. The `/api/stats`
  serverless function holds that token **server-side** and exposes a single
  merged, **PII-stripped** payload (personal names removed → `USER#id`).
- Viewers need **no token** — the page is fully public, aggregate-only.
- Front-end polls `/api/stats` every 10 s for a live feed.

## Deploy (Vercel)

1. Import this repo into Vercel (framework preset: **Vite**).
2. Add **Environment Variables**:
   - `DASHBOARD_TOKEN` = the school server's `CHA_DASHBOARD_TOKEN` value (required)
   - `SCHOOL_API_BASE` = `https://aiforalab.com/globalbiz-api/globalbiz-api.php` (optional; this is the default)
3. Deploy. Done.

## Local dev

```bash
npm install
npm run dev      # uses built-in MOCK data (no token needed) for visual work
```

`npm run dev` can't run the serverless function, so it falls back to bundled mock
data. The real data only flows on the Vercel deployment (or via `vercel dev`).

## Privacy

Only aggregates and anonymised handles are exposed. No emails, no real names, no
raw IPs, no message contents.
