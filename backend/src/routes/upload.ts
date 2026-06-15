import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { queryOne, execute } from '../db/database';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'Ficheiro não fornecido' }); return; }

  let rows: any[][];
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
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

  const iMat = idxOf(['matrícula', 'matricula']);
  const iVin = idxOf(['vin']);
  const iData = idxOf(['data de matrícula', 'data_matricula', 'data matricula']);
  const iModelo = idxOf(['modelo']);
  const iMarca = idxOf(['marca']);

  if (iMat < 0 || iVin < 0 || iData < 0 || iModelo < 0) {
    res.status(400).json({ error: 'Colunas obrigatórias em falta: Matrícula, VIN, Data de Matrícula, Modelo' });
    return;
  }

  const results = { inserted: 0, updated: 0, errors: [] as string[] };

  dataRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const vin = String(row[iVin] ?? '').trim();
    const matricula = String(row[iMat] ?? '').trim();
    const modelo = String(row[iModelo] ?? '').trim();
    const marca = iMarca >= 0 ? String(row[iMarca] ?? '').trim() : '';

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
           matricula = excluded.matricula,
           data_matricula = excluded.data_matricula,
           modelo = excluded.modelo,
           marca = excluded.marca`,
        [vin, matricula, data_matricula, modelo, marca, existing?.motorizacao ?? 'EV']
      );
      if (existing) results.updated++; else results.inserted++;
    } catch (e) {
      results.errors.push(`Linha ${rowNum} (VIN ${vin}): ${(e as Error).message}`);
    }
  });

  res.json(results);
});

export default router;
