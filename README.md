# SCF VA Dashboard

A very lightweight dashboard that surfaces the lead tracker, dossier links, and VA instructions for every prospect.

## Overview

- **Lead overview:** Shows every client, their offer, funnel, and the VA task associated with them.
- **Links:** Each row links to the lead tracker row and the dossier so the VA never has to hunt for context.
- **Supabase integration:** Live data now comes from Supabase so the dashboard always reflects the latest playbook.

## Data

- Leads are sourced from the `leads` table in Supabase (mirroring `client-outreach-plan.csv`).
- Playbook steps live in the `playbook_steps` table, which feeds the “Live playbook steps” section.
- The static JSON in `data/client-outreach-plan.json` remains as a fallback if Supabase is unavailable.

## Development

1. Run a simple HTTP server inside this directory to preview locally:
   ```bash
   cd scf-va-dashboard
   python3 -m http.server 8000
   ```
2. Point your browser to <http://localhost:8000> to see the dashboard.

## Deployment

This directory is published on Netlify at the SCF VA Dashboard site:
- https://scf-va-dashboard.netlify.app
- https://69bd6fccc469e379798408ee--scf-va-dashboard.netlify.app

Whenever you make changes:
1. Update the Supabase data if necessary.
2. Commit and push to `btc-scf/scf-va-dashboard`.
3. Netlify redeploys automatically.

## Supabase

Use the publishable API key to read the tables:<br>
`https://hvouvsqxoxukgoefpuok.supabase.co/rest/v1/leads`<br>
`https://hvouvsqxoxukgoefpuok.supabase.co/rest/v1/playbook_steps`

Keep the secret key safe—it's used here to insert data and can also seed new back-end services once we build them out.
