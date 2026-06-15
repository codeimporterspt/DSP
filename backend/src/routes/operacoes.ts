import { Router, Request, Response } from 'express';
import { SqlValue } from 'sql.js';
import { queryAll, queryOne, execute } from '../db/database';

const router = Router();

// GET /api/operacoes?page=1&limit=10
router.get('/operacoes', (req: Request, res: Response) => {
  const { page = '1', limit = '10' } = req.query as { page?: string; limit?: string };
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const countRow = queryOne<{ c: number }>('SELECT COUNT(*) as c FROM operacoes');
  const total = countRow?.c ?? 0;

  const rows = queryAll(`
    SELECT o.id, o.codigo, o.tipo_id, t.nome as tipo_nome, o.ativo, o.observacoes, o.created_at, o.updated_at
    FROM operacoes o
    LEFT JOIN tipos_operacao t ON t.id = o.tipo_id
    ORDER BY o.id
    LIMIT ? OFFSET ?
  `, [limitNum, offset] as SqlValue[]);

  res.json({ total, page: pageNum, limit: limitNum, data: rows });
});

// POST /api/operacoes
router.post('/operacoes', (req: Request, res: Response) => {
  const { codigo, tipo_id, ativo = true, observacoes } = req.body;
  if (!codigo?.trim() || !tipo_id) {
    res.status(400).json({ error: 'Código e Tipo de Operação são obrigatórios' });
    return;
  }
  const tipo = queryOne('SELECT id FROM tipos_operacao WHERE id = ?', [Number(tipo_id)]);
  if (!tipo) { res.status(404).json({ error: 'Tipo de operação não encontrado' }); return; }
  const dup = queryOne('SELECT id FROM operacoes WHERE codigo = ?', [codigo.trim()]);
  if (dup) { res.status(409).json({ error: 'Código já existe' }); return; }

  const result = execute(
    'INSERT INTO operacoes (codigo, tipo_id, ativo, observacoes) VALUES (?, ?, ?, ?)',
    [codigo.trim(), Number(tipo_id), ativo ? 1 : 0, observacoes?.trim() || null]
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/operacoes/:id
router.put('/operacoes/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = queryOne<{ id: number; codigo: string; tipo_id: number; ativo: number; observacoes: string | null }>(
    'SELECT id, codigo, tipo_id, ativo, observacoes FROM operacoes WHERE id = ?', [id]
  );
  if (!existing) { res.status(404).json({ error: 'Operação não encontrada' }); return; }

  const { codigo, tipo_id, ativo, observacoes } = req.body;
  const newCodigo = codigo?.trim() ?? existing.codigo;

  if (newCodigo !== existing.codigo) {
    const dup = queryOne('SELECT id FROM operacoes WHERE codigo = ? AND id != ?', [newCodigo, id]);
    if (dup) { res.status(409).json({ error: 'Código já existe' }); return; }
  }

  execute(
    "UPDATE operacoes SET codigo = ?, tipo_id = ?, ativo = ?, observacoes = ?, updated_at = datetime('now') WHERE id = ?",
    [
      newCodigo,
      tipo_id !== undefined ? Number(tipo_id) : existing.tipo_id,
      ativo !== undefined ? (ativo ? 1 : 0) : existing.ativo,
      observacoes !== undefined ? (observacoes?.trim() || null) : existing.observacoes,
      id,
    ] as SqlValue[]
  );
  res.json({ success: true });
});

// DELETE /api/operacoes/:id
router.delete('/operacoes/:id', (req: Request, res: Response) => {
  const result = execute('DELETE FROM operacoes WHERE id = ?', [req.params.id]);
  if (result.changes === 0) { res.status(404).json({ error: 'Operação não encontrada' }); return; }
  res.json({ success: true });
});

// GET /api/tipos-operacao
router.get('/tipos-operacao', (_req: Request, res: Response) => {
  const rows = queryAll('SELECT id, nome, created_at FROM tipos_operacao ORDER BY id');
  res.json(rows);
});

// POST /api/tipos-operacao
router.post('/tipos-operacao', (req: Request, res: Response) => {
  const { nome } = req.body;
  if (!nome?.trim()) { res.status(400).json({ error: 'Nome é obrigatório' }); return; }
  const dup = queryOne('SELECT id FROM tipos_operacao WHERE UPPER(nome) = UPPER(?)', [nome.trim()]);
  if (dup) { res.status(409).json({ error: 'Tipo já existe' }); return; }
  const result = execute('INSERT INTO tipos_operacao (nome) VALUES (?)', [nome.trim()]);
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/tipos-operacao/:id
router.put('/tipos-operacao/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome } = req.body;
  if (!nome?.trim()) { res.status(400).json({ error: 'Nome é obrigatório' }); return; }
  const existing = queryOne('SELECT id FROM tipos_operacao WHERE id = ?', [id]);
  if (!existing) { res.status(404).json({ error: 'Tipo não encontrado' }); return; }
  const dup = queryOne('SELECT id FROM tipos_operacao WHERE UPPER(nome) = UPPER(?) AND id != ?', [nome.trim(), id]);
  if (dup) { res.status(409).json({ error: 'Tipo já existe' }); return; }
  execute('UPDATE tipos_operacao SET nome = ? WHERE id = ?', [nome.trim(), id]);
  res.json({ success: true });
});

// DELETE /api/tipos-operacao/:id
router.delete('/tipos-operacao/:id', (req: Request, res: Response) => {
  const inUse = queryOne('SELECT id FROM operacoes WHERE tipo_id = ?', [req.params.id]);
  if (inUse) { res.status(409).json({ error: 'Tipo em uso por operações existentes' }); return; }
  const result = execute('DELETE FROM tipos_operacao WHERE id = ?', [req.params.id]);
  if (result.changes === 0) { res.status(404).json({ error: 'Tipo não encontrado' }); return; }
  res.json({ success: true });
});

export default router;
