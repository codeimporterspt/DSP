# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Quick start (from repo root)
```bash
npm run install:all   # install backend + frontend dependencies
npm run dev           # start both backend and frontend concurrently
npm run dev:backend   # backend only (port 3001)
npm run dev:frontend  # frontend only (port 5173)
```

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

### Install dependencies (per-package)
```bash
cd backend && npm install --strict-ssl false
cd frontend && npm install --strict-ssl false
```
> `--strict-ssl false` is required — corporate network proxy uses a self-signed certificate.

### Reset the database
Delete `backend/dsp.db` — it will be recreated with seed data on the next backend start.

## Architecture

### Backend (`backend/src/`)

**Database layer** — `src/db/database.ts`
Uses `sql.js` (WebAssembly SQLite) — no native build tools required. The DB is loaded from `dsp.db` into memory at startup; `persist()` writes it back to disk after every `execute()` call. Query helpers — all accept `SqlValue[]` params:
- `queryAll<T>` — returns all rows as `T[]`
- `queryOne<T>` — returns first row or `null`
- `execute` — runs a mutation and calls `persist()` (synchronous disk write) after; returns `{ lastInsertRowid, changes }`
- `executeNoPersist` — runs a mutation WITHOUT writing to disk; use for bulk operations
- `flushDb` — explicitly writes the in-memory DB to disk; call once after a batch of `executeNoPersist` calls

**Bulk import performance pattern**: for large CSV imports, pre-load all existing rows into a `Map` with one `queryAll`, loop with `executeNoPersist` per row, then call `flushDb()` once at the end. Calling `execute()` (which calls `persist()`) per row on large files will block the Node.js event loop and make the server unresponsive.

**Schema migrations** — new columns on existing tables are added via `ALTER TABLE` wrapped in `try/catch` at the top of `initSchema()`, before the `CREATE TABLE IF NOT EXISTS` block. This handles both fresh and existing databases. New tables need only `CREATE TABLE IF NOT EXISTS` — no migration entry needed.

**Routes** — one file per resource, all mounted in `src/index.ts`:
- `vehicles.ts` — `GET /api/vehicles/search`, `GET /api/vehicles`, `POST /api/vehicles/upsert-bulk`
- `dealers.ts` — `GET /api/dealers`, `GET /api/dealers/:codigo`
- `services.ts` — CRUD on `revisoes` with JOIN to `concessoes` and `parque_circulante`; `GET` response includes full vehicle and dealer fields. `DELETE /bulk` (body `{ ids: number[] }`) deletes multiple records in a single `WHERE id IN (...)` query and must be declared **before** `DELETE /:id` in the router. `POST /` validates: no duplicate `tipo_operacao` per VIN; new `quilometros` must exceed all existing records for that VIN.
- `pdf.ts` — `GET /api/revisoes/:vin/pdf` — streams PDF via pdfkit; header bar is dark grey with white title only (no logo/text in the corner). Services are ordered `data_servico DESC, quilometros DESC` (tiebreaker by km ensures the highest-mileage record wins when two share the same date). The "next maintenance" km is calculated as `min(actualKm, scheduledKm) + kmInterval`, where `scheduledKm` is parsed from `tipo_operacao` using `/(\d{1,3}(?:[.\s]\d{3})*)\s*Km/i` — this regex handles both `"30.000 Km"` (old seed format) and `"15 000 Km"` (backoffice `observacoes` format). The year interval comes from `tipos_operacao.ordem`.
- `upload.ts` — `POST /api/upload` (multer, 100 MB limit) + `GET /api/upload/history`. Branches on `tipo_upload` form field:
  - **`Novas Viaturas`**: reads XLSX via `xlsx`; expects columns Matrícula, VIN, Data de Matrícula, Modelo, Marca; upserts into `parque_circulante` preserving existing `motorizacao`.
  - **`Motordata`**: reads CSV encoded in **Windows-1252** (`buffer.toString('latin1')`), semicolon-delimited. Structure: line 1 = metadata/filters (logged, not imported); line 2 = empty; line 3 = column headers; lines 4–penultimate = data rows; last line = `Total (N Registos);;...` footer (N validated against processed count). Each line has a trailing `;` producing a phantom 26th column — discarded with `.slice(0, -1)`. Most fields are wrapped in Excel formula syntax `="VALUE"` — `cleanField()` strips this and converts empty strings to `null`. Date parsing handles `DD-MM-YYYY`, `DD/MM/YYYY`, and `YYYY-MM-DD`. The `#` prefix on `modelo` values is stripped. Uses the bulk import pattern (pre-load VIN map, `executeNoPersist` per row, single `flushDb`). A multer `ErrorRequestHandler` at the end of the router converts `MulterError` (e.g. file too large) to JSON instead of HTML.
  - Both handlers save a record to `historico_importacoes` after processing. `GET /api/upload/history` returns paginated history (`page`, `limit` query params; max 50 per page).
