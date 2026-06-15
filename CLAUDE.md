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
cd backend && npm install --strict-ssl false
cd frontend && npm install --strict-ssl false
```
> `--strict-ssl false` is required — corporate network proxy uses a self-signed certificate.

### Reset the database
Delete `backend/dsp.db` — it will be recreated with seed data on the next backend start.

## Architecture

### Backend (`backend/src/`)

**Database layer** — `src/db/database.ts`
Uses `sql.js` (WebAssembly SQLite) — no native build tools required. The DB is loaded from `dsp.db` into memory at startup; `persist()` writes it back to disk after every `execute()` call. Query helpers: `queryAll`, `queryOne`, `execute` — all accept `SqlValue[]` params. Schema is created in `initSchema()`, seed data in `seedIfEmpty()` and `seedOperacoesIfEmpty()`.

**Schema migrations** — new columns on existing tables are added via `ALTER TABLE` wrapped in try/catch at the top of `initSchema()`, before the `CREATE TABLE IF NOT EXISTS` block. This handles both fresh and existing databases.

**Routes** — one file per resource, all mounted in `src/index.ts`:
- `vehicles.ts` — `GET /api/vehicles/search`, `GET /api/vehicles`, `POST /api/vehicles/upsert-bulk`
- `dealers.ts` — `GET /api/dealers`, `GET /api/dealers/:codigo`
- `services.ts` — CRUD on `revisoes` with JOIN to `concessoes` and `parque_circulante`
- `pdf.ts` — `GET /api/revisoes/:vin/pdf` — streams PDF via pdfkit
- `upload.ts` — `POST /api/upload` — multer + xlsx, upserts into `parque_circulante`; accepts `tipo_upload` field (Motordata / Novas Viaturas) in FormData
- `template.ts` — `GET /api/template` — streams sample XLSX download
- `operacoes.ts` — CRUD on `operacoes` and `tipos_operacao`:
  - `GET/POST/PUT/DELETE /api/operacoes`
  - `GET/POST/PUT/DELETE /api/tipos-operacao`

**Auth** — no real auth. Two hardcoded mock users in `frontend/src/context/AuthContext.tsx`. Role is persisted in `localStorage` and switchable via `?role=importador` or `?role=concessionario` URL param.

### Frontend (`frontend/src/`)

**Routing** — React Router v6, defined in `App.tsx`. All unknown routes redirect to `/pesquisa`. The `Layout` wrapper renders `<Sidebar>` alongside every page. `ImportadorOnly` guard redirects concessionários to `/pesquisa`.

**Routes:**
- `/pesquisa` — `Pesquisa.tsx`
- `/pesquisa/detalhe` — `DetalheRegisto.tsx` (receives record via `location.state`)
- `/novo-registo` — `NovoRegisto.tsx`
- `/atualizar-viaturas` — `AtualizarViaturas.tsx` (importador only)
- `/backoffice/operacoes` — `BackofficeOperacoes.tsx` (importador only)

**Pages:**
- `Pesquisa` — search by matrícula or VIN, paginated table, inline edit/delete, PDF download, row click navigates to `DetalheRegisto`
- `DetalheRegisto` — read-only detail view; data passed via React Router `location.state`
- `NovoRegisto` — 3-step wizard: (1) vehicle lookup, (2) dealer selection, (3) service data with motorização-dependent operation options (hardcoded `EV_OPTIONS` / `PHEV_OPTIONS`)
- `AtualizarViaturas` — drag-and-drop upload area; clicking opens a modal to select Tipo de Upload (Motordata / Novas Viaturas) and the file before submitting
- `BackofficeOperacoes` — CRUD table for `operacoes` with pagination; separate modal for `tipos_operacao` management

**Data model for operacoes/tipos:**
- `tipos_operacao`: `id`, `nome` (label e.g. PHEV/HEV), `intervalo_kms`, `ativo`, `created_at`
- `operacoes`: `id`, `codigo` (e.g. `15000/1Ano`), `tipo_id`, `ativo`, `observacoes`, `created_at`, `updated_at`
- `codigo` format is `{km}/{n}Ano(s)` — `formatCodigo()` in `BackofficeOperacoes.tsx` renders it as `15 000 Km / 1 Ano`

**Auth context** — `context/AuthContext.tsx` exposes `user` (role + nome + optional `codigo_concessao`) and `setRole`. The `concessionario` mock user is hardcoded to `codigo_concessao: '02412'`. Role-gating is done inline in components via `user.role`.

**Styling** — Tailwind CSS. Custom tokens in `tailwind.config.js`:
- `brand.primary` = `#111111`
- `brand.dark` = `#1a1a1a`

Shared utility classes (`btn-primary`, `btn-secondary`, `input-field`, `label`) are defined in `src/index.css`.

**API calls** — all frontend fetches use relative paths (`/api/...`). Vite proxies to `http://localhost:3001` in dev (`vite.config.ts`).

## Key Constraints

- `sql.js` keeps the entire DB in memory — not suitable for large datasets or concurrent writes. For production, replace the three helpers in `database.ts` with a PostgreSQL client.
- `execute()` calls `persist()` (synchronous disk write) after every mutation. Bulk inserts are slow for large files because they call `execute()` per row.
- EV operation options are hardcoded in `NovoRegisto.tsx` (`EV_OPTIONS` / `PHEV_OPTIONS`). The `operacoes` / `tipos_operacao` tables are used only in the backoffice, not yet wired into the wizard.
