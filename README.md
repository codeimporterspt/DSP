# DSP BYD — Digital Service Passport

Sistema de registo de manutenção para viaturas BYD.

## Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS + Vite
- **Backend:** Node.js + Express + TypeScript + better-sqlite3
- **PDF:** pdfkit
- **Auth:** Mock (toggle de role na sidebar)

## Setup

### 1. Instalar dependências

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Arrancar

**Terminal 1 — Backend** (porta 3001):
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend** (porta 5173):
```bash
cd frontend
npm run dev
```

Abrir: http://localhost:5173

---

## Utilizadores Mock

Alternar role na sidebar (botões "Importador" / "Concess.") ou via URL:

- `http://localhost:5173?role=importador`
- `http://localhost:5173?role=concessionario`

| Role | Nome | Acesso |
|------|------|--------|
| `importador` | BYD Portugal | Tudo, incluindo Atualizar Viaturas |
| `concessionario` | M. & Costas Power | Pesquisa + Novo Registo |

---

## API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/vehicles/search?matricula=&vin=` | Pesquisa viatura |
| GET | `/api/vehicles` | Lista todas as viaturas |
| POST | `/api/vehicles/upsert-bulk` | Upsert em massa (JSON) |
| GET | `/api/dealers` | Lista concessionários |
| GET | `/api/dealers/:codigo` | Concessionário por código |
| GET | `/api/revisoes?matricula=&vin=&page=&limit=` | Pesquisa revisões paginada |
| POST | `/api/revisoes` | Criar revisão |
| PUT | `/api/revisoes/:id` | Editar revisão |
| DELETE | `/api/revisoes/:id` | Eliminar revisão |
| GET | `/api/revisoes/:vin/pdf` | Gerar PDF |
| GET | `/api/template` | Download template XLSX |
| POST | `/api/upload` | Upload XLSX/CSV de viaturas |

---

## Base de Dados

SQLite auto-inicializada em `backend/dsp_byd.db` na primeira execução, com dados de seed:

- 3 viaturas (2× EV, 1× PHEV)
- 3 concessionários (inclui M. & Costas Power - Braga, código 4711)
- 4 registos de serviço

O schema está preparado para migração para PostgreSQL (sem features SQLite-específicas além do `AUTOINCREMENT`).