- `template.ts` — `GET /api/template` — streams sample XLSX download for Novas Viaturas format
- `operacoes.ts` — CRUD on `operacoes` and `tipos_operacao`:
  - `GET /api/operacoes?page&limit&tipo_id&ativo` — `tipo_id` and `ativo` are optional filters; `limit` max is 200
  - `POST/PUT/DELETE /api/operacoes`
  - `GET/POST/PUT/DELETE /api/tipos-operacao` — `tipos_operacao` has an `ordem` column (integer, year interval for next maintenance: PHEV=1, HEV=2); editable in the Backoffice UI
- Health check: `GET /api/health` → `{ status: 'ok' }`

CORS is restricted to `http://localhost:5173`.

### Database schema (key tables)

```
parque_circulante  — vin (UNIQUE), matricula (UNIQUE), data_matricula, modelo, marca, motorizacao CHECK('EV','PHEV')
concessoes         — codigo_concessao (UNIQUE), nome, cidade, codigo_postal, pais
revisoes           — vin, matricula, codigo_concessao, data_servico, quilometros, tipo_operacao, created_at
tipos_operacao     — nome (UNIQUE), intervalo_kms, ativo, ordem, created_at
operacoes          — codigo (UNIQUE), tipo_id → tipos_operacao, ativo, observacoes, created_at, updated_at
historico_importacoes — tipo, filename, inserted, updated, error_count (-1 = unknown), errors (JSON), warnings (JSON), meta_filters, created_at
```

`parque_circulante.motorizacao` has a `CHECK(motorizacao IN ('EV','PHEV'))` constraint and is **never overwritten** on upsert — it preserves the existing value or defaults to `'EV'` for new rows.

### Frontend (`frontend/src/`)

**Routing** — React Router v6, defined in `App.tsx`. All unknown routes redirect to `/pesquisa`. The `Layout` wrapper renders `<Sidebar>` alongside every page. `ImportadorOnly` guard redirects concessionários to `/pesquisa`.

**Routes:**
- `/pesquisa` — `Pesquisa.tsx`
- `/pesquisa/detalhe` — `DetalheRegisto.tsx` (receives record via `location.state`)
- `/novo-registo` — `NovoRegisto.tsx`
- `/atualizar-viaturas` — `AtualizarViaturas.tsx` (importador only)
- `/backoffice/operacoes` — `BackofficeOperacoes.tsx` (importador only)

