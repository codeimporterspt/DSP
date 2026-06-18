import { Router, Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import * as XLSX from 'xlsx';
import { queryAll, queryOne, execute, executeNoPersist, flushDb } from '../db/database';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Strip ="VALUE" Excel formula wrapper and return null for empty values
function cleanField(raw: string): string | null {
  const trimmed = raw.trim();
  const m = trimmed.match(/^="(.*)"$/s);
  const value = m ? m[1] : trimmed;
  return value === '' ? null : value;
}

// Accept DD-MM-YYYY, DD/MM/YYYY, or already-ISO YYYY-MM-DD
function parseDate(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

// ── Motordata (CSV, Windows-1252) ─────────────────────────────────────────────

function handleMotordata(req: Request, res: Response) {
  try {
    _handleMotordata(req, res);
  } catch (err) {
    console.error('[Motordata upload] Unhandled error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: `Erro interno: ${(err as Error).message}` });
    }
  }
}

function _handleMotordata(req: Request, res: Response) {
  const text = req.file!.buffer.toString('latin1');
  const lines = text.split(/\r?\n/);

  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

  if (lines.length < 4) {
    res.status(400).json({ error: 'Ficheiro Motordata inválido: linhas insuficientes' });
    return;
  }

  const metaLine = lines[0];
  // lines[1] is empty — skip
  const rawHeaders = lines[2].split(';');
  const headers = rawHeaders.slice(0, -1).map(h => h.trim()); // drop phantom last col

  const footerLine = lines[lines.length - 1];
  const footerMatch = footerLine.match(/^Total\s*\((\d+)\s*Registos?\)/i);
  if (!footerMatch) {
    res.status(400).json({ error: 'Ficheiro Motordata inválido: rodapé "Total (N Registos)" não encontrado' });
    return;
  }
  const footerCount = parseInt(footerMatch[1], 10);

  const dataLines = lines.slice(3, lines.length - 1).filter(l => l.trim() !== '');
  const dataRows = dataLines.map(l => l.split(';').slice(0, -1));

  console.log(`[Motordata upload] Filtros: ${metaLine}`);

  const idxOf = (name: string) =>
    headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const iMat   = idxOf('Matrícula');
  const iData  = idxOf('Data Matrícula');
  const iMod   = idxOf('Modelo');
  const iVin   = idxOf('Nº Quadro');

  const missing = [
    iMat  < 0 && 'Matrícula',
    iData < 0 && 'Data Matrícula',
    iMod  < 0 && 'Modelo',
    iVin  < 0 && 'Nº Quadro',
  ].filter(Boolean);

  if (missing.length) {
    res.status(400).json({ error: `Colunas obrigatórias não encontradas: ${missing.join(', ')}` });
    return;
  }

  // Pre-load all existing VINs with their motorizacao in one query
  const existingMap = new Map(
    queryAll<{ vin: string; motorizacao: string }>('SELECT vin, motorizacao FROM parque_circulante')
      .map(r => [r.vin, r.motorizacao])
  );

  const results = {
    inserted: 0,
    updated: 0,
    errors: [] as string[],
    warnings: [] as string[],
    metaFilters: metaLine,
  };

  // Process all rows without persisting to disk on each write
  dataRows.forEach((cols, idx) => {
    const rowNum = idx + 4;

    const matricula = (cols[iMat] ?? '').trim();
    const dataRaw   = cleanField(cols[iData] ?? '');
    const modeloRaw = cleanField(cols[iMod]  ?? '');
    const vin       = (cols[iVin] ?? '').trim();

    if (!matricula || !vin || !modeloRaw || !dataRaw) {
      results.errors.push(`Linha ${rowNum}: campos obrigatórios em falta (matrícula=${matricula || '—'}, vin=${vin || '—'})`);
      return;
    }

    const data_matricula = parseDate(dataRaw);
    if (!data_matricula) {
      results.errors.push(`Linha ${rowNum}: data de matrícula inválida ("${dataRaw}")`);
      return;
    }

    const modelo = modeloRaw.startsWith('#') ? modeloRaw.slice(1) : modeloRaw;
    const motorizacao = existingMap.get(vin) ?? 'EV';
    const isUpdate = existingMap.has(vin);

    try {
      executeNoPersist(
        `INSERT INTO parque_circulante (vin, matricula, data_matricula, modelo, motorizacao)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(vin) DO UPDATE SET
           matricula       = excluded.matricula,
           data_matricula  = excluded.data_matricula,
           modelo          = excluded.modelo`,
        [vin, matricula, data_matricula, modelo, motorizacao]
      );
      if (isUpdate) results.updated++; else results.inserted++;
      existingMap.set(vin, motorizacao); // mark as known for duplicate rows in the same file
    } catch (e) {
      results.errors.push(`Linha ${rowNum} (VIN ${vin}): ${(e as Error).message}`);
    }
  });

  // Single disk write for the entire batch
  flushDb();

  const processed = results.inserted + results.updated + results.errors.length;
  if (processed !== footerCount) {
    results.warnings.push(
      `Validação de rodapé: ficheiro declara ${footerCount} registos, processados ${processed} ` +
      `(${results.inserted + results.updated} importados, ${results.errors.length} erros)`
    );
  }

  execute(
    `INSERT INTO historico_importacoes (tipo, filename, inserted, updated, error_count, errors, warnings, meta_filters)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Motordata', req.file!.originalname, results.inserted, results.updated,
     results.errors.length, JSON.stringify(results.errors), JSON.stringify(results.warnings), metaLine]
  );

  res.json(results);
}

// ── Novas Viaturas (XLSX) ─────────────────────────────────────────────────────

function handleNovasViaturas(req: Request, res: Response) {
  let rows: any[][];
  try {
    const wb = XLSX.read(req.file!.buffer, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
  } catch {
    res.status(400).json({ error: 'Ficheiro inválido' });
    return;
  }

  if (rows.length < 2) { res.status(400).json({ error: 'Ficheiro sem dados' }); return; }

  const [header, ...dataRows] = rows;
  const h = (header as string[]).map((s: string) => String(s).trim().toLowerCase());
  const idxOf = (names: string[]) => names.map(n => h.indexOf(n)).find(i => i >= 0) ?? -1;

  const iMat   = idxOf(['matrícula', 'matricula']);
  const iVin   = idxOf(['vin']);
  const iData  = idxOf(['data de matrícula', 'data_matricula', 'data matricula']);
  const iModelo = idxOf(['modelo']);
  const iMarca  = idxOf(['marca']);

  if (iMat < 0 || iVin < 0 || iData < 0 || iModelo < 0) {
    res.status(400).json({ error: 'Colunas obrigatórias em falta: Matrícula, VIN, Data de Matrícula, Modelo' });
    return;
  }

  const results = { inserted: 0, updated: 0, errors: [] as string[] };

  dataRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const vin       = String(row[iVin]    ?? '').trim();
    const matricula = String(row[iMat]    ?? '').trim();
    const modelo    = String(row[iModelo] ?? '').trim();
    const marca     = iMarca >= 0 ? String(row[iMarca] ?? '').trim() : '';

    let data_matricula = '';
    const rawDate = row[iData];
    if (rawDate instanceof Date) {
      data_matricula = rawDate.toISOString().split('T')[0];
    } else {
      data_matricula = String(rawDate ?? '').trim();
    }

    if (!vin || !matricula || !modelo || !data_matricula) {
      results.errors.push(`Linha ${rowNum}: campos obrigatórios em falta`);
      return;
    }

    try {
      const existing = queryOne<{ motorizacao: string }>('SELECT motorizacao FROM parque_circulante WHERE vin = ?', [vin]);
      execute(
        `INSERT INTO parque_circulante (vin, matricula, data_matricula, modelo, marca, motorizacao)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(vin) DO UPDATE SET
           matricula      = excluded.matricula,
           data_matricula = excluded.data_matricula,
           modelo         = excluded.modelo,
           marca          = excluded.marca`,
        [vin, matricula, data_matricula, modelo, marca, existing?.motorizacao ?? 'EV']
      );
      if (existing) results.updated++; else results.inserted++;
    } catch (e) {
      results.errors.push(`Linha ${rowNum} (VIN ${vin}): ${(e as Error).message}`);
    }
  });

  execute(
    `INSERT INTO historico_importacoes (tipo, filename, inserted, updated, error_count, errors, warnings, meta_filters)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Novas Viaturas', req.file!.originalname, results.inserted, results.updated,
     results.errors.length, JSON.stringify(results.errors), null, null]
  );

  res.json(results);
}

// ── Router ────────────────────────────────────────────────────────────────────

router.get('/history', (req: Request, res: Response) => {
  const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10));
  const limit = Math.min(50, parseInt(String(req.query.limit ?? '20'), 10));
  const offset = (page - 1) * limit;
  const total = (queryOne<{ c: number }>('SELECT COUNT(*) as c FROM historico_importacoes')?.c) ?? 0;
  const rows  = queryAll('SELECT * FROM historico_importacoes ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
  res.json({ data: rows, total, page, limit });
});

router.post('/', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'Ficheiro não fornecido' }); return; }
  const tipo = req.body?.tipo_upload ?? 'Novas Viaturas';
  console.log(`[upload] tipo=${tipo} filename=${req.file.originalname} size=${req.file.size}`);
  if (tipo === 'Motordata') {
    handleMotordata(req, res);
  } else {
    handleNovasViaturas(req, res);
  }
});

// Multer errors (file too large, wrong field name, etc.) arrive here as Express errors
router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof MulterError) {
    console.error('[upload] MulterError:', err.message);
    res.status(400).json({ error: `Erro no upload: ${err.message}` });
  } else {
    console.error('[upload] Unexpected error:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;
