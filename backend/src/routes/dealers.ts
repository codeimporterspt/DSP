import { Router, Request, Response } from 'express';
import { queryAll, queryOne } from '../db/database';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const dealers = queryAll('SELECT * FROM concessoes ORDER BY nome ASC');
  res.json(dealers);
});

router.get('/:codigo', (req: Request, res: Response) => {
  const dealer = queryOne('SELECT * FROM concessoes WHERE codigo_concessao = ?', [req.params.codigo]);
  if (!dealer) {
    res.status(404).json({ error: 'Concessionário não encontrado' });
    return;
  }
  res.json(dealer);
});

export default router;