**Pages:**
- `Pesquisa` — search by matrícula or VIN, paginated table, inline edit/delete, bulk delete (checkbox selection + confirmation modal), PDF download, row click navigates to `DetalheRegisto`. Permission helper `canDelete(r)` gates both the individual delete button and the bulk-select checkbox: importador can delete all; concessionário can only delete records where `codigo_concessao === user.codigo_concessao`.
- `DetalheRegisto` — read-only detail view; data passed via React Router `location.state`
- `NovoRegisto` — 3-step wizard: (1) vehicle lookup, (2) dealer selection, (3) service data. In step 2, concessionários auto-select their own dealer via `GET /api/dealers/:codigo` and skip the dropdown. On reaching step 3, the wizard fetches `/api/tipos-operacao` to find the `tipo_id` whose `intervalo_kms` matches the vehicle's motorizacao (EV→30 000, PHEV→15 000), then fetches `/api/operacoes?tipo_id=X&ativo=1` to populate the operation dropdown. The stored `tipo_operacao` value is `operacoes.observacoes`.
- `AtualizarViaturas` — drag-and-drop upload area; clicking opens a modal to select Tipo de Upload (Motordata / Novas Viaturas) and the file. The modal shows the XLSX template download link only when Novas Viaturas is selected. File `accept` attribute switches between `.csv,.txt` (Motordata) and `.xlsx,.csv` (Novas Viaturas). Below the upload area, a **Histórico de Importações** table shows past imports (paginated, 10/page) with expandable rows for errors and warnings; `error_count = -1` displays as "—" (used for imports recorded before the history feature existed).
- `BackofficeOperacoes` — CRUD table for `operacoes` with pagination; separate modal for `tipos_operacao` management

**Data model for operacoes/tipos:**
- `tipos_operacao`: `id`, `nome` (label e.g. PHEV/HEV), `intervalo_kms`, `ativo`, `ordem`, `created_at`
- `operacoes`: `id`, `codigo` (e.g. `15000/1Ano`), `tipo_id`, `ativo`, `observacoes`, `created_at`, `updated_at`
- `codigo` format is `{km}/{n}Ano(s)` — `formatCodigo()` in `BackofficeOperacoes.tsx` renders it as `15 000 Km / 1 Ano`

**Auth context** — `context/AuthContext.tsx` exposes `user` (role + nome + optional `codigo_concessao`) and `setRole`. Role is persisted in `localStorage` and switchable via `?role=importador` or `?role=concessionario` URL param, or via the toggle in the sidebar.

Mock users (both named "Utilizador 1"):
- `importador` — full access, no `codigo_concessao`
- `concessionario` — hardcoded to `codigo_concessao: '02412'` (Caetano, S.A., Maia); restricted to Pesquisa + Novo Registo on own concessão; no access to Atualizar Viaturas or Backoffice

Role-gating is done inline in components via `user.role`. `ImportadorOnly` wrapper in `App.tsx` enforces route-level access.

**Styling** — Tailwind CSS. Custom tokens in `tailwind.config.js`:
- `brand.primary` = `#111111`
- `brand.dark` = `#1a1a1a`

Shared utility classes (`btn-primary`, `btn-secondary`, `input-field`, `label`) are defined in `src/index.css`.

**API calls** — all frontend fetches use relative paths (`/api/...`). Vite proxies to `http://localhost:3001` in dev (`vite.config.ts`).

## Key Constraints

- `sql.js` keeps the entire DB in memory — not suitable for large datasets or concurrent writes. For production, replace the three helpers in `database.ts` with a PostgreSQL client.
- `execute()` calls `persist()` (synchronous disk write) after every mutation. **Never call `execute()` in a loop over large datasets** — use `executeNoPersist()` + `flushDb()` instead. One `persist()` per bulk operation.
- The motorizacao→tipo mapping in `NovoRegisto` is implicit: EV vehicles fetch the `tipos_operacao` row where `intervalo_kms = 30000`, PHEV where `intervalo_kms = 15000`. If new tipos are added with different intervals, the wizard won't pick them up automatically.
- `parque_circulante.motorizacao` has a `CHECK(motorizacao IN ('EV','PHEV'))` constraint. The upload route never sets it on update, so changing a vehicle's motorização requires a manual DB edit or a dedicated endpoint.
- Motordata CSV files are **Windows-1252 encoded**. Decode with `buffer.toString('latin1')` — this correctly maps all Portuguese characters (ã, õ, ç, º, etc.) which live in the ≥0xA0 byte range, identical in both encodings. Do not attempt UTF-8 decoding.
