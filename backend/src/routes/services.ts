import { Router, Request, Response } from 'express';
import { SqlValue } from 'sql.js';
import { queryAll, queryOne, execute } from '../db/database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { matricula, vin, page = '1', limit = '10' } = req.query as {
    matricula?: string; vin?: string; page?: string; limit?: string;
  };

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const conditions: string[] = [];
  const params: SqlValue[] = [];

  if (matricula) { conditions.push('r.matricula = ?'); params.push(matricula); }
  if (vin) { conditions.push('r.vin = ?'); params.push(vin); }

  const where = conditions.length ? conditions.join(' AND ') : '1=1';

  const countRow = queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM revisoes r WHERE ${where}`, params);
  const total = countRow?.c ?? 0;

  const rows = queryAll(`
    SELECT
      r.id, r.vin, r.matricula, r.codigo_concessao, r.data_servico,
      r.quilometros, r.tipo_operacao, r.created_at,
      c.nome as concessao_nome,
      c.cidade as concessao_cidade,
      c.codigo_postal as concessao_cp,
      c.pais as concessao_pais,
      p.modelo as veiculo_modelo,
      p.marca as veiculo_marca,
      p.motorizacao as veiculo_motorizacao
    FROM revisoes r
    LEFT JOIN concessoes c ON c.codigo_concessao = r.codigo_concessao
    LEFT JOIN parque_circulante p ON p.vin = r.vin
    WHERE ${where}
    ORDER BY r.data_servico DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset] as SqlValue[]);

  res.json({ total, page: pageNum, limit: limitNum, data: rows });
});

router.post('/', (req: Request, res: Response) => {
  const { vin, matricula, codigo_concessao, data_servico, quilometros, tipo_operacao } = req.body;

  if (!vin || !matricula || !codigo_concessao || !data_servico || quilometros === undefined || !tipo_operacao) {
    res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    return;
  }

  const vehicle = queryOne('SELECT id FROM parque_circulante WHERE vin = ?', [vin]);
  if (!vehicle) { res.status(404).json({ error: 'Viatura não encontrada' }); return; }

  const dealer = queryOne('SELECT id FROM concessoes WHERE codigo_concessao = ?', [codigo_concessao]);
  if (!dealer) { res.status(404).json({ error: 'Concessionário não encontrado' }); return; }

  const result = execute(
    'INSERT INTO revisoes (vin, matricula, codigo_concessao, data_servico, quilometros, tipo_operacao) VALUES (?, ?, ?, ?, ?, ?)',
    [vin, matricula, codigo_concessao, data_servico, quilometros, tipo_operacao]
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { codigo_concessao, data_servico, quilometros, tipo_operacao } = req.body;

  const existing = queryOne('SELECT id FROM revisoes WHERE id = ?', [id]);
  if (!existing) { res.status(404).json({ error: 'Registo não encontrado' }); return; }

  const current = queryOne<{ codigo_concessao: string; data_servico: string; quilometros: number; tipo_operacao: string }>(
    'SELECT codigo_concessao, data_servico, quilometros, tipo_operacao FROM revisoes WHERE id = ?', [id]
  )!;

  execute(
    'UPDATE revisoes SET codigo_concessao = ?, data_servico = ?, quilometros = ?, tipo_operacao = ? WHERE id = ?',
    [
      codigo_concessao ?? current.codigo_concessao,
      data_servico ?? current.data_servico,
      quilometros ?? current.quilometros,
      tipo_operacao ?? current.tipo_operacao,
      id
    ]
  );

  res.json({ success: true });
});

router.delete('/:id', (req: Request, res: Response) => {
  const result = execute('DELETE FROM revisoes WHERE id = ?', [req.params.id]);
  if (result.changes === 0) { res.status(404).json({ error: 'Registo não encontrado' }); return; }
  res.json({ success: true });
});

export default router;
