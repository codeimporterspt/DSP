import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { queryOne, queryAll } from '../db/database';

const router = Router();

router.get('/:vin/pdf', (req: Request, res: Response) => {
  const { vin } = req.params;

  const vehicle = queryOne<any>('SELECT * FROM parque_circulante WHERE vin = ?', [vin]);
  if (!vehicle) { res.status(404).json({ error: 'Viatura não encontrada' }); return; }

  const services = queryAll<any>(`
    SELECT r.*, c.nome as c_nome, c.cidade as c_cidade, c.codigo_postal as c_cp, c.pais as c_pais
    FROM revisoes r
    LEFT JOIN concessoes c ON c.codigo_concessao = r.codigo_concessao
    WHERE r.vin = ?
    ORDER BY r.data_servico DESC
  `, [vin]);

  const today = new Date().toISOString().split('T')[0];
  const filename = `DSP_${vin}_${today}.pdf`;

  // services ordered DESC — index 0 is most recent
  const mostRecent = services.length > 0 ? services[0] : null;
  let nextMaintenanceNote: string | null = null;
  if (mostRecent) {
    const isEV = vehicle.motorizacao === 'EV';
    const kmInterval = isEV ? 30000 : 15000;
    const monthInterval = isEV ? 24 : 12;
    const nextKm = Number(mostRecent.quilometros) + kmInterval;
    const lastDate = new Date(mostRecent.data_servico);
    lastDate.setMonth(lastDate.getMonth() + monthInterval);
    const [ny, nm, nd] = lastDate.toISOString().split('T')[0].split('-');
    const nextKmFormatted = nextKm.toLocaleString('pt-PT');
    nextMaintenanceNote = `A próxima manutenção deverá ser efetuada aos ${nextKmFormatted} Km ou a ${nd}/${nm}/${ny} (conforme ocorrer primeiro).`;
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  const RED = '#111111';
  const DARK = '#4E5356';
  const LIGHT_GREY = '#F2F2F2';
  const pageWidth = doc.page.width - 80;

  // Header
  doc.rect(40, 40, pageWidth, 60).fill(DARK);
  doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
    .text('Registo Digital de Revisões', 55, 58);
  doc.fillColor(RED).fontSize(22).font('Helvetica-Bold')
    .text('DSP', 40 + pageWidth - 60, 52);

  // Vehicle info box
  const boxY = 120;
  doc.rect(40, boxY, pageWidth, 70).strokeColor(DARK).lineWidth(1).stroke();
  doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold')
    .text('Informações da Viatura', 55, boxY + 10);
  doc.font('Helvetica').fontSize(10).fillColor('#333333')
    .text(`VIN: ${vehicle.vin}`, 55, boxY + 26)
    .text(`Matrícula: ${vehicle.matricula}`, 55, boxY + 40)
    .text(`Modelo: ${vehicle.modelo}`, 260, boxY + 26)
    .text(`Motorização: ${vehicle.motorizacao}`, 260, boxY + 40);

  // Next maintenance note (below vehicle info box)
  const noteY = boxY + 70 + 10;
  const noteHeight = 36;
  if (nextMaintenanceNote) {
    doc.rect(40, noteY, pageWidth, noteHeight).fill('#F7F7F7');
    doc.rect(40, noteY, 4, noteHeight).fill(DARK);
    doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
      .text('Próxima Manutenção  ', 52, noteY + 10, { continued: true })
      .font('Helvetica').fillColor('#333333')
      .text(nextMaintenanceNote, { width: pageWidth - 20 });
  }

  // Table
  const tableTop = nextMaintenanceNote ? noteY + noteHeight + 10 : 210;
  const colWidths = [150, 70, 80, 230];
  const cols = ['Operação Realizada', 'Quilómetros', 'Data', 'Concessionário'];
  let xPos = 40;

  doc.rect(40, tableTop, pageWidth, 22).fill(LIGHT_GREY);
  doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold');
  cols.forEach((col, i) => {
    doc.text(col, xPos + 4, tableTop + 7, { width: colWidths[i] - 8 });
    xPos += colWidths[i];
  });

  let rowY = tableTop + 22;
  doc.font('Helvetica').fontSize(9);

  if (services.length === 0) {
    doc.fillColor('#666666').text('Sem registos de serviço', 55, rowY + 8);
    rowY += 30;
  }

  services.forEach((s: any, idx: number) => {
    const rowHeight = 60;
    if (idx % 2 === 1) {
      doc.rect(40, rowY, pageWidth, rowHeight).fill('#FAFAFA');
    }

    const concText = `${s.codigo_concessao} | ${s.c_nome ?? '-'}\n${s.c_cidade ?? '-'}, ${s.c_cp ?? '-'}\n${s.c_pais ?? '-'}`;
    xPos = 40;
    doc.fillColor('#333333');
    doc.text(s.tipo_operacao, xPos + 4, rowY + 8, { width: colWidths[0] - 8 });
    xPos += colWidths[0];
    doc.text(`${Number(s.quilometros).toLocaleString('pt-PT')} Km`, xPos + 4, rowY + 8, { width: colWidths[1] - 8 });
    xPos += colWidths[1];
    doc.text(s.data_servico, xPos + 4, rowY + 8, { width: colWidths[2] - 8 });
    xPos += colWidths[2];
    doc.text(concText, xPos + 4, rowY + 6, { width: colWidths[3] - 8 });

    doc.moveTo(40, rowY + rowHeight).lineTo(40 + pageWidth, rowY + rowHeight)
      .strokeColor('#E0E0E0').lineWidth(0.5).stroke();

    rowY += rowHeight;
  });

  doc.rect(40, tableTop, pageWidth, rowY - tableTop).strokeColor(DARK).lineWidth(0.5).stroke();

  // Footer
  const footerY = doc.page.height - 120;
  doc.moveTo(40, footerY).lineTo(40 + pageWidth, footerY).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
  doc.fillColor('#555555').fontSize(8).font('Helvetica')
    .text('Por favor, guarde este talão de revisão e as respetivas faturas como comprovativo.',
      40, footerY + 10, { width: pageWidth });
  doc.text(`Data: ${today}`, 40, footerY + 26);

  const sealX = 40 + pageWidth - 160;
  doc.rect(sealX, footerY + 10, 155, 60).strokeColor(DARK).lineWidth(0.8).stroke();
  doc.fillColor('#AAAAAA').fontSize(9)
    .text('Selo e Assinatura', sealX, footerY + 36, { width: 155, align: 'center' });

  doc.end();
});

export default router;
