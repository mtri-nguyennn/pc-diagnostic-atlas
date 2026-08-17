# PC Diagnostic Atlas

A dependency-free Node.js prototype for a six-layer computer troubleshooting knowledge base.

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

Requirements: Node.js 18 or newer. No npm packages are required.

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

## Database

- `data/seed_db.json` — immutable source-derived seed for this prototype
- `data/db.json` — runtime JSON database; Admin edits and repair sessions are persisted here
- `npm run reset` — reset `db.json` back to the source seed

For a production deployment, replace the JSON store with PostgreSQL/SQLite, add authentication/roles to Admin, validate and moderate user submissions, add audit/version history, and use atomic backups.

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
