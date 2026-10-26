import express from 'express';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';
import { HttpError } from './errors.js';
import documentsRouter from './routes/documents.js';
import sharesRouter from './routes/shares.js';
import importRouter from './routes/imports.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser(process.env.SESSION_SECRET));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/documents/import', importRouter);
app.use('/api/documents/:id/shares', sharesRouter);
app.use('/api/documents', documentsRouter);

// document routes get mounted here next

app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong.' } });
});

export default app;
