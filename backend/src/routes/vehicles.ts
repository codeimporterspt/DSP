import { Router, Request, Response } from 'express';
import { queryAll, queryOne, execute } from '../db/database';

const router = Router();

router.get('/search', (req: Request, res: Response) => {
  const { matricula, vin } = req.query as { matricula?: string; vin?: string };
  if (!matricula && !vin) {
    res.status(400).json({ error: 'Forneça matrícula ou VIN' });
    return;
  }
  const vehicle = queryOne(
    'SELECT * FROM parque_circulante WHERE matricula = ? OR vin = ? LIMIT 1',
    [matricula ?? '', vin ?? '']
  );
  if (!vehicle) {
    res.status(404).json({ error: 'Viatura não encontrada' });
    return;
  }
  res.json(vehicle);
});

router.get('/', (_req: Request, res: Response) => {
  const vehicles = queryAll('SELECT * FROM parque_circulante ORDER BY id DESC');
  res.json(vehicles);
});

router.post('/upsert-bulk', (req: Request, res: Response) => {
  const { vehicles } = req.body as { vehicles: Array<{ vin: string; matricula: string; data_matricula: string; modelo: string; marca: string; motorizacao: string }> };
  if (!Array.isArray(vehicles) || vehicles.length === 0) {
    res.status(400).json({ error: 'Lista de viaturas inválida' });
    return;
  }

  const results = { inserted: 0, updated: 0, errors: [] as string[] };

  for (const v of vehicles) {
    try {
      const existing = queryOne('SELECT id FROM parque_circulante WHERE vin = ?', [v.vin]);
      execute(
        `INSERT INTO parque_circulante (vin, matricula, data_matricula, modelo, marca, motorizacao)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(vin) DO UPDATE SET
           matricula = excluded.matricula,
           data_matricula = excluded.data_matricula,
           modelo = excluded.modelo,
           marca = excluded.marca,
           motorizacao = excluded.motorizacao`,
        [v.vin, v.matricula, v.data_matricula, v.modelo, v.marca, v.motorizacao]
      );
      if (existing) results.updated++; else results.inserted++;
    } catch (e) {
      results.errors.push(`VIN ${v.vin}: ${(e as Error).message}`);
    }
  }

  res.json(results);
});

export default router;
