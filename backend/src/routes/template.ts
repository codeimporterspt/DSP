import { Router, Request, Response } from 'express';
import * as XLSX from 'xlsx';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const wb = XLSX.utils.book_new();
  const data = [
    ['Matrícula', 'VIN', 'Data de Matrícula', 'Modelo', 'Marca'],
    ['00-AA-00', 'LGXCE4CB4P2000000', '2024-01-01', 'ATTO 3', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Viaturas');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="template_viaturas.xlsx"');
  res.send(buffer);
});

export default router;
