# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (port 3001)
```bash
cd backend
npm run dev        # ts-node-dev with hot reload
npm run build      # compile to dist/
```

### Frontend (port 5173)
```bash
cd frontend
npm run dev        # Vite dev server
npm run build      # tsc + vite build
```

### Install dependencies
```bash
cd backend && npm install --strict-ssl false   # corporate proxy requires SSL bypass
cd frontend && npm install --strict-ssl false
```

> `--strict-ssl false` is required due to a self-signed certificate in the corporate network proxy.

### Reset the database
Delete `backend/dsp.db` — it will be recreated with seed data on the next backend start.

## Architecture

### Backend (`backend/src/`)

**Database layer** — `src/db/database.ts`  
Uses `sql.js` (WebAssembly SQLite) instead of `better-sqlite3` because the machine has no C++ build tools (no Python/MSBuild). The DB is loaded from `dsp.db` on disk into memory at startup, and `persist()` writes it back to disk after every `execute()` call. All query helpers (`queryAll`, `queryOne`, `execute`) accept `SqlValue[]` params — do not pass `unknown[]` directly or TypeScript will error.

**Routes** — one file per resource:
- `vehicles.ts` — `GET /api/vehicles/search`, `GET /api/vehicles`, `POST /api/vehicles/upsert-bulk`
- `dealers.ts` — `GET /api/dealers`, `GET /api/dealers/:codigo`
- `services.ts` — CRUD on `revisoes` with JOIN to `concessoes` and `parque_circulante`
- `pdf.ts` — `GET /api/revisoes/:vin/pdf` — generates PDF with pdfkit, streams directly to response
- `upload.ts` — `POST /api/upload` — multer + xlsx parses XLSX/CSV, upserts into `parque_circulante`
- `template.ts` — `GET /api/template` — streams a sample XLSX download

**Auth** — there is no real auth. Two hardcoded mock users live in `frontend/src/context/AuthContext.tsx`. Role is persisted in `localStorage` and can be set via `?role=importador` or `?role=concessionario` URL param.

### Frontend (`frontend/src/`)

**Routing** — React Router v6. All unknown routes redirect to `/pesquisa`. The `Layout` wrapper in `App.tsx` renders `<Sidebar>` alongside every page.

**Auth context** — `context/AuthContext.tsx` exposes `user` (role + nome + optional `codigo_concessao`) and `setRole`. The `concessionario` mock user is hardcoded to `codigo_concessao: '4711'`. Role-gating (e.g. hiding "Atualizar Viaturas") is done inline in components by reading `user.role`.

**Pages:**
- `Pesquisa` — search by matrícula or VIN, paginated results table, inline edit/delete rows, PDF download trigger
- `NovoRegisto` — 3-step wizard: (1) vehicle lookup, (2) dealer selection (dropdown for importador, read-only for concessionario), (3) service data with motorização-dependent operation options
- `AtualizarViaturas` — drag-and-drop file upload (importador only); shows insert/update/error summary

**Styling** — Tailwind CSS. Custom tokens defined in `tailwind.config.js`:
- `brand.primary` = `#111111` (primary action colour — black)
- `brand.dark` = `#1a1a1a` (text/header colour)

Shared utility classes (`btn-primary`, `btn-secondary`, `input-field`, `label`) are defined in `src/index.css`.

**API calls** — all frontend fetch calls use relative paths (`/api/...`). Vite proxies them to `http://localhost:3001` in dev (configured in `vite.config.ts`).

## Key Constraints

- `sql.js` keeps the entire DB in memory — not suitable for large datasets or concurrent writes in production. For production, migrate to PostgreSQL by replacing the three helpers in `database.ts`.
- The `execute()` helper calls `persist()` (disk write) synchronously after every mutation. Batch inserts (e.g. bulk upload) call `execute()` per row, which is slow for large files.
- EV service intervals are multiples of 24 months/30 000 km; PHEV are multiples of 12 months/15 000 km. These option lists are hardcoded in `NovoRegisto.tsx`.
