import express from 'express';
import cors from 'cors';
import { initDb } from './db/database';
import vehiclesRouter from './routes/vehicles';
import dealersRouter from './routes/dealers';
import servicesRouter from './routes/services';
import pdfRouter from './routes/pdf';
import templateRouter from './routes/template';
import uploadRouter from './routes/upload';
import operacoesRouter from './routes/operacoes';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/vehicles', vehiclesRouter);
app.use('/api/dealers', dealersRouter);
app.use('/api/revisoes', servicesRouter);
app.use('/api/revisoes', pdfRouter);
app.use('/api/template', templateRouter);
app.use('/api/upload', uploadRouter);

app.use('/api', operacoesRouter);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

async function main() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`DSP backend running on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
