# DSP — Digital Service Passport

Sistema de registo de manutenção para viaturas.

## Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS + Vite
- **Backend:** Node.js + Express + TypeScript + sql.js (SQLite via WebAssembly)
- **PDF:** pdfkit
- **Auth:** Mock (toggle de role na sidebar)

## Setup

### Opção A — Scripts da raiz (recomendado)

```bash
# 1. Instalar dependências
npm run install:all

# 2. Arrancar backend e frontend em paralelo
npm run dev
```

### Opção B — Terminais separados

```bash
cd backend && npm install --strict-ssl false
cd ../frontend && npm install --strict-ssl false
```

> `--strict-ssl false` é necessário em redes corporativas com proxy de certificado auto-assinado.

**Terminal 1 — Backend** (porta 3001):
```bash
cd backend && npm run dev
```

**Terminal 2 — Frontend** (porta 5173):
```bash
cd frontend && npm run dev
```

Abrir: http://localhost:5173

---

## Utilizadores Mock

Alternar role na sidebar (botões "Importador" / "Concess.") ou via URL:

- `http://localhost:5173?role=importador`
- `http://localhost:5173?role=concessionario`

| Role | Acesso |
|------|--------|
| `importador` | Tudo: Pesquisa, Novo Registo, Atualizar Viaturas, Backoffice Operações |
| `concessionario` (Caetano, S.A. — código 02412) | Pesquisa + Novo Registo apenas na própria concessão |

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
| DELETE | `/api/revisoes/bulk` | Eliminar múltiplas revisões (body `{ ids: number[] }`) |
| DELETE | `/api/revisoes/:id` | Eliminar revisão |
| GET | `/api/revisoes/:vin/pdf` | Gerar PDF |
| GET | `/api/template` | Download template XLSX (formato Novas Viaturas) |
| POST | `/api/upload` | Upload de viaturas — campo `tipo_upload`: `Motordata` ou `Novas Viaturas` |
| GET | `/api/upload/history` | Histórico de importações paginado (`?page=&limit=`) |
| GET | `/api/operacoes` | Lista operações |
| POST | `/api/operacoes` | Criar operação |
| PUT | `/api/operacoes/:id` | Editar operação |
| DELETE | `/api/operacoes/:id` | Eliminar operação |
| GET | `/api/tipos-operacao` | Lista tipos de operação |
| POST | `/api/tipos-operacao` | Criar tipo de operação |
| PUT | `/api/tipos-operacao/:id` | Editar tipo de operação |
| DELETE | `/api/tipos-operacao/:id` | Eliminar tipo de operação |
| GET | `/api/health` | Health check (`{ status: 'ok' }`) |

---

## Upload de Viaturas

### Novas Viaturas (XLSX)

Ficheiro `.xlsx` com colunas: `Matrícula`, `VIN`, `Data de Matrícula`, `Modelo`, `Marca`. Descarregar template em `/api/template`.

### Motordata (CSV)

Exportação direta do Motordata. Especificações do formato:

- **Encoding:** Windows-1252 / ISO-8859-1
- **Delimitador:** ponto e vírgula (`;`)
- **Linha 1:** metadados/filtros da exportação — registado no histórico, não importado como dado
- **Linha 2:** vazia
- **Linha 3:** cabeçalho das colunas
- **Linhas 4 até à penúltima:** registos de dados
- **Última linha:** rodapé `Total (N Registos);;...` — N é validado contra o número de linhas processadas
- Cada linha termina com `;` extra (coluna fantasma) — descartado automaticamente
- Campos numéricos/texto vêm envolvidos em `="VALOR"` (formato Excel) — extraídos automaticamente

Campos importados: Matrícula, Modelo, Nº Quadro (VIN), Data Matrícula. O campo `motorizacao` nunca é alterado em registos existentes.

Limite de upload: **100 MB**.

---

## Base de Dados

SQLite (via `sql.js`) auto-inicializada em `backend/dsp.db` na primeira execução, com dados de seed. Para repor a base de dados, apagar o ficheiro `dsp.db` — é recriado no próximo arranque.

**Tabelas principais:**

| Tabela | Descrição |
|--------|-----------|
| `parque_circulante` | Viaturas (`motorizacao` CHECK `'EV'` ou `'PHEV'`) |
| `concessoes` | Concessionários |
| `revisoes` | Registos de serviço |
| `tipos_operacao` | Tipos de manutenção (PHEV/HEV); `ordem` = intervalo em anos |
| `operacoes` | Operações de manutenção específicas; `observacoes` é o valor guardado em `revisoes.tipo_operacao` |
| `historico_importacoes` | Registo de cada upload: tipo, ficheiro, contagens, erros e avisos (JSON) |

> **Nota:** `sql.js` carrega a BD inteira em memória — não adequado para grandes volumes ou escritas concorrentes. Para produção, substituir os helpers em `database.ts` por um cliente PostgreSQL.
