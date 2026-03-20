# SCF VA Dashboard

A very lightweight dashboard that surfaces the lead tracker, dossier links, and VA instructions for every prospect.

## Overview

- **Lead overview:** Shows every client, their offer, funnel, and the VA task associated with them.
- **Links:** Each row links to the lead tracker row and the dossier so the VA never has to hunt for context.
- **Quick tips:** The page summarizes the three-step workflow for reaching out.

## Data

- The table is sourced from `data/client-outreach-plan.json`, which is exported from `client-outreach-plan.csv` in the workspace.
- Whenever the CSV is updated in the repository, run the JSON export script to keep the dashboard in sync.

## Development

1. Run a simple HTTP server inside this directory to preview locally:
   ```bash
   cd scf-va-dashboard
   python3 -m http.server 8000
   ```
2. Point your browser to <http://localhost:8000> to see the dashboard.

## Deployment

This directory is published on Netlify at the SCF VA Dashboard site. After editing any HTML/CSS/JS:

1. Commit your changes.
2. Push to the `btc-scf/scf-va-dashboard` repository (Set `GIT_HTTP_EXTRA_HEADER="AUTHORIZATION: bearer $(cat /tmp/gh_token)" git push`).
3. Netlify redeploys automatically.

## Future work

- Connect to Supabase or another backend so that the dashboard can show live status updates and VA notes.
- Move this into the planned web app once the backend arrives.
