# DSP — Digital Service Passport

Sistema de registo de manutenção para viaturas.

## Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS + Vite
- **Backend:** Node.js + Express + TypeScript + sql.js (SQLite via WebAssembly)
- **PDF:** pdfkit
- **Auth:** Mock (toggle de role na sidebar)

## Setup

### 1. Instalar dependências

```bash
cd backend && npm install --strict-ssl false
cd ../frontend && npm install --strict-ssl false
```

> `--strict-ssl false` é necessário em redes corporativas com proxy de certificado auto-assinado.

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
| `importador` | Importador | Tudo: Pesquisa, Novo Registo, Atualizar Viaturas, Backoffice Operações |
| `concessionario` | M. & Costas Power (código 02412) | Pesquisa + Novo Registo (apenas na própria concessão) |

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
| POST | `/api/upload` | Upload XLSX de viaturas (campo `tipo_upload`: `Motordata` ou `Novas Viaturas`) |
| GET | `/api/operacoes` | Lista operações |
| POST | `/api/operacoes` | Criar operação |
| PUT | `/api/operacoes/:id` | Editar operação |
| DELETE | `/api/operacoes/:id` | Eliminar operação |
| GET | `/api/tipos-operacao` | Lista tipos de operação |
| POST | `/api/tipos-operacao` | Criar tipo de operação |
| PUT | `/api/tipos-operacao/:id` | Editar tipo de operação |
| DELETE | `/api/tipos-operacao/:id` | Eliminar tipo de operação |

---

## Base de Dados

SQLite (via `sql.js`) auto-inicializada em `backend/dsp.db` na primeira execução, com dados de seed. Para repor a base de dados, apagar o ficheiro `dsp.db` — é recriado no próximo arranque.

Tabelas principais: `parque_circulante`, `concessoes`, `revisoes`, `operacoes`, `tipos_operacao`.

> **Nota:** `sql.js` carrega a BD inteira em memória — não adequado para grandes volumes ou escritas concorrentes. Para produção, substituir os helpers em `database.ts` por um cliente PostgreSQL.
