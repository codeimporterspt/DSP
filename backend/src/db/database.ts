import initSqlJs, { Database, SqlJsStatic, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../dsp.db');

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
  seedOperacoesIfEmpty();
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
    CREATE TABLE IF NOT EXISTS tipos_operacao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS operacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      tipo_id INTEGER NOT NULL REFERENCES tipos_operacao(id),
      ativo INTEGER NOT NULL DEFAULT 1,
      observacoes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      ('02491', 'António Martins & Filhos, Lda.', 'Braga', '4700-001', 'Portugal'),
      ('02951', 'Auto Açoreana Lda', 'Ponta Delgada', '9500-001', 'Portugal'),
      ('02531', 'Auto Imperial de Bragança, Lda', 'Bragança', '5300-001', 'Portugal'),
      ('02351', 'Auto Martinauto, S.A.', 'Lisboa', '1000-001', 'Portugal'),
      ('02410', 'Caetano 3, S.A.', 'Maia', '4470-001', 'Portugal'),
      ('02412', 'Caetano, S.A.', 'Maia', '4470-177', 'Portugal'),
      ('02181', 'CarClasse', 'Lisboa', '1600-001', 'Portugal'),
      ('02473', 'EMAC', 'Porto', '4100-001', 'Portugal'),
      ('02451', 'FIANOR Auto, S.A.', 'Aveiro', '3800-001', 'Portugal'),
      ('02441', 'Filinto Mota Automóveis, Lda.', 'Porto', '4200-001', 'Portugal'),
      ('02801', 'Fomento Industrial e Agrícola do Algarve, Lda.', 'Faro', '8000-001', 'Portugal'),
      ('02301', 'GESMOBILITY LDA', 'Lisboa', '1900-001', 'Portugal'),
      ('02241', 'LUBRIRENT', 'Lisboa', '1750-001', 'Portugal'),
      ('02901', 'Madeira Motores', 'Funchal', '9000-001', 'Portugal');
    INSERT INTO revisoes (vin, matricula, codigo_concessao, data_servico, quilometros, tipo_operacao) VALUES
      ('LGXCE4CB4P2000001', '00-AA-01', '02441', '2024-03-15', 30000, '24 meses ou 30.000 Km'),
      ('LGXCE4CB4P2000001', '00-AA-01', '02351', '2025-03-20', 60000, '48 meses ou 60.000 Km'),
      ('LGXCE4CB4P2000002', '00-BB-02', '02412', '2024-06-20', 15000, '12 meses ou 15.000 Km'),
      ('LGXCE4CB4P2000003', '00-CC-03', '02410', '2025-01-10', 30000, '24 meses ou 30.000 Km');
  `);
  console.log('Database seeded with sample data.');
}

function seedOperacoesIfEmpty() {
  const res = _db!.exec("SELECT COUNT(*) as c FROM tipos_operacao");
  const count = (res[0]?.values[0]?.[0] as number) ?? 0;
  if (count > 0) return;
  _db!.run(`
    INSERT INTO tipos_operacao (nome) VALUES ('PHEV'), ('BEV'), ('HEV');
    INSERT INTO operacoes (codigo, tipo_id, ativo, observacoes) VALUES
      ('15000/1Ano',   1, 1, '15 000 Km / 1 Ano'),
      ('30000/2Anos',  1, 1, '30 000 Km / 2 Anos'),
      ('45000/3Anos',  1, 1, '45 000 Km / 3 Anos'),
      ('60000/4Anos',  1, 1, '60 000 Km / 4 Anos'),
      ('75000/5Anos',  1, 1, '75 000 Km / 5 Anos'),
      ('90000/6Anos',  1, 1, '90 000 Km / 6 Anos'),
      ('105000/7Anos', 1, 1, '105 000 Km / 7 Anos'),
      ('120000/8Anos', 1, 1, '120 000 Km / 8 Anos'),
      ('135000/9Anos', 1, 1, '135 000 Km / 9 Anos'),
      ('150000/10Anos',1, 1, '150 000 Km / 10 Anos')
  `);
  console.log('Tipos de operação e operações inicializados.');
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
