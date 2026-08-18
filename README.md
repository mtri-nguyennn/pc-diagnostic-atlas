# PC Diagnostic Atlas

A Node.js troubleshooting knowledge base with a Vercel serverless API and Supabase Postgres persistence.

## Included features

1. Six-layer family-tree navigation
2. Component pages
3. Searchable symptom database
4. Interactive diagnostic flow: Symptom → Hypothesis → ONE Test → Observe → YES/NO
5. Search across symptom, component, hypothesis, test and notes
6. Repair sessions with persisted diagnostic test history
7. Admin interface to add/edit diagnostic flows

The initial database is extracted from the six supplied `Layer_1.docx` … `Layer_6.docx` documents. The seed contains **122 indexed symptoms** and **117 standalone source-derived diagnostic flows**. Two taxonomy entries without a standalone flow in the source are explicitly marked `catalog-only` rather than being invented.

## Run

Requirements: Node.js 18 or newer, a Supabase Postgres database, and a `DATABASE_URL` environment variable.

```bash
cd pc-diagnostic-atlas
npm start
```

Open:

```text
http://localhost:4173
```

Use another port if needed:

```bash
PORT=8080 npm start
```

For local development, copy `.env.example` to `.env`, fill in the Supabase transaction-pooler URI, then load it before running `npm start`:

```bash
set -a
source .env
set +a
npm start
```

## Database

- `data/seed_db.json` — immutable source-derived baseline knowledge
- `data/db.json` — local migration input, including the current repair-session history
- `supabase/schema.sql` — Postgres schema
- `npm run db:seed` — creates the schema and imports `data/db.json` into Postgres

The running application reads and writes Postgres; it never mutates either JSON file. `npm run reset` only resets the local JSON migration input.

## Deploy to Vercel + Supabase

1. Create a Supabase project and open its SQL Editor.
2. Run the contents of `supabase/schema.sql` (optional if you run the seed command next).
3. From the Supabase **Connect** dialog, copy the **Transaction pooler** connection URI. This pooler mode is appropriate for Vercel serverless functions.
4. Set `DATABASE_URL` locally and run:

   ```bash
   npm install
   npm run db:seed
   ```

   The command imports `data/db.json`, so it preserves the existing local repair sessions. To import only the pristine source dataset instead, run `npm run db:seed data/seed_db.json`.
5. Import this Git repository into Vercel. Vercel serves `public/` and deploys the handlers in `api/` automatically.
6. In **Vercel → Project → Settings → Environment Variables**, add `DATABASE_URL` for Production, Preview, and Development, then deploy.

No API URL configuration is necessary: the frontend continues to call the same-origin `/api/...` endpoints.

### Security before a public launch

The existing Admin experience intentionally has no authentication. Do not publicly expose it yet: anyone who can reach the site can call the write endpoints. Add authentication and authorization around `POST /api/flows`, `PUT /api/flows/:id`, and the session write endpoints before enabling public access.

## Source extraction tool

`tools/build_seed_from_docx.py` reconstructs a seed database from six layer DOCX files. It requires Python and `python-docx`.

```bash
python tools/build_seed_from_docx.py Layer_1.docx Layer_2.docx Layer_3.docx Layer_4.docx Layer_5.docx Layer_6.docx data/seed_db.json
```

## Data model

The UI deliberately separates navigation taxonomy from diagnostic reasoning:

```text
Layer → Component → Symptom

Symptom → Hypothesis → ONE Test → Observe → Result branch → Repair → Verify
```

A repair session records each executed test/result as evidence instead of overwriting the diagnostic knowledge base.
