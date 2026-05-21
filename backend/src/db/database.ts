import initSqlJs, { Database, SqlJsStatic, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../dsp_byd.db');

let _db: Database | null = null;
let _SQL: SqlJsStatic | null = null;

// Persist DB to disk after every write
function persist() {
  if (_db) {
    const data = _db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

export async function initDb(): Promise<void> {
  if (_db) return;
  _SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new _SQL.Database(fileBuffer);
  } else {
    _db = new _SQL.Database();
  }
  initSchema();
  seedIfEmpty();
  persist();
  console.log('Database initialized at', DB_PATH);
}

function initSchema() {
  _db!.run(`
    CREATE TABLE IF NOT EXISTS parque_circulante (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vin TEXT NOT NULL UNIQUE,
      matricula TEXT NOT NULL UNIQUE,
      data_matricula TEXT NOT NULL,
      modelo TEXT NOT NULL,
      marca TEXT NOT NULL DEFAULT '',
      motorizacao TEXT NOT NULL CHECK(motorizacao IN ('EV','PHEV'))
    );
    CREATE TABLE IF NOT EXISTS concessoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_concessao TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      cidade TEXT NOT NULL,
      codigo_postal TEXT NOT NULL,
      pais TEXT NOT NULL DEFAULT 'Portugal'
    );
    CREATE TABLE IF NOT EXISTS revisoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vin TEXT NOT NULL,
      matricula TEXT NOT NULL,
      codigo_concessao TEXT NOT NULL,
      data_servico TEXT NOT NULL,
      quilometros INTEGER NOT NULL,
      tipo_operacao TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function seedIfEmpty() {
  const res = _db!.exec("SELECT COUNT(*) as c FROM parque_circulante");
  const count = (res[0]?.values[0]?.[0] as number) ?? 0;
  if (count > 0) return;

  _db!.run(`
    INSERT INTO parque_circulante (vin, matricula, data_matricula, modelo, marca, motorizacao) VALUES
      ('LGXCE4CB4P2000001', '00-AA-01', '2023-03-15', 'ATTO 3', '', 'EV'),
      ('LGXCE4CB4P2000002', '00-BB-02', '2023-06-20', 'SEAL U DM-i', '', 'PHEV'),
      ('LGXCE4CB4P2000003', '00-CC-03', '2024-01-10', 'SEAL', '', 'EV');
    INSERT INTO concessoes (codigo_concessao, nome, cidade, codigo_postal, pais) VALUES
      ('4711', 'M. & Costas Power - Braga', 'Braga', '4710-439', 'Portugal'),
      ('1201', 'Lisboa Centro', 'Lisboa', '1050-110', 'Portugal'),
      ('3301', 'Porto Norte', 'Porto', '4100-130', 'Portugal');
    INSERT INTO revisoes (vin, matricula, codigo_concessao, data_servico, quilometros, tipo_operacao) VALUES
      ('LGXCE4CB4P2000001', '00-AA-01', '4711', '2024-03-15', 30000, '24 meses ou 30.000 Km'),
      ('LGXCE4CB4P2000001', '00-AA-01', '1201', '2025-03-20', 60000, '48 meses ou 60.000 Km'),
      ('LGXCE4CB4P2000002', '00-BB-02', '4711', '2024-06-20', 15000, '12 meses ou 15.000 Km'),
      ('LGXCE4CB4P2000003', '00-CC-03', '3301', '2025-01-10', 30000, '24 meses ou 30.000 Km');
  `);
  console.log('Database seeded with sample data.');
}

// Query helpers (synchronous-style API wrapping sql.js)
export function queryAll<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T[] {
  const stmt = _db!.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T | null {
  const results = queryAll<T>(sql, params);
  return results[0] ?? null;
}

export function execute(sql: string, params: SqlValue[] = []): { lastInsertRowid: number; changes: number } {
  _db!.run(sql, params);
  const info = _db!.exec("SELECT last_insert_rowid() as lid, changes() as ch");
  const lid = (info[0]?.values[0]?.[0] as number) ?? 0;
  const ch = (info[0]?.values[0]?.[1] as number) ?? 0;
  persist();
  return { lastInsertRowid: lid, changes: ch };
}

export function getDb() {
  return _db!;
}
